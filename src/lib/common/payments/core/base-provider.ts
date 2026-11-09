import type { ProviderManifest } from './contracts/manifest';
import type { NormalizedEvent } from './contracts/events';
import type {
  ClientConfirmation,
  CredentialCheck,
  DiscountInput,
  Money,
  OneTimeCheckoutInput,
  PaymentProvider,
  PaymentStatusResult,
  ProviderWebhook,
  RefundInput,
  RefundStatus,
  SubscriptionCheckoutInput,
  SubscriptionPlanInput,
  SubscriptionStatusResult,
  WebhookInput,
} from './contracts/provider';
import type { CheckoutStart } from './contracts/checkout';
import {
  InvalidPaymentSignatureError,
  PaymentCapabilityNotSupportedError,
  PaymentProviderError,
  PaymentRequestRejectedError,
  PaymentValidationError,
} from './errors';

/**
 * Input checks + error wrapping for every provider call.
 * 4xx → PaymentRequestRejectedError, everything else → PaymentProviderError,
 * both carrying manifest.brand.name / manifest.key.
 */
export abstract class BasePaymentProvider implements PaymentProvider {
  abstract readonly manifest: ProviderManifest;

  async verifyCredentials(): Promise<CredentialCheck> {
    return this.doVerifyCredentials();
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): NormalizedEvent {
    if (!this.verifyWebhookSignature(rawBody, headers)) {
      throw new InvalidPaymentSignatureError(this.manifest.key);
    }
    const payload: unknown = JSON.parse(rawBody);
    return this.toNormalizedEvent(payload, headers);
  }

  async createOneTimeCheckout(input: OneTimeCheckoutInput): Promise<CheckoutStart> {
    this.assertMoney(input.amount);
    this.assertReference(input.reference);
    return this.wrap(() => this.doCreateOneTimeCheckout(input));
  }

  async confirmClientPayment(input: { providerRef: string; payload: unknown }): Promise<ClientConfirmation> {
    this.assertRef(input.providerRef, 'Provider reference');
    return this.wrap(() => this.doConfirmClientPayment(input));
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    this.assertRef(providerRef, 'Order reference');
    return this.wrap(() => this.doGetPaymentStatus(providerRef));
  }

  async createSubscriptionPlan(input: SubscriptionPlanInput): Promise<{ providerRef: string }> {
    this.assertMoney(input.amount);
    if (!input.name || input.name.trim().length === 0) {
      throw new PaymentValidationError('Plan name is required');
    }
    return this.wrap(() => this.doCreateSubscriptionPlan(input));
  }

  async updateSubscriptionPlan(providerRef: string, input: { name?: string; active?: boolean }): Promise<void> {
    this.assertRef(providerRef, 'Plan reference');
    return this.wrap(() => this.doUpdateSubscriptionPlan(providerRef, input));
  }

  async deleteSubscriptionPlan(providerRef: string): Promise<void> {
    this.assertRef(providerRef, 'Plan reference');
    return this.wrap(() => this.doDeleteSubscriptionPlan(providerRef));
  }

  async createSubscription(input: SubscriptionCheckoutInput): Promise<CheckoutStart> {
    this.assertRef(input.planRef, 'Plan reference');
    this.assertReference(input.reference);
    if (!Number.isInteger(input.totalCycles) || input.totalCycles < 1) {
      throw new PaymentValidationError('totalCycles must be a positive integer');
    }
    return this.wrap(() => this.doCreateSubscription(input));
  }

  async getSubscriptionStatus(providerRef: string): Promise<SubscriptionStatusResult> {
    this.assertRef(providerRef, 'Subscription reference');
    return this.wrap(() => this.doGetSubscriptionStatus(providerRef));
  }

  async cancelSubscription(providerRef: string, opts: { atPeriodEnd: boolean }): Promise<void> {
    this.assertRef(providerRef, 'Subscription reference');
    return this.wrap(() => this.doCancelSubscription(providerRef, opts));
  }

  async createRefund(input: RefundInput): Promise<{ providerRef: string; status: RefundStatus }> {
    this.assertRef(input.paymentRef, 'Payment reference');
    if (input.amount) this.assertMoney(input.amount);
    return this.wrap(() => this.doCreateRefund(input));
  }

  async getRefundStatus(providerRef: string): Promise<RefundStatus> {
    this.assertRef(providerRef, 'Refund reference');
    return this.wrap(() => this.doGetRefundStatus(providerRef));
  }

  async createDiscount(input: DiscountInput): Promise<{ providerRef: string; code: string }> {
    if (!input.code || input.code.trim().length === 0) {
      throw new PaymentValidationError('Discount code is required');
    }
    return this.wrap(() => this.doCreateDiscount(input));
  }

  async listWebhooks(): Promise<ProviderWebhook[]> {
    return this.wrap(() => this.doListWebhooks());
  }

  async createWebhook(input: WebhookInput): Promise<ProviderWebhook & { secret?: string }> {
    if (!input.url || !input.secret || input.events.length === 0) {
      throw new PaymentValidationError('url, secret and at least one event are required');
    }
    return this.wrap(() => this.doCreateWebhook(input));
  }

  async updateWebhook(id: string, input: WebhookInput & { active: boolean }): Promise<ProviderWebhook> {
    if (!id || !input.url || !input.secret || input.events.length === 0) {
      throw new PaymentValidationError('id, url, secret and at least one event are required');
    }
    return this.wrap(() => this.doUpdateWebhook(id, input));
  }

  async deleteWebhook(id: string): Promise<void> {
    this.assertRef(id, 'Webhook id');
    return this.wrap(() => this.doDeleteWebhook(id));
  }

  async checkSubscriptionsAvailable(): Promise<boolean> {
    return this.wrap(() => this.doCheckSubscriptionsAvailable());
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PaymentValidationError || e instanceof PaymentProviderError) {
        throw e;
      }
      const statusCode = (e as { statusCode?: unknown })?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        throw new PaymentRequestRejectedError(this.manifest.brand.name, this.describeError(e));
      }
      throw new PaymentProviderError(this.manifest.brand.name, this.describeError(e), e);
    }
  }

  private assertMoney(m: Money): void {
    if (!Number.isInteger(m.amountMinor) || m.amountMinor <= 0) {
      throw new PaymentValidationError('amountMinor must be a positive integer');
    }
    if (!/^[A-Z]{3}$/.test(m.currency)) {
      throw new PaymentValidationError('currency must be a 3-letter uppercase ISO code');
    }
  }

  private assertRef(ref: string, label: string): void {
    if (!ref || ref.trim().length === 0) {
      throw new PaymentValidationError(`${label} is required`);
    }
  }

  private assertReference(ref: { kind: string; id: string }): void {
    if (!ref?.id) throw new PaymentValidationError('A payment reference is required');
  }

  private describeError(e: unknown): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const err = e as { error?: { description?: string } };
      if (err.error?.description) return err.error.description;
    }
    if (e instanceof Error) return e.message;
    return 'Unknown provider error';
  }

  protected abstract doVerifyCredentials(): Promise<CredentialCheck>;
  protected abstract verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;
  protected abstract toNormalizedEvent(payload: unknown, headers: Record<string, string>): NormalizedEvent;

  private unsupported(capability: string): never {
    throw new PaymentCapabilityNotSupportedError(this.manifest.brand.name, capability);
  }

  protected doCreateOneTimeCheckout(_i: OneTimeCheckoutInput): Promise<CheckoutStart> { return this.unsupported('one-time checkout'); }
  protected doConfirmClientPayment(_i: { providerRef: string; payload: unknown }): Promise<ClientConfirmation> { return this.unsupported('client confirmation'); }
  protected doGetPaymentStatus(_r: string): Promise<PaymentStatusResult> { return this.unsupported('payment status'); }
  protected doCreateSubscriptionPlan(_i: SubscriptionPlanInput): Promise<{ providerRef: string }> { return this.unsupported('subscription plans'); }
  protected doUpdateSubscriptionPlan(_r: string, _i: { name?: string; active?: boolean }): Promise<void> { return this.unsupported('subscription plans'); }
  protected doDeleteSubscriptionPlan(_r: string): Promise<void> { return this.unsupported('subscription plans'); }
  protected doCreateSubscription(_i: SubscriptionCheckoutInput): Promise<CheckoutStart> { return this.unsupported('subscriptions'); }
  protected doGetSubscriptionStatus(_r: string): Promise<SubscriptionStatusResult> { return this.unsupported('subscriptions'); }
  protected doCancelSubscription(_r: string, _o: { atPeriodEnd: boolean }): Promise<void> { return this.unsupported('subscriptions'); }
  protected doCreateRefund(_i: RefundInput): Promise<{ providerRef: string; status: RefundStatus }> { return this.unsupported('refunds'); }
  protected doGetRefundStatus(_r: string): Promise<RefundStatus> { return this.unsupported('refunds'); }
  protected doCreateDiscount(_i: DiscountInput): Promise<{ providerRef: string; code: string }> { return this.unsupported('discounts'); }
  protected doListWebhooks(): Promise<ProviderWebhook[]> { return this.unsupported('webhook management'); }
  protected doCreateWebhook(_i: WebhookInput): Promise<ProviderWebhook & { secret?: string }> { return this.unsupported('webhook management'); }
  protected doUpdateWebhook(_id: string, _i: WebhookInput & { active: boolean }): Promise<ProviderWebhook> { return this.unsupported('webhook management'); }
  protected doDeleteWebhook(_id: string): Promise<void> { return this.unsupported('webhook management'); }
  protected doCheckSubscriptionsAvailable(): Promise<boolean> { return this.unsupported('account checks'); }
}
