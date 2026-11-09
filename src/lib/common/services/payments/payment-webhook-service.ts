import type { PrismaClient } from '@/generated/prisma';
import { PlatformProviderEventDAO } from '@/lib/platform/dao/payments/platform-provider-event-dao';
import { ProjectProviderEventDAO } from '@/lib/project/dao/payments/project-provider-event-dao';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import { getManifest, isProviderKey } from '@/lib/common/payments/core/registry.server';
import { getPlatformProvider } from './payment-config';
import { getPaymentEnvironment } from '@/config/payments/env';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';
import type { PaymentProvider } from '@/lib/common/payments/core/contracts/provider';
import type { PaymentProvider as DbProvider } from '@/generated/prisma';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import { ProjectPaymentConnectionService } from '@/lib/project/services/payments/project-payment-connection-service';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { ProjectPaymentConnectionDAO } from '@/lib/project/dao/payments/project-payment-connection-dao';
import { PaymentConnectionNotFoundError } from '@/lib/project/services/payments/errors';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import { ProviderEventNotFoundError, UnsupportedWebhookProviderError } from './errors';
import type { PaginationInput } from '@/types/common/pagination';

export type WebhookTarget = { kind: 'platform' } | { kind: 'project'; projectId: string };

export function webhookUrlFor(target: WebhookTarget, provider: ProviderKey, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return target.kind === 'platform'
    ? `${base}/api/webhooks/platform/${provider}`
    : `${base}/api/webhooks/project/${target.projectId}/${provider}`;
}

export class PaymentWebhookService {
  private platformEventDAO: PlatformProviderEventDAO;
  private projectEventDAO: ProjectProviderEventDAO;
  private platformPaymentService: PlatformPaymentService;
  private projectPaymentService: ProjectPaymentService;
  private connectionService: ProjectPaymentConnectionService;
  private projectDAO: ProjectDAO;
  private connectionDAO: ProjectPaymentConnectionDAO;

  constructor(private readonly prisma: PrismaClient) {
    this.platformEventDAO = new PlatformProviderEventDAO(prisma);
    this.projectEventDAO = new ProjectProviderEventDAO(prisma);
    this.platformPaymentService = new PlatformPaymentService(prisma);
    this.projectPaymentService = new ProjectPaymentService(prisma);
    this.connectionService = new ProjectPaymentConnectionService(prisma);
    this.projectDAO = new ProjectDAO(prisma);
    this.connectionDAO = new ProjectPaymentConnectionDAO(prisma);
  }

  async ingest(input: {
    provider: string;
    target: WebhookTarget;
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<'processed' | 'duplicate'> {
    const { provider, target, rawBody, headers } = input;

    // 1. Unknown provider or wrong audience → 404 upstream
    const flow = target.kind;
    if (!isProviderKey(provider)) throw new UnsupportedWebhookProviderError(provider);
    const manifest = getManifest(provider);
    if (!manifest.audiences.includes(flow)) {
      throw new UnsupportedWebhookProviderError(provider);
    }

    // 2. Resolve adapter + event scope (documented exception: DB reads before signature check)
    let adapter: PaymentProvider;
    let connectionId: string | null = null;
    if (target.kind === 'platform') {
      adapter = getPlatformProvider(provider);
    } else {
      const project = await this.projectDAO.findById(target.projectId);
      if (!project) throw new ProjectNotFoundError(target.projectId);
      const connection = await this.connectionDAO.findByProjectAndProvider(
        target.projectId, provider, getPaymentEnvironment(),
      );
      if (!connection) throw new PaymentConnectionNotFoundError(`${target.projectId}/${provider}`);
      adapter = (await this.connectionService.getAdapter(connection.id, { requireEnabled: false })).adapter;
      connectionId = connection.id;
    }

    // 3. Verify + normalise (bad signature → throws, nothing stored)
    const event = adapter.parseWebhook(rawBody, headers);

    // 4–6. Dedupe, store, apply
    return target.kind === 'platform'
      ? this.ingestPlatformEvent(provider as DbProvider, event, { headers, rawBody })
      : this.ingestProjectEvent(provider as DbProvider, connectionId!, event, { headers, rawBody });
  }

  private async ingestPlatformEvent(
    provider: DbProvider,
    event: ReturnType<PaymentProvider['parseWebhook']>,
    raw: { headers: Record<string, string>; rawBody: string },
  ): Promise<'processed' | 'duplicate'> {
    const existing = await this.platformEventDAO.findByProviderEventId(provider, event.providerEventId);
    if (existing?.processedAt) return 'duplicate';

    let row = existing;
    if (!row) {
      try {
        row = await this.platformEventDAO.create({
          provider,
          providerEventId: event.providerEventId,
          eventType: event.rawType,
          headers: raw.headers,
          rawBody: raw.rawBody,
        });
      } catch (e) {
        if (e instanceof UniqueConstraintException) {
          row = await this.platformEventDAO.findByProviderEventId(provider, event.providerEventId);
          if (!row) throw e;
          if (row.processedAt) return 'duplicate';
        } else {
          throw e;
        }
      }
    }

    try {
      const note = await this.platformPaymentService.applyEvent(event);
      await this.platformEventDAO.markProcessed(row.id, note);
      return 'processed';
    } catch (e) {
      await this.platformEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  private async ingestProjectEvent(
    provider: DbProvider,
    connectionId: string,
    event: ReturnType<PaymentProvider['parseWebhook']>,
    raw: { headers: Record<string, string>; rawBody: string },
  ): Promise<'processed' | 'duplicate'> {
    const existing = await this.projectEventDAO.findByProviderEventId(provider, connectionId, event.providerEventId);
    if (existing?.processedAt) return 'duplicate';

    let row = existing;
    if (!row) {
      try {
        row = await this.projectEventDAO.create({
          provider,
          connectionId,
          providerEventId: event.providerEventId,
          eventType: event.rawType,
          headers: raw.headers,
          rawBody: raw.rawBody,
        });
      } catch (e) {
        if (e instanceof UniqueConstraintException) {
          row = await this.projectEventDAO.findByProviderEventId(provider, connectionId, event.providerEventId);
          if (!row) throw e;
          if (row.processedAt) return 'duplicate';
        } else {
          throw e;
        }
      }
    }

    try {
      const note = await this.projectPaymentService.applyEvent(event, connectionId);
      await this.projectEventDAO.markProcessed(row.id, note);
      return 'processed';
    } catch (e) {
      await this.projectEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  async reprocessPlatformEvent(eventId: string): Promise<void> {
    const row = await this.platformEventDAO.findById(eventId);
    if (!row) throw new ProviderEventNotFoundError(eventId);
    const adapter = getPlatformProvider(row.provider);
    const event = adapter.parseWebhook(row.rawBody, row.headers as Record<string, string>);
    try {
      const note = await this.platformPaymentService.applyEvent(event);
      await this.platformEventDAO.markProcessed(row.id, note);
    } catch (e) {
      await this.platformEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  async reprocessProjectEvent(eventId: string): Promise<void> {
    const row = await this.projectEventDAO.findById(eventId);
    if (!row) throw new ProviderEventNotFoundError(eventId);
    const { adapter } = await this.connectionService.getAdapter(row.connectionId, { requireEnabled: false });
    const event = adapter.parseWebhook(row.rawBody, row.headers as Record<string, string>);
    try {
      const note = await this.projectPaymentService.applyEvent(event, row.connectionId);
      await this.projectEventDAO.markProcessed(row.id, note);
    } catch (e) {
      await this.projectEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  async listPlatformEvents(options: { provider?: DbProvider; pagination?: PaginationInput }) {
    return this.platformEventDAO.list({ pagination: options.pagination, filters: { provider: options.provider } });
  }

  async listProjectEvents(options: { provider?: DbProvider; connectionId?: string; connectionIds?: string[]; pagination?: PaginationInput }) {
    return this.projectEventDAO.list({
      pagination: options.pagination,
      filters: { provider: options.provider, connectionId: options.connectionId, connectionIds: options.connectionIds },
    });
  }

  async getPlatformEvent(id: string) {
    const event = await this.platformEventDAO.findById(id);
    if (!event) throw new ProviderEventNotFoundError(id);
    return event;
  }

  async getProjectEvent(id: string) {
    const event = await this.projectEventDAO.findById(id);
    if (!event) throw new ProviderEventNotFoundError(id);
    return event;
  }
}
