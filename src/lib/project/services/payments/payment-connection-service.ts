import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { PaymentConnectionDAO } from '@/lib/project/dao/payments/payment-connection-dao';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { ProviderEventDAO } from '@/lib/common/dao/payments/provider-event-dao';
import { createProvider, countryAllowed, getProfile, isProviderKey } from '@/lib/common/payments/core/factory';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import { ProviderSettingsService } from '@/lib/common/services/payments/provider-settings-service';
import { WebhookRegistrationService } from '@/lib/common/services/payments/webhook-registration-service';
import { encryptJson, decryptJson } from '@/lib/common/payments/core/credentials-cipher';
import { getEncryptionKey, getPaymentEnvironment } from '@/lib/common/services/payments/payment-config';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { PaginationInput } from '@/types/common/pagination';
import type { ProviderKey, ValidationReport } from '@/lib/common/payments/core/types';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import { GatewayCountryNotSupportedError, GatewayCredentialsRejectedError, InvalidCredentialsInputError, PaymentConnectionDisabledError, PaymentConnectionNotFoundError } from './errors';

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class PaymentConnectionService {
  private paymentConnectionDAO: PaymentConnectionDAO;
  private projectDAO: ProjectDAO;
  private providerEventDAO: ProviderEventDAO;
  private providerSettingsService: ProviderSettingsService;
  private webhookRegistrationService: WebhookRegistrationService;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.paymentConnectionDAO = new PaymentConnectionDAO(prisma);
    this.projectDAO = new ProjectDAO(prisma);
    this.providerEventDAO = new ProviderEventDAO(prisma);
    this.providerSettingsService = new ProviderSettingsService(prisma);
    this.webhookRegistrationService = new WebhookRegistrationService(prisma);
  }

  async listForProject(projectId: string, pagination?: PaginationInput) {
    const result = await this.paymentConnectionDAO.listByProject(projectId, { pagination });
    return {
      ...result,
      data: await Promise.all(result.data.map(async (c) => ({
        ...c,
        webhookUrl: this.webhookRegistrationService.urlFor({ kind: 'project', projectId }, c.provider),
        webhookActive: c.webhookActive,
        webhookRegisteredAt: c.webhookRegisteredAt,
        webhookError: c.webhookError,
        validationReport: c.validationReport,
        validatedAt: c.validatedAt,
        lastEvent: await this.providerEventDAO.findLatest(c.provider, c.id),
      }))),
    };
  }

  async getForProject(projectId: string, provider: string) {
    if (!isProviderKey(provider)) return null;
    return this.paymentConnectionDAO.findByProjectAndProvider(projectId, provider, getPaymentEnvironment());
  }

  async connect(input: { projectId: string; provider: string; credentials: Record<string, string> }) {
    const { projectId, provider, credentials } = input;

    // 1. Project + provider checks
    const project = await this.projectDAO.findById(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const caps = await this.providerSettingsService.getEffectiveCapability(provider, 'project');
    if (!caps.implemented || !caps.flows.includes('project')) throw new ProviderNotImplementedError(provider);
    const profile = getProfile(provider);
    if (!profile) throw new ProviderNotImplementedError(provider);

    // Credential input: every profile field required, unknown keys dropped
    const cleaned: Record<string, string> = {};
    for (const field of profile.credentialFields) {
      const value = credentials[field.key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new InvalidCredentialsInputError(`Missing credential: ${field.key}`);
      }
      cleaned[field.key] = value.trim();
    }

    // 2. Run checks in order; a failed blocking check skips the rest
    const report: ValidationReport = { checks: [], canSave: true };
    const run = async (key: string, passes: () => Promise<string> | string, blocked = false) => {
      const def = profile.validationChecks.find((d) => d.key === key)!;
      if (blocked) {
        report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status: 'skipped', detail: '' });
        return false;
      }
      try {
        const detail = await passes();
        report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status: 'pass', detail });
        return true;
      } catch (e) {
        report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status: 'fail', detail: describe(e) });
        if (def.blocking) report.canSave = false;
        return !def.blocking;
      }
    };

    let blocked = false;
    blocked = !(await run('receiver_country', async () => {
      if (!countryAllowed(caps.receiverCountries, project.countryCode)) {
        throw new GatewayCountryNotSupportedError(caps.label, project.countryCode);
      }
      return `${project.countryCode} allowed`;
    }, blocked));

    // key_mode + keys_valid need an adapter — build lazily inside the check
    let adapter: PaymentProvider | null = null;
    const webhookSecret = randomBytes(32).toString('hex');
    blocked = !(await run('key_mode', () => {
      adapter = createProvider(provider, { ...cleaned, webhookSecret }, getPaymentEnvironment());
      return `keys match ${getPaymentEnvironment()} mode`;
    }, blocked));

    await run('keys_valid', async () => {
      if (!(await adapter!.verifyCredentials())) {
        throw new GatewayCredentialsRejectedError(caps.label);
      }
      return 'accepted';
    }, blocked);

    if (!report.canSave || !adapter) {
      return { saved: false, connection: null, report };
    }

    // 4. Encrypt + upsert
    const existing = await this.paymentConnectionDAO.findByProjectAndProvider(projectId, provider, getPaymentEnvironment());
    const id = existing?.id ?? randomUUID();
    const effectiveSecret = existing
      ? ((decryptJson(await this.secretFor(id), getEncryptionKey(), id) as { webhookSecret?: string }).webhookSecret ?? webhookSecret)
      : webhookSecret;
    const credentialsEnc = encryptJson({ ...cleaned, webhookSecret: effectiveSecret }, getEncryptionKey(), id);
    const displayHint = cleaned.keyId.slice(0, 9) + '••••' + cleaned.keyId.slice(-4);

    const connection = await this.paymentConnectionDAO.upsert({
      id,
      projectId,
      provider,
      environment: getPaymentEnvironment(),
      credentialsEnc,
      displayHint,
      isEnabled: true,
      verifiedAt: new Date(),
    });

    // 5–7. Non-blocking checks + persist the report
    await this.finishValidation({ connectionId: id, adapter, profile, projectId, secret: effectiveSecret, report });
    return { saved: true, connection, report };
  }

  private async secretFor(connectionId: string): Promise<string> {
    const row = await this.paymentConnectionDAO.findWithCredentials(connectionId);
    return row?.credentialsEnc ?? '';
  }

  private async finishValidation(input: {
    connectionId: string;
    adapter: PaymentProvider;
    profile: NonNullable<ReturnType<typeof getProfile>>;
    projectId: string;
    secret: string;
    report: ValidationReport;
  }): Promise<void> {
    const { connectionId, adapter, profile, projectId, secret, report } = input;
    const runNonBlocking = async (key: string, passes: () => Promise<string>, warnDetail: () => string) => {
      const def = profile.validationChecks.find((d) => d.key === key)!;
      try {
        const detail = await passes();
        report.checks.push({ key: def.key, label: def.label, blocking: false, status: 'pass', detail });
      } catch {
        report.checks.push({ key: def.key, label: def.label, blocking: false, status: 'warn', detail: warnDetail() });
      }
    };

    await runNonBlocking(
      'subscriptions_available',
      async () => {
        if (!(await adapter.checkSubscriptionsAvailable())) {
          throw new Error('unavailable');
        }
        return 'available';
      },
      () => 'Subscriptions are not enabled on this Razorpay account — recurring offerings won\'t work'
    );

    let webhookRef: string | null = null;
    let webhookActive: boolean | null = null;
    let webhookRegisteredAt: Date | null = null;
    let webhookError: string | null = null;
    const url = this.webhookRegistrationService.urlFor({ kind: 'project', projectId }, adapter.capabilities.key);
    const webhooksDef = profile.validationChecks.find((d) => d.key === 'webhook_registered')!;
    try {
      const result = await this.webhookRegistrationService.ensure({ adapter, profile, url, secret });
      if (result.status === 'registered') {
        webhookRef = result.webhookRef;
        webhookActive = true;
        webhookRegisteredAt = new Date();
        report.checks.push({ key: webhooksDef.key, label: webhooksDef.label, blocking: false, status: 'pass', detail: `Registered · ${result.events.length} events` });
      } else {
        report.checks.push({ key: webhooksDef.key, label: webhooksDef.label, blocking: false, status: 'warn', detail: result.reason });
      }
    } catch (e) {
      webhookError = describe(e);
      report.checks.push({ key: webhooksDef.key, label: webhooksDef.label, blocking: false, status: 'warn', detail: webhookError });
    }

    await this.paymentConnectionDAO.update(connectionId, {
      webhookRef,
      webhookActive,
      webhookRegisteredAt,
      webhookError,
      validationReport: report as unknown as Record<string, unknown> & object,
      validatedAt: new Date(),
    });
  }

  async revalidate(projectId: string, connectionId: string) {
    const row = await this.paymentConnectionDAO.findWithCredentials(connectionId);
    if (!row || row.projectId !== projectId) throw new PaymentConnectionNotFoundError(connectionId);
    const profile = getProfile(row.provider);
    if (!profile) throw new ProviderNotImplementedError(row.provider);
    const creds = decryptJson(row.credentialsEnc, getEncryptionKey(), row.id) as Record<string, string>;
    const adapter = createProvider(row.provider, creds, row.environment);

    const report: ValidationReport = { checks: [], canSave: true };
    const project = await this.projectDAO.findById(projectId);
    const caps = await this.providerSettingsService.getEffectiveCapability(row.provider, 'project');

    // Blocking checks re-run too — reported, but nothing is deleted
    let blocked = false;
    const run = async (key: string, passes: () => Promise<string> | string) => {
      const def = profile.validationChecks.find((d) => d.key === key)!;
      if (blocked) {
        report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status: 'skipped', detail: '' });
        return;
      }
      try {
        const detail = await passes();
        report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status: 'pass', detail });
      } catch (e) {
        report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status: 'fail', detail: describe(e) });
        if (def.blocking) { report.canSave = false; blocked = true; }
      }
    };

    await run('receiver_country', () => {
      if (!project || !countryAllowed(caps.receiverCountries, project.countryCode)) {
        throw new GatewayCountryNotSupportedError(caps.label, project?.countryCode ?? '?');
      }
      return `${project.countryCode} allowed`;
    });
    await run('key_mode', () => `keys match ${row.environment} mode`);
    await run('keys_valid', async () => {
      if (!(await adapter.verifyCredentials())) throw new GatewayCredentialsRejectedError(caps.label);
      return 'accepted';
    });

    if (!blocked) {
      await this.finishValidation({ connectionId, adapter, profile, projectId, secret: creds.webhookSecret!, report });
    } else {
      await this.paymentConnectionDAO.update(connectionId, {
        validationReport: report as unknown as Record<string, unknown> & object,
        validatedAt: new Date(),
      });
    }
    return report;
  }

  async disconnect(projectId: string, connectionId: string) {
    const connection = await this.paymentConnectionDAO.findById(connectionId);
    if (!connection || connection.projectId !== projectId) throw new PaymentConnectionNotFoundError(connectionId);
    const updated = await this.paymentConnectionDAO.update(connectionId, { isEnabled: false });

    if (connection.webhookRef) {
      const profile = getProfile(connection.provider);
      if (profile?.webhook.canDeactivate) {
        try {
          const { adapter, connection: full } = await this.getAdapter(connectionId, { requireEnabled: false });
          const creds = decryptJson((await this.secretFor(connectionId)), getEncryptionKey(), connectionId) as { webhookSecret?: string };
          const url = this.webhookRegistrationService.urlFor({ kind: 'project', projectId }, full.provider);
          await this.webhookRegistrationService.deactivate({
            adapter, profile, webhookRef: connection.webhookRef, url, secret: creds.webhookSecret!,
          });
          await this.paymentConnectionDAO.update(connectionId, { webhookActive: false, webhookError: null });
        } catch (e) {
          await this.paymentConnectionDAO.update(connectionId, { webhookError: describe(e) });
        }
      }
    }
    return updated;
  }

  async getAdapter(connectionId: string, opts: { requireEnabled: boolean }): Promise<{
    connection: { id: string; projectId: string; provider: ProviderKey; environment: string; isEnabled: boolean };
    adapter: PaymentProvider;
  }> {
    const connection = await this.paymentConnectionDAO.findWithCredentials(connectionId);
    if (!connection) throw new PaymentConnectionNotFoundError(connectionId);
    if (opts.requireEnabled && !connection.isEnabled) throw new PaymentConnectionDisabledError(connectionId);
    const creds = decryptJson(connection.credentialsEnc, getEncryptionKey(), connection.id);
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
