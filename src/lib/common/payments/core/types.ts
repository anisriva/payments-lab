export type ProviderKey = 'razorpay' | 'dodo' | 'stripe' | 'paypal';
export type PaymentEnvironment = 'test' | 'live';
export type PaymentFlow = 'platform' | 'project';
export type BillingInterval = 'monthly' | 'yearly';
export type CheckoutMode = 'one_time' | 'subscription';

export interface Money {
  amountMinor: number; // integer, minor units
  currency: string;    // ISO 4217, uppercase
}

export interface ProviderCapabilities {
  key: ProviderKey;
  label: string;
  implemented: boolean;
  flows: PaymentFlow[];
  receiverCountries: string[] | '*';
  payerCountries: string[] | '*';
  currencies: string[] | '*';
  enabled?: boolean; // undefined = enabled; set from Catalog by the service
  supportsSubscriptions: boolean;
  supportsCustomAmount: boolean;
}

export interface RazorpayModalOptions {
  key: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: string;
  prefill?: { email?: string };
  notes?: Record<string, string>;
}

export type CheckoutInstruction =
  | { kind: 'razorpay_modal'; options: RazorpayModalOptions }
  | { kind: 'redirect'; url: string };

export interface CheckoutStart {
  providerRef: string;
  instruction: CheckoutInstruction;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type SubscriptionStatus = 'pending' | 'active' | 'halted' | 'cancelled' | 'completed';

export interface PaymentStatusResult {
  status: PaymentStatus;
  paymentId?: string;
}

export interface SubscriptionStatusResult {
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

export interface ClientConfirmation {
  kind: 'order' | 'subscription';
  providerRef: string;
  paymentId: string;
  signature: string;
}

export interface OneTimeCheckoutInput {
  amount: Money;
  description: string;
  receipt: string;
  buyerEmail?: string;
  notes?: Record<string, string>;
}

export interface EnsureProductInput {
  name: string;
  amount: Money;
  interval: BillingInterval;
}

export interface SubscriptionCheckoutInput {
  productRef: string;
  totalCycles: number;
  description: string;
  buyerEmail?: string;
  notes?: Record<string, string>;
}

export type NormalizedEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'subscription.activated'
  | 'subscription.charged'
  | 'subscription.cancelled'
  | 'subscription.halted'
  | 'subscription.completed'
  | 'ignored';

export interface NormalizedEvent {
  providerEventId: string;
  rawType: string;
  type: NormalizedEventType;
  orderRef?: string;
  subscriptionRef?: string;
  paymentId?: string;
  amount?: Money;
  subscriptionPeriod?: { start: Date; end: Date };
  occurredAt: Date;
}

export interface CredentialField {
  key: string;          // property name inside the credentials object, e.g. 'keyId'
  label: string;
  secret: boolean;      // render as password, never echo back
  placeholder?: string;
  help?: string;
}

export interface OnboardingStep {
  title: string;
  body: string;
  docsUrl?: string;
}

export type ValidationCheckKey =
  | 'receiver_country' | 'key_mode' | 'keys_valid' | 'subscriptions_available' | 'webhook_registered';

export interface ValidationCheckDef {
  key: ValidationCheckKey;
  label: string;
  blocking: boolean; // true → a failure prevents saving
}

export interface ProviderProfile {
  key: ProviderKey;
  credentialFields: CredentialField[];
  webhook: {
    autoRegister: boolean;
    canUpdate: boolean;
    canDeactivate: boolean;
    canDelete: boolean;
    events: string[];                     // single source for the events we subscribe to
    secretSource: 'generated' | 'manual'; // generated → server creates it, creator never sees it
  };
  catalog: { plansEditable: boolean; plansDeletable: boolean };
  constraints: string[];
  onboarding: OnboardingStep[];
  validationChecks: ValidationCheckDef[]; // in execution order
}

export interface ProviderWebhook {
  id: string;
  url: string;
  active: boolean;
  events: string[];
}

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skipped';

export interface ValidationCheckResult {
  key: ValidationCheckKey;
  label: string;
  blocking: boolean;
  status: CheckStatus;
  detail: string;
}

export interface ValidationReport {
  checks: ValidationCheckResult[];
  canSave: boolean; // false when any blocking check failed
}
