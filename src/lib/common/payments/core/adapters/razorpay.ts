import Razorpay from 'razorpay';
import { hmacSha256Hex, safeEqual } from '../crypto-utils';
import { PaymentValidationError } from '../errors';
import { BasePaymentProvider } from '../provider';
import type {
  ClientConfirmation,
  CheckoutStart,
  EnsureProductInput,
  NormalizedEvent,
  NormalizedEventType,
  OneTimeCheckoutInput,
  PaymentEnvironment,
  PaymentStatusResult,
  ProviderCapabilities,
  SubscriptionCheckoutInput,
  SubscriptionStatus,
  SubscriptionStatusResult,
} from '../types';

export const RAZORPAY_CAPABILITIES: ProviderCapabilities = {
  key: 'razorpay',
  label: 'Razorpay',
  implemented: true,
  flows: ['platform', 'project'],
  receiverCountries: ['IN'],
  payerCountries: ['IN'],
  supportsSubscriptions: true,
  supportsCustomAmount: true,
};

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export function parseRazorpayCredentials(value: unknown): RazorpayCredentials {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RazorpayCredentials).keyId === 'string' &&
    typeof (value as RazorpayCredentials).keySecret === 'string' &&
    typeof (value as RazorpayCredentials).webhookSecret === 'string' &&
    (value as RazorpayCredentials).keyId.length > 0 &&
    (value as RazorpayCredentials).keySecret.length > 0 &&
    (value as RazorpayCredentials).webhookSecret.length > 0
  ) {
    return value as RazorpayCredentials;
  }
  throw new PaymentValidationError('Invalid Razorpay credentials');
}

interface RazorpayEntity {
  id?: string;
  status?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  current_start?: number | null;
  current_end?: number | null;
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

export class RazorpayProvider extends BasePaymentProvider {
  readonly capabilities = RAZORPAY_CAPABILITIES;
  private readonly razorpay: Razorpay;

  constructor(
    private readonly credentials: RazorpayCredentials,
    private readonly environment: PaymentEnvironment
  ) {
    super();
    if (environment === 'test' && !credentials.keyId.startsWith('rzp_test_')) {
      throw new PaymentValidationError('test environment requires rzp_test_ keys');
    }
    if (environment === 'live' && !credentials.keyId.startsWith('rzp_live_')) {
      throw new PaymentValidationError('live environment requires rzp_live_ keys');
    }
    this.razorpay = new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
  }

  protected async doCreateOneTimeCheckout(input: OneTimeCheckoutInput): Promise<CheckoutStart> {
    const order = await this.razorpay.orders.create({
      amount: input.amount.amountMinor,
      currency: input.amount.currency,
      receipt: input.receipt,
      notes: input.notes,
    });
    return {
      providerRef: order.id,
      instruction: {
        kind: 'razorpay_modal',
        options: {
          key: this.credentials.keyId,
          name: 'Payments Lab',
          description: input.description,
          order_id: order.id,
          amount: input.amount.amountMinor,
          currency: input.amount.currency,
          prefill: { email: input.buyerEmail },
          notes: input.notes,
        },
      },
    };
  }

  protected async doEnsureProduct(input: EnsureProductInput): Promise<{ providerRef: string }> {
    const plan = await this.razorpay.plans.create({
      period: input.interval,
      interval: 1,
      item: {
        name: input.name,
        amount: input.amount.amountMinor,
        currency: input.amount.currency,
      },
    });
    return { providerRef: plan.id };
  }

  protected async doCreateSubscription(input: SubscriptionCheckoutInput): Promise<CheckoutStart> {
    const sub = await this.razorpay.subscriptions.create({
      plan_id: input.productRef,
      total_count: input.totalCycles,
      quantity: 1,
      customer_notify: 1,
      notes: input.notes,
    });
    return {
      providerRef: sub.id,
      instruction: {
        kind: 'razorpay_modal',
        options: {
          key: this.credentials.keyId,
          name: 'Payments Lab',
          description: input.description,
          subscription_id: sub.id,
          prefill: { email: input.buyerEmail },
          notes: input.notes,
        },
      },
    };
  }

  protected async doCancelSubscription(subscriptionRef: string, opts: { atCycleEnd: boolean }): Promise<void> {
    await this.razorpay.subscriptions.cancel(subscriptionRef, opts.atCycleEnd);
  }

  protected async doGetPaymentStatus(orderRef: string): Promise<PaymentStatusResult> {
    const order = await this.razorpay.orders.fetch(orderRef);
    const payments = await this.razorpay.orders.fetchPayments(orderRef);
    const items = (payments as { items?: Array<{ id: string; status: string }> }).items ?? [];

    const captured = items.find((item) => item.status === 'captured');
    if (captured) {
      return { status: 'paid', paymentId: captured.id };
    }
    if (order.status === 'paid') {
      return { status: 'paid' };
    }
    if (items.length > 0 && items.every((item) => item.status === 'failed')) {
      return { status: 'failed' };
    }
    return { status: 'pending' };
  }

  protected async doGetSubscriptionStatus(subscriptionRef: string): Promise<SubscriptionStatusResult> {
    const sub = await this.razorpay.subscriptions.fetch(subscriptionRef);
    const status = this.mapSubscriptionStatus(sub.status);
    const result: SubscriptionStatusResult = { status };
    if (sub.current_start != null) {
      result.currentPeriodStart = new Date(sub.current_start * 1000);
    }
    if (sub.current_end != null) {
      result.currentPeriodEnd = new Date(sub.current_end * 1000);
    }
    return result;
  }

  protected doVerifyClientConfirmation(c: ClientConfirmation): boolean {
    const data =
      c.kind === 'order'
        ? `${c.providerRef}|${c.paymentId}`
        : `${c.paymentId}|${c.providerRef}`;
    return safeEqual(hmacSha256Hex(this.credentials.keySecret, data), c.signature);
  }

  protected async doVerifyCredentials(): Promise<void> {
    await this.razorpay.orders.all({ count: 1 });
  }

  protected verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const sig = headers['x-razorpay-signature'];
    return !!sig && safeEqual(hmacSha256Hex(this.credentials.webhookSecret, rawBody), sig);
  }

  protected toNormalizedEvent(payload: unknown, headers: Record<string, string>): NormalizedEvent {
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

    const period =
      subscription?.current_start != null && subscription?.current_end != null
        ? { start: new Date(subscription.current_start * 1000), end: new Date(subscription.current_end * 1000) }
        : undefined;

    switch (rawType) {
      case 'payment.captured':
        event.type = 'payment.succeeded';
        event.orderRef = payment?.order_id;
        event.paymentId = payment?.id;
        if (payment?.amount != null && payment?.currency) {
          event.amount = { amountMinor: payment.amount, currency: payment.currency };
        }
        break;
      case 'order.paid':
        event.type = 'payment.succeeded';
        event.orderRef = order?.id;
        event.paymentId = payment?.id;
        if (payment?.amount != null && payment?.currency) {
          event.amount = { amountMinor: payment.amount, currency: payment.currency };
        }
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
        if (payment?.amount != null && payment?.currency) {
          event.amount = { amountMinor: payment.amount, currency: payment.currency };
        }
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

  private mapSubscriptionStatus(status: string): SubscriptionStatus {
    switch (status) {
      case 'created':
      case 'authenticated':
      case 'pending':
        return 'pending';
      case 'active':
        return 'active';
      case 'halted':
      case 'paused':
        return 'halted';
      case 'cancelled':
        return 'cancelled';
      case 'completed':
      case 'expired':
        return 'completed';
      default:
        return 'pending';
    }
  }
}
