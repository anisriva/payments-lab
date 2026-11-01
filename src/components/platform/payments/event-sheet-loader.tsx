import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { EventSheet } from './event-sheet';

export async function EventSheetLoader({ id }: { id: string }) {
  const service = new PaymentWebhookService(prisma);
  const event = await service.getEvent(id).catch(() => null);
  if (!event) return null;
  return (
    <EventSheet
      event={{
        id: event.id,
        provider: event.provider,
        scope: event.scope,
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
