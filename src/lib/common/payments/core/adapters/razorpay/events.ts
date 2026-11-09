import { decodeReference } from '../../reference';
import type { NormalizedEvent, NormalizedEventType } from '../../contracts/events';
import type { Money } from '../../contracts/provider';
import { PaymentValidationError } from '../../errors';

interface RazorpayEntity {
  id?: string;
  status?: string;
  order_id?: string;
  receipt?: string;
  amount?: number;
  currency?: string;
  current_start?: number | null;
  current_end?: number | null;
  notes?: Record<string, string>;
}

interface RazorpayWebhookPayload {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
    subscription?: { entity?: RazorpayEntity };
  };
}

const money = (e?: RazorpayEntity): Money | undefined =>
  e?.amount != null && e.currency ? { amountMinor: e.amount, currency: e.currency } : undefined;

/** Maps a verified Razorpay webhook payload to a NormalizedEvent, incl. our reference. */
export function toNormalizedEvent(payload: unknown, headers: Record<string, string>): NormalizedEvent {
  const providerEventId = headers['x-razorpay-event-id'];
  if (!providerEventId) {
    throw new PaymentValidationError('Missing x-razorpay-event-id');
  }

  const body = payload as RazorpayWebhookPayload;
  const rawType = typeof body.event === 'string' ? body.event : '';
  const payment = body.payload?.payment?.entity;
  const order = body.payload?.order?.entity;
  const subscription = body.payload?.subscription?.entity;

  const event: NormalizedEvent = {
    providerEventId,
    rawType,
    type: 'ignored',
    occurredAt: new Date((body.created_at ?? 0) * 1000),
  };

  // Our own record reference — written to receipt (orders) and notes.folio_ref (both)
  event.reference =
    decodeReference(payment?.notes?.folio_ref) ??
    decodeReference(order?.receipt) ??
    decodeReference(order?.notes?.folio_ref) ??
    decodeReference(subscription?.notes?.folio_ref);

  const period =
    subscription?.current_start != null && subscription?.current_end != null
      ? { start: new Date(subscription.current_start * 1000), end: new Date(subscription.current_end * 1000) }
      : undefined;

  switch (rawType) {
    case 'payment.captured':
      event.type = 'payment.succeeded';
      event.orderRef = payment?.order_id;
      event.paymentId = payment?.id;
      event.amount = money(payment);
      break;
    case 'order.paid':
      event.type = 'payment.succeeded';
      event.orderRef = order?.id;
      event.paymentId = payment?.id;
      event.amount = money(payment);
      break;
    case 'payment.failed':
      event.type = 'payment.failed';
      event.orderRef = payment?.order_id;
      event.paymentId = payment?.id;
      break;
    case 'subscription.activated':
      event.type = 'subscription.activated';
      event.subscriptionRef = subscription?.id;
      if (period) event.subscriptionPeriod = period;
      break;
    case 'subscription.charged':
      event.type = 'subscription.charged';
      event.subscriptionRef = subscription?.id;
      event.paymentId = payment?.id;
      event.amount = money(payment);
      if (period) event.subscriptionPeriod = period;
      break;
    case 'subscription.cancelled':
    case 'subscription.halted':
    case 'subscription.completed':
      event.type = rawType as NormalizedEventType;
      event.subscriptionRef = subscription?.id;
      break;
    default:
      event.type = 'ignored';
  }

  return event;
}
