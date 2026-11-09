import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BasePaymentProvider } from '../../base-provider';
import { encodeReference } from '../../reference';
import { toNormalizedEvent } from './events';
import { RAZORPAY_MANIFEST } from './manifest';
import { RAZORPAY_CREDENTIALS, type RazorpayCredentials } from './credentials';
import type {
  ClientConfirmation,
  CredentialCheck,
  OneTimeCheckoutInput,
  PaymentEnvironment,
  PaymentStatusResult,
  ProviderWebhook,
  SubscriptionCheckoutInput,
  SubscriptionPlanInput,
  SubscriptionStatus,
  SubscriptionStatusResult,
  WebhookInput,
} from '../../contracts/provider';
import type { CheckoutStart } from '../../contracts/checkout';

function hmacSha256Hex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export class RazorpayProvider extends BasePaymentProvider {
  readonly manifest = RAZORPAY_MANIFEST;
  private readonly credentials: RazorpayCredentials;
  private readonly razorpay: Razorpay;

  constructor(credentials: unknown, private readonly environment: PaymentEnvironment) {
    super();
    this.credentials = RAZORPAY_CREDENTIALS.runtime.parse(credentials); // validated, never cast
    this.razorpay = new Razorpay({ key_id: this.credentials.keyId, key_secret: this.credentials.keySecret });
  }

  protected async doVerifyCredentials(): Promise<CredentialCheck> {
    const prefix = this.environment === 'test' ? 'rzp_test_' : 'rzp_live_';
    if (!this.credentials.keyId.startsWith(prefix)) {
      return {
        valid: false,
        reason: 'wrong_mode',
        detail: `${this.environment} environment requires ${prefix} keys`,
      };
    }
    try {
      await this.razorpay.orders.all({ count: 1 });
      return { valid: true };
    } catch (e) {
      const statusCode = (e as { statusCode?: unknown })?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        return { valid: false, reason: 'invalid_credentials', detail: 'Razorpay rejected the credentials' };
      }
      throw e; // outages are thrown, never reported as invalid credentials
    }
  }

  protected verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const sig = headers['x-razorpay-signature'];
    return !!sig && safeEqual(hmacSha256Hex(this.credentials.webhookSecret, rawBody), sig);
  }

  protected toNormalizedEvent(payload: unknown, headers: Record<string, string>) {
    return toNormalizedEvent(payload, headers);
  }

  protected async doCreateOneTimeCheckout(input: OneTimeCheckoutInput): Promise<CheckoutStart> {
    const ref = encodeReference(input.reference);
    const notes = { folio_ref: ref, ...contextNotes(input.context) };
    const order = await this.razorpay.orders.create({
      amount: input.amount.amountMinor,
      currency: input.amount.currency,
      receipt: ref,               // ≤ 40 chars
      notes,
    });
    return {
      providerRef: order.id,
      instruction: {
        kind: 'modal',
        options: {
          key: this.credentials.keyId,
          name: 'Payments Lab',
          description: input.description,
          order_id: order.id,
          amount: input.amount.amountMinor,
          currency: input.amount.currency,
          prefill: { email: input.buyer?.email, name: input.buyer?.name },
          notes,
        },
      },
    };
  }

  protected async doConfirmClientPayment(input: { providerRef: string; payload: unknown }): Promise<ClientConfirmation> {
    const parsed = RAZORPAY_CLIENT_CONFIRMATION.safeParse(input.payload);
    if (!parsed.success) return { confirmed: false };
    const { paymentId, signature, kind } = parsed.data;
    const data = kind === 'subscription'
      ? `${paymentId}|${input.providerRef}`
      : `${input.providerRef}|${paymentId}`;
    return safeEqual(hmacSha256Hex(this.credentials.keySecret, data), signature)
      ? { confirmed: true, paymentId }
      : { confirmed: false };
  }

  protected async doGetPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    const order = await this.razorpay.orders.fetch(providerRef);
    const payments = await this.razorpay.orders.fetchPayments(providerRef);
    const items = (payments as { items?: Array<{ id: string; status: string }> }).items ?? [];

    const captured = items.find((item) => item.status === 'captured');
    if (captured) return { status: 'paid', paymentId: captured.id };
    if (order.status === 'paid') return { status: 'paid' };
    if (items.length > 0 && items.every((item) => item.status === 'failed')) return { status: 'failed' };
    return { status: 'pending' };
  }

  protected async doCreateSubscriptionPlan(input: SubscriptionPlanInput): Promise<{ providerRef: string }> {
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
    const ref = encodeReference(input.reference);
    const notes = { folio_ref: ref, ...contextNotes(input.context) };
    const sub = await this.razorpay.subscriptions.create({
      plan_id: input.planRef,
      total_count: input.totalCycles,
      quantity: 1,
      customer_notify: 1,
      notes,
    });
    return {
      providerRef: sub.id,
      instruction: {
        kind: 'modal',
        options: {
          key: this.credentials.keyId,
          name: 'Payments Lab',
          description: input.description,
          subscription_id: sub.id,
          prefill: { email: input.buyer?.email, name: input.buyer?.name },
          notes,
        },
      },
    };
  }

  protected async doGetSubscriptionStatus(providerRef: string): Promise<SubscriptionStatusResult> {
    const sub = await this.razorpay.subscriptions.fetch(providerRef);
    const result: SubscriptionStatusResult = { status: mapSubscriptionStatus(sub.status) };
    if (sub.current_start != null) result.currentPeriodStart = new Date(sub.current_start * 1000);
    if (sub.current_end != null) result.currentPeriodEnd = new Date(sub.current_end * 1000);
    return result;
  }

  protected async doCancelSubscription(providerRef: string, opts: { atPeriodEnd: boolean }): Promise<void> {
    await this.razorpay.subscriptions.cancel(providerRef, opts.atPeriodEnd);
  }

  protected async doCheckSubscriptionsAvailable(): Promise<boolean> {
    try {
      await this.razorpay.plans.all({ count: 1 });
      return true;
    } catch (e) {
      const statusCode = (e as { statusCode?: unknown })?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) return false;
      throw e;
    }
  }

  // ── Webhook management (merchant-context endpoints, undocumented — fetch, not the SDK) ──

  private webhookAuth(): string {
    return 'Basic ' + Buffer.from(`${this.credentials.keyId}:${this.credentials.keySecret}`).toString('base64');
  }

  private async webhookRequest<T>(method: string, path = '', body?: unknown): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1/webhooks${path}`, {
      method,
      headers: { Authorization: this.webhookAuth(), 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const description = (json as { error?: { description?: string } } | null)?.error?.description ?? `HTTP ${res.status}`;
      throw { statusCode: res.status, error: { description } };
    }
    return json as T;
  }

  private toProviderWebhook(item: unknown): ProviderWebhook {
    const w = item as { id: string; url: string; active: boolean; events: Record<string, boolean> };
    return {
      id: w.id,
      url: w.url,
      active: w.active,
      events: Object.entries(w.events ?? {}).filter(([, v]) => v).map(([k]) => k),
    };
  }

  protected async doListWebhooks(): Promise<ProviderWebhook[]> {
    const items: unknown[] = [];
    let skip = 0;
    for (;;) {
      const res = await this.webhookRequest<{ items?: unknown[] }>('GET', `?count=100&skip=${skip}`);
      const page = res.items ?? [];
      items.push(...page);
      if (page.length < 100) break;
      skip += page.length;
    }
    return items.map((i) => this.toProviderWebhook(i));
  }

  protected async doCreateWebhook(input: WebhookInput): Promise<ProviderWebhook> {
    const res = await this.webhookRequest<unknown>('POST', '', {
      url: input.url,
      secret: input.secret,
      active: true,
      events: Object.fromEntries(input.events.map((e) => [e, true])),
    });
    return this.toProviderWebhook(res);
  }

  protected async doUpdateWebhook(id: string, input: WebhookInput & { active: boolean }): Promise<ProviderWebhook> {
    const res = await this.webhookRequest<unknown>('PUT', `/${id}`, {
      url: input.url,
      secret: input.secret,
      active: input.active,
      events: Object.fromEntries(input.events.map((e) => [e, true])),
    });
    return this.toProviderWebhook(res);
  }
}

import { z } from 'zod';
const RAZORPAY_CLIENT_CONFIRMATION = z.object({
  paymentId: z.string(),
  signature: z.string(),
  kind: z.enum(['order', 'subscription']).default('order'),
});

function contextNotes(context?: { projectId?: string; platformUserId?: string; sku?: string }): Record<string, string> {
  const notes: Record<string, string> = {};
  if (context?.projectId) notes.project_id = context.projectId;
  if (context?.platformUserId) notes.platform_user_id = context.platformUserId;
  if (context?.sku) notes.sku = context.sku;
  return notes;
}

function mapSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'halted':
    case 'paused':
      return 'past_due'; // Razorpay halted → past_due
    case 'cancelled':
      return 'canceled';
    case 'completed':
    case 'expired':
      return 'completed';
    default: // created, authenticated, pending
      return 'incomplete';
  }
}
