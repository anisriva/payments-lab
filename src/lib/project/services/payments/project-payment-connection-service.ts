import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { ProjectPaymentConnectionDAO } from '@/lib/project/dao/payments/project-payment-connection-dao';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { ProjectProviderEventDAO } from '@/lib/project/dao/payments/project-provider-event-dao';
import { createProvider, getManifest, isProviderKey } from '@/lib/common/payments/core/registry.server';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { runConnectionChecks, removeWebhook, type ValidationReport } from '@/lib/common/payments/core/connection-checks';
import { webhookUrlFor } from '@/lib/common/services/payments/payment-webhook-service';
import { getAppBaseUrl, getPaymentEnvironment } from '@/config/payments/env';
import { ProjectCredentialStore } from './project-credential-store';
import type { PaymentProvider } from '@/lib/common/payments/core/contracts/provider';
import type { PaginationInput } from '@/types/common/pagination';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import { PaymentConnectionDisabledError, PaymentConnectionNotFoundError } from './errors';

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isPublicBaseUrl(): boolean {
  try {
    const host = new URL(getAppBaseUrl()).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.local');
  } catch {
    return false;
  }
}

export class ProjectPaymentConnectionService {
  private connectionDAO: ProjectPaymentConnectionDAO;
  private projectDAO: ProjectDAO;
  private providerEventDAO: ProjectProviderEventDAO;
  private providerRulesService: ProviderRulesService;
  private credentialStore: ProjectCredentialStore;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.connectionDAO = new ProjectPaymentConnectionDAO(prisma);
    this.projectDAO = new ProjectDAO(prisma);
    this.providerEventDAO = new ProjectProviderEventDAO(prisma);
    this.providerRulesService = new ProviderRulesService(prisma);
    this.credentialStore = new ProjectCredentialStore(prisma);
  }

  async listForProject(projectId: string, pagination?: PaginationInput) {
    const result = await this.connectionDAO.listByProject(projectId, { pagination });
    return {
      ...result,
      data: await Promise.all(result.data.map(async (c) => ({
        ...c,
        webhookUrl: webhookUrlFor({ kind: 'project', projectId }, c.provider, getAppBaseUrl()),
        lastEvent: await this.providerEventDAO.findLatest(c.provider, c.id),
      }))),
    };
  }

  async getForProject(projectId: string, provider: string) {
    if (!isProviderKey(provider)) return null;
    return this.connectionDAO.findByProjectAndProvider(projectId, provider, getPaymentEnvironment());
  }

  async connect(input: { projectId: string; provider: string; credentials: Record<string, string> }) {
    const { projectId, provider, credentials } = input;

    const project = await this.projectDAO.findById(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const manifest = getManifest(provider);
    if (!manifest.audiences.includes('project')) throw new ProviderNotImplementedError(provider);

    // Credentials: parsed with the same schema as the form
    const cleaned = this.credentialStore.parseInput(provider, credentials);

    const rule = await this.providerRulesService.getRule(provider, 'project');
    const existing = await this.connectionDAO.findByProjectAndProvider(projectId, provider, getPaymentEnvironment());
    const id = existing?.id ?? randomUUID();
    const runtime = await this.credentialStore.buildRuntime(provider, id, cleaned);

    const adapter = createProvider(provider, runtime, getPaymentEnvironment());
    const url = webhookUrlFor({ kind: 'project', projectId }, provider, getAppBaseUrl());

    const { report, webhook } = await runConnectionChecks(adapter, {
      rules: rule,
      receiverCountry: project.countryCode,
      webhook: { url, secret: runtime.webhookSecret!, isPublicBaseUrl: isPublicBaseUrl() },
    });

    if (!report.canSave) {
      return { saved: false, connection: null, report };
    }

    const connection = await this.connectionDAO.upsert({
      id,
      projectId,
      provider,
      environment: getPaymentEnvironment(),
      credentialsEnc: this.credentialStore.encrypt(id, runtime),
      displayHint: this.credentialStore.displayHint(provider, runtime),
      isEnabled: true,
      verifiedAt: new Date(),
    });

    // Keep any previously registered ref when registration was skipped/failed
    await this.connectionDAO.update(id, {
      ...(webhook?.ref ? { webhookRef: webhook.ref, webhookActive: webhook.active, webhookRegisteredAt: webhook.registeredAt } : {}),
      webhookError: webhook?.error ?? null,
      validationReport: report as unknown as Record<string, unknown> & object,
      validatedAt: new Date(),
    });

    return { saved: true, connection, report };
  }

  async revalidate(projectId: string, connectionId: string) {
    const row = await this.connectionDAO.findWithCredentials(connectionId);
    if (!row || row.projectId !== projectId) throw new PaymentConnectionNotFoundError(connectionId);

    const creds = await this.credentialStore.read(row.provider, connectionId);
    const adapter = createProvider(row.provider, creds, row.environment);

    const project = await this.projectDAO.findById(projectId);
    const rule = await this.providerRulesService.getRule(row.provider, 'project');
    const url = webhookUrlFor({ kind: 'project', projectId }, row.provider, getAppBaseUrl());

    const { report, webhook } = await runConnectionChecks(adapter, {
      rules: rule,
      receiverCountry: project?.countryCode,
      webhook: { url, secret: creds.webhookSecret!, isPublicBaseUrl: isPublicBaseUrl() },
    });

    await this.connectionDAO.update(connectionId, {
      ...(webhook && {
        webhookRef: webhook.ref,
        webhookActive: webhook.active,
        webhookRegisteredAt: webhook.registeredAt,
        webhookError: webhook.error,
      }),
      validationReport: report as unknown as Record<string, unknown> & object,
      validatedAt: new Date(),
    });
    return report;
  }

  async disconnect(projectId: string, connectionId: string) {
    const connection = await this.connectionDAO.findById(connectionId);
    if (!connection || connection.projectId !== projectId) throw new PaymentConnectionNotFoundError(connectionId);
    const updated = await this.connectionDAO.update(connectionId, { isEnabled: false });

    // Removal degrades gracefully: delete → disable → manual step (surfaced to the UI)
    if (connection.webhookRef) {
      try {
        const { adapter } = await this.getAdapter(connectionId, { requireEnabled: false });
        const creds = await this.credentialStore.read(connection.provider, connectionId);
        const url = webhookUrlFor({ kind: 'project', projectId }, connection.provider, getAppBaseUrl());
        const result = await removeWebhook(adapter, connection.webhookRef, { url, secret: creds.webhookSecret! });
        await this.connectionDAO.update(connectionId, {
          webhookActive: result.removed === 'manual' ? connection.webhookActive : false,
          webhookError: result.removed === 'manual' ? result.step?.title ?? 'Delete the webhook in the provider dashboard' : null,
        });
      } catch (e) {
        await this.connectionDAO.update(connectionId, { webhookError: describe(e) });
      }
    }
    return updated;
  }

  async getAdapter(connectionId: string, opts: { requireEnabled: boolean }): Promise<{
    connection: { id: string; projectId: string; provider: ProviderKey; environment: string; isEnabled: boolean };
    adapter: PaymentProvider;
  }> {
    const connection = await this.connectionDAO.findWithCredentials(connectionId);
    if (!connection) throw new PaymentConnectionNotFoundError(connectionId);
    if (opts.requireEnabled && !connection.isEnabled) throw new PaymentConnectionDisabledError(connectionId);
    const creds = await this.credentialStore.read(connection.provider, connection.id);
    const adapter = createProvider(connection.provider, creds, connection.environment);
    return {
      connection: {
        id: connection.id,
        projectId: connection.projectId,
        provider: connection.provider,
        environment: connection.environment,
        isEnabled: connection.isEnabled,
      },
      adapter,
    };
  }
}
