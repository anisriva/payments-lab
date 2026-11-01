import type { PrismaClient } from '@/generated/prisma';
import { ProviderEventDAO } from '@/lib/common/dao/payments/provider-event-dao';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import { getCapabilities, isProviderKey } from '@/lib/common/payments/core/factory';
import { getPlatformProvider } from './payment-config';
import type { ProviderKey } from '@/lib/common/payments/core/types';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import { PaymentConnectionService } from '@/lib/project/services/payments/payment-connection-service';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { PaymentConnectionDAO } from '@/lib/project/dao/payments/payment-connection-dao';
import { getPaymentEnvironment } from './payment-config';
import { PaymentConnectionNotFoundError } from '@/lib/project/services/payments/errors';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import { ProviderEventNotFoundError, UnsupportedWebhookProviderError } from './errors';
import type { PaginationInput } from '@/types/common/pagination';
import type { PaymentProvider } from '@/generated/prisma';

export type WebhookTarget = { kind: 'platform' } | { kind: 'project'; projectId: string };

export class PaymentWebhookService {
  private providerEventDAO: ProviderEventDAO;
  private platformPaymentService: PlatformPaymentService;
  private projectPaymentService: ProjectPaymentService;
  private paymentConnectionService: PaymentConnectionService;
  private projectDAO: ProjectDAO;
  private connectionDAO: PaymentConnectionDAO;

  constructor(private readonly prisma: PrismaClient) {
    this.providerEventDAO = new ProviderEventDAO(prisma);
    this.platformPaymentService = new PlatformPaymentService(prisma);
    this.projectPaymentService = new ProjectPaymentService(prisma);
    this.paymentConnectionService = new PaymentConnectionService(prisma);
    this.projectDAO = new ProjectDAO(prisma);
    this.connectionDAO = new PaymentConnectionDAO(prisma);
  }

  async ingest(input: {
    provider: string;
    target: WebhookTarget;
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<'processed' | 'duplicate'> {
    const { provider, target, rawBody, headers } = input;

    // 1. Provider must be implemented and serve this target's flow
    const flow = target.kind;
    if (!isProviderKey(provider)) throw new UnsupportedWebhookProviderError(provider);
    const caps = getCapabilities(provider);
    if (!caps.implemented || !caps.flows.includes(flow)) {
      throw new UnsupportedWebhookProviderError(provider);
    }

    // 2. Resolve adapter and scope (documented exception: DB reads before signature verification)
    let adapter;
    let scope: string;
    if (target.kind === 'platform') {
      adapter = getPlatformProvider(provider);
      scope = 'platform';
    } else {
      const project = await this.projectDAO.findById(target.projectId);
      if (!project) throw new ProjectNotFoundError(target.projectId);
      const connection = await this.connectionDAO.findByProjectAndProvider(target.projectId, provider, getPaymentEnvironment());
      if (!connection) throw new PaymentConnectionNotFoundError(`${target.projectId}/${provider}`);
      adapter = (await this.paymentConnectionService.getAdapter(connection.id, { requireEnabled: false })).adapter;
      scope = connection.id;
    }

    // 3. Verify + normalise
    const event = adapter.parseWebhook(rawBody, headers);

    // 4. Dedupe
    const existing = await this.providerEventDAO.findByProviderEventId(provider as ProviderKey, scope, event.providerEventId);
    if (existing?.processedAt) return 'duplicate';

    // 5. Create the row if not found
    let row = existing;
    if (!row) {
      try {
        row = await this.providerEventDAO.create({
          provider,
          scope,
          providerEventId: event.providerEventId,
          eventType: event.rawType,
          headers,
          rawBody,
        });
      } catch (e) {
        if (e instanceof UniqueConstraintException) {
          row = await this.providerEventDAO.findByProviderEventId(provider, scope, event.providerEventId);
          if (!row) throw e;
          if (row.processedAt) return 'duplicate';
        } else {
          throw e;
        }
      }
    }

    // 6. Apply
    try {
      const note = target.kind === 'project'
        ? await this.projectPaymentService.applyEvent(event, scope)
        : await this.platformPaymentService.applyEvent(event);
      await this.providerEventDAO.markProcessed(row.id, note);
      return 'processed';
    } catch (e) {
      await this.providerEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  async reprocess(eventId: string): Promise<void> {
    const row = await this.providerEventDAO.findById(eventId);
    if (!row) throw new ProviderEventNotFoundError(eventId);
    let adapter;
    if (row.scope !== 'platform') {
      const result = await this.paymentConnectionService.getAdapter(row.scope, { requireEnabled: false });
      adapter = result.adapter;
    } else {
      adapter = getPlatformProvider(row.provider);
    }
    const event = adapter.parseWebhook(row.rawBody, row.headers as Record<string, string>);
    try {
      const note = row.scope !== 'platform'
        ? await this.projectPaymentService.applyEvent(event, row.scope)
        : await this.platformPaymentService.applyEvent(event);
      await this.providerEventDAO.markProcessed(row.id, note);
    } catch (e) {
      await this.providerEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  async listEvents(options: { provider?: PaymentProvider; scope?: string; scopes?: string[]; excludeScope?: string; pagination?: PaginationInput }) {
    return this.providerEventDAO.list({ pagination: options.pagination, filters: { provider: options.provider, scope: options.scope, scopes: options.scopes, excludeScope: options.excludeScope } });
  }

  async getEvent(id: string) {
    const event = await this.providerEventDAO.findById(id);
    if (!event) throw new ProviderEventNotFoundError(id);
    return event;
  }
}
