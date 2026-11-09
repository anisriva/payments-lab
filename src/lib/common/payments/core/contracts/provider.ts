import type { ProviderManifest } from './manifest';
import type { CheckoutStart } from './checkout';
import type { NormalizedEvent, PaymentContext, PaymentReference } from './events';

export type ProviderKey = 'razorpay' | 'dodo' | 'stripe' | 'paypal';
export type PaymentEnvironment = 'test' | 'live';
export type PaymentFlow = 'platform' | 'project';
export type BillingInterval = 'monthly' | 'yearly';
export type CheckoutMode = 'one_time' | 'subscription';

export interface Money {
  amountMinor: number; // integer, minor units
  currency: string;    // ISO 4217, uppercase
}

export type CredentialCheck =
  | { valid: true }
  | { valid: false; reason: 'invalid_credentials' | 'wrong_mode'; detail: string };
// verifyCredentials THROWS on outages (5xx, network). It never reports an outage as invalid credentials.

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type SubscriptionStatus =
  | 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'completed';

export interface PaymentStatusResult {
  status: PaymentStatus;
  paymentId?: string;
}

export interface SubscriptionStatusResult {
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

export type ClientConfirmation =
  | { confirmed: true; paymentId: string }
  | { confirmed: false };

export interface OneTimeCheckoutInput {
  reference: PaymentReference;   // required — see Payment References
  amount: Money;
  description: string;
  buyer?: { email?: string; name?: string };
  discount?: { code: string };   // only when discount.apply is supported
  context?: PaymentContext;      // descriptive metadata only — never used for matching
}

export interface SubscriptionPlanInput {
  name: string;
  amount: Money;
  interval: BillingInterval;
}

export interface SubscriptionCheckoutInput {
  reference: PaymentReference;   // required
  planRef: string;               // the provider-side plan object (createSubscriptionPlan)
  totalCycles: number;
  description: string;
  buyer?: { email?: string; name?: string };
  discount?: { code: string };
  context?: PaymentContext;
}

export type RefundStatus = 'pending' | 'processed' | 'failed';

export interface RefundInput {
  paymentRef: string;
  amount?: Money;                // omit for a full refund
  reason?: string;
}

export interface DiscountInput {
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;                 // percent (0-100) or minor units
  currency?: string;
  duration: 'once' | 'repeating' | 'forever';
  durationCycles?: number;
  maxRedemptions?: number;
}

export interface ProviderWebhook {
  id: string;
  url: string;
  active: boolean;
  events: string[];
}

export interface WebhookInput {
  url: string;
  secret: string;
  events: string[];
}

export interface PaymentProvider {
  readonly manifest: ProviderManifest;

  // Required
  verifyCredentials(): Promise<CredentialCheck>;
  parseWebhook(rawBody: string, headers: Record<string, string>): NormalizedEvent;

  // One-time payments
  createOneTimeCheckout?(input: OneTimeCheckoutInput): Promise<CheckoutStart>;
  confirmClientPayment?(input: { providerRef: string; payload: unknown }): Promise<ClientConfirmation>;
  getPaymentStatus?(providerRef: string): Promise<PaymentStatusResult>;

  // Subscription plans — the provider object a subscription bills against
  createSubscriptionPlan?(input: SubscriptionPlanInput): Promise<{ providerRef: string }>;
  updateSubscriptionPlan?(providerRef: string, input: { name?: string; active?: boolean }): Promise<void>;
  deleteSubscriptionPlan?(providerRef: string): Promise<void>;

  // Subscriptions
  createSubscription?(input: SubscriptionCheckoutInput): Promise<CheckoutStart>;
  getSubscriptionStatus?(providerRef: string): Promise<SubscriptionStatusResult>;
  cancelSubscription?(providerRef: string, opts: { atPeriodEnd: boolean }): Promise<void>;

  // Refunds
  createRefund?(input: RefundInput): Promise<{ providerRef: string; status: RefundStatus }>;
  getRefundStatus?(providerRef: string): Promise<RefundStatus>;

  // Discounts
  createDiscount?(input: DiscountInput): Promise<{ providerRef: string; code: string }>;

  // Webhook management
  listWebhooks?(): Promise<ProviderWebhook[]>;
  createWebhook?(input: WebhookInput): Promise<ProviderWebhook & { secret?: string }>;
  updateWebhook?(id: string, input: WebhookInput & { active: boolean }): Promise<ProviderWebhook>;
  deleteWebhook?(id: string): Promise<void>;

  // Account
  checkSubscriptionsAvailable?(): Promise<boolean>;
}
