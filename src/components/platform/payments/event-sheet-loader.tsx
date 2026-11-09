import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { EventSheet } from './event-sheet';

export async function EventSheetLoader({ id, audience = 'platform' }: { id: string; audience?: 'platform' | 'project' }) {
  const service = new PaymentWebhookService(prisma);
  const event = await (audience === 'project' ? service.getProjectEvent(id) : service.getPlatformEvent(id)).catch(() => null);
  if (!event) return null;
  return (
    <EventSheet
      event={{
        id: event.id,
        provider: event.provider,
        scope: ('connectionId' in event ? event.connectionId : 'platform') as string,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        headers: event.headers,
        rawBody: event.rawBody,
        processedAt: event.processedAt?.toISOString() ?? null,
        note: event.note,
        error: event.error,
        receivedAt: event.receivedAt.toISOString(),
      }}
    />
  );
}
