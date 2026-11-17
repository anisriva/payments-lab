import { decodeReference } from '../../reference';
import type { NormalizedEvent } from '../../contracts/events';
import { PaymentValidationError } from '../../errors';

interface DodoServicePeriod {
  starts_at?: string;
  ends_at?: string;
}

interface DodoEventData {
  payment_id?: string;
  checkout_session_id?: string;
  subscription_id?: string | null;
  settlement_amount?: number;
  settlement_tax?: number;
  settlement_currency?: string;
  previous_billing_date?: string;
  next_billing_date?: string;
  service_periods?: DodoServicePeriod[];
  metadata?: Record<string, string>;
}

interface DodoWebhookPayload {
  type?: string;
  timestamp?: string;
  data?: DodoEventData;
}

/** Maps a verified Dodo webhook envelope to a NormalizedEvent, incl. our reference (IMPL-DODO §1.6). */
export function toNormalizedEvent(payload: unknown, headers: Record<string, string>): NormalizedEvent {
  const providerEventId = headers['webhook-id'];
  if (!providerEventId) {
    throw new PaymentValidationError('Missing webhook-id');
  }

  const body = payload as DodoWebhookPayload;
  const data = body.data ?? {};

  const event: NormalizedEvent = {
    providerEventId,
    rawType: typeof body.type === 'string' ? body.type : '',
    type: 'ignored',
    occurredAt: new Date(typeof body.timestamp === 'string' ? body.timestamp : 0),
    reference: decodeReference(data.metadata?.folio_ref),
  };

  // Net settlement: what the merchant actually receives, tax excluded (§1.8)
  const amount =
    data.settlement_amount != null && data.settlement_currency
      ? { amountMinor: data.settlement_amount - (data.settlement_tax ?? 0), currency: data.settlement_currency }
      : undefined;

  // Subscription payloads carry previous/next billing dates; payment payloads carry service_periods
  let period: { start: Date; end: Date } | undefined;
  if (data.previous_billing_date && data.next_billing_date) {
    period = { start: new Date(data.previous_billing_date), end: new Date(data.next_billing_date) };
  } else {
    const sp = data.service_periods?.[0];
    if (sp?.starts_at && sp?.ends_at) {
      period = { start: new Date(sp.starts_at), end: new Date(sp.ends_at) };
    }
  }

  switch (event.rawType) {
    case 'payment.succeeded':
      event.paymentId = data.payment_id;
      event.amount = amount;
      if (data.subscription_id) {
        event.type = 'subscription.charged';
        event.subscriptionRef = data.subscription_id;
        if (period) event.subscriptionPeriod = period;
      } else {
        event.type = 'payment.succeeded';
        event.orderRef = data.checkout_session_id;
      }
      break;
    case 'payment.failed':
      // subscription_id set → ignored: renewal failures arrive as subscription.on_hold / past_due
      if (!data.subscription_id) {
        event.type = 'payment.failed';
        event.orderRef = data.checkout_session_id;
        event.paymentId = data.payment_id;
      }
      break;
    case 'subscription.active':
      event.type = 'subscription.activated';
      event.subscriptionRef = data.subscription_id ?? undefined;
      if (period) event.subscriptionPeriod = period;
      break;
    case 'subscription.renewed':
      event.type = 'subscription.charged';
      event.subscriptionRef = data.subscription_id ?? undefined;
      if (period) event.subscriptionPeriod = period;
      break; // no amount — the ledger row comes from payment.succeeded
    case 'subscription.on_hold':
    case 'subscription.past_due':
      event.type = 'subscription.halted';
      event.subscriptionRef = data.subscription_id ?? undefined;
      break;
    case 'subscription.cancelled':
      event.type = 'subscription.cancelled';
      event.subscriptionRef = data.subscription_id ?? undefined;
      break;
    case 'subscription.expired':
      event.type = 'subscription.completed';
      event.subscriptionRef = data.subscription_id ?? undefined;
      break;
    default: // subscription.failed and everything else — a failed attempt is not the end of the session
      event.type = 'ignored';
  }

  return event;
}
