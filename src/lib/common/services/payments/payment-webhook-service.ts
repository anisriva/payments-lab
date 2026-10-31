import type { PrismaClient } from '@/generated/prisma';
import { ProviderEventDAO } from '@/lib/common/dao/payments/provider-event-dao';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import { getPlatformProvider } from './payment-config';
import { PaymentValidationError } from '@/lib/common/payments/core/errors';
import type { ProviderKey } from '@/lib/common/payments/core/types';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { ProviderEventNotFoundError } from './errors';
import type { PaginationInput } from '@/types/common/pagination';
import type { PaymentProvider } from '@/generated/prisma';

export class PaymentWebhookService {
  private providerEventDAO: ProviderEventDAO;
  private platformPaymentService: PlatformPaymentService;

  constructor(private readonly prisma: PrismaClient) {
    this.providerEventDAO = new ProviderEventDAO(prisma);
    this.platformPaymentService = new PlatformPaymentService(prisma);
  }

  async ingest(input: {
    provider: ProviderKey;
    connectionId?: string;
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<'processed' | 'duplicate'> {
    const { provider, connectionId, rawBody, headers } = input;

    // 1. Build the adapter
    if (connectionId) {
      throw new PaymentValidationError('BYOP webhooks not enabled yet');
    }
    const adapter = getPlatformProvider(provider);

    // 2. Verify + normalise — no DB access before this line for platform scope
    const event = adapter.parseWebhook(rawBody, headers);

    // 3. Scope
    const scope = connectionId ?? 'platform';

    // 4. Dedupe
    const existing = await this.providerEventDAO.findByProviderEventId(provider, scope, event.providerEventId);
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
      const note = await this.platformPaymentService.applyEvent(event);
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
    const adapter = getPlatformProvider(row.provider);
    const event = adapter.parseWebhook(row.rawBody, row.headers as Record<string, string>);
    try {
      const note = await this.platformPaymentService.applyEvent(event);
      await this.providerEventDAO.markProcessed(row.id, note);
    } catch (e) {
      await this.providerEventDAO.markFailed(row.id, e instanceof Error ? e.message : 'Unknown error');
      throw e;
    }
  }

  async listEvents(options: { provider?: PaymentProvider; scope?: string; pagination?: PaginationInput }) {
    return this.providerEventDAO.list({ pagination: options.pagination, filters: { provider: options.provider, scope: options.scope } });
  }

  async getEvent(id: string) {
    const event = await this.providerEventDAO.findById(id);
    if (!event) throw new ProviderEventNotFoundError(id);
    return event;
  }
}
