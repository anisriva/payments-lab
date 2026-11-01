import type {
  ClientConfirmation,
  CheckoutStart,
  EnsureProductInput,
  Money,
  NormalizedEvent,
  OneTimeCheckoutInput,
  PaymentStatusResult,
  ProviderCapabilities,
  ProviderWebhook,
  SubscriptionCheckoutInput,
  SubscriptionStatusResult,
} from './types';
import { InvalidPaymentSignatureError, PaymentCapabilityNotSupportedError, PaymentProviderError, PaymentRequestRejectedError, PaymentValidationError } from './errors';

export interface PaymentProvider {
  readonly capabilities: ProviderCapabilities;
  createOneTimeCheckout(input: OneTimeCheckoutInput): Promise<CheckoutStart>;
  ensureProduct(input: EnsureProductInput): Promise<{ providerRef: string }>;
  createSubscription(input: SubscriptionCheckoutInput): Promise<CheckoutStart>;
  cancelSubscription(subscriptionRef: string, opts: { atCycleEnd: boolean }): Promise<void>;
  getPaymentStatus(orderRef: string): Promise<PaymentStatusResult>;
  getSubscriptionStatus(subscriptionRef: string): Promise<SubscriptionStatusResult>;
  verifyClientConfirmation(c: ClientConfirmation): boolean;
  parseWebhook(rawBody: string, headers: Record<string, string>): NormalizedEvent;
  verifyCredentials(): Promise<boolean>;
  listWebhooks(): Promise<ProviderWebhook[]>;
  createWebhook(input: { url: string; secret: string; events: string[] }): Promise<ProviderWebhook>;
  updateWebhook(id: string, input: { url: string; secret: string; events: string[]; active: boolean }): Promise<ProviderWebhook>;
  checkSubscriptionsAvailable(): Promise<boolean>;
}

export abstract class BasePaymentProvider implements PaymentProvider {
  abstract readonly capabilities: ProviderCapabilities;

  async createOneTimeCheckout(input: OneTimeCheckoutInput): Promise<CheckoutStart> {
    this.assertMoney(input.amount);
    return this.wrap(() => this.doCreateOneTimeCheckout(input));
  }

  async ensureProduct(input: EnsureProductInput): Promise<{ providerRef: string }> {
    this.assertMoney(input.amount);
    return this.wrap(() => this.doEnsureProduct(input));
  }

  async createSubscription(input: SubscriptionCheckoutInput): Promise<CheckoutStart> {
    if (!Number.isInteger(input.totalCycles) || input.totalCycles < 1) {
      throw new PaymentValidationError('totalCycles must be a positive integer');
    }
    return this.wrap(() => this.doCreateSubscription(input));
  }

  async cancelSubscription(subscriptionRef: string, opts: { atCycleEnd: boolean }): Promise<void> {
    if (!subscriptionRef || subscriptionRef.trim().length === 0) {
      throw new PaymentValidationError('Subscription reference is required');
    }
    return this.wrap(() => this.doCancelSubscription(subscriptionRef, opts));
  }

  async getPaymentStatus(orderRef: string): Promise<PaymentStatusResult> {
    if (!orderRef || orderRef.trim().length === 0) {
      throw new PaymentValidationError('Order reference is required');
    }
    return this.wrap(() => this.doGetPaymentStatus(orderRef));
  }

  async getSubscriptionStatus(subscriptionRef: string): Promise<SubscriptionStatusResult> {
    if (!subscriptionRef || subscriptionRef.trim().length === 0) {
      throw new PaymentValidationError('Subscription reference is required');
    }
    return this.wrap(() => this.doGetSubscriptionStatus(subscriptionRef));
  }

  verifyClientConfirmation(c: ClientConfirmation): boolean {
    return this.doVerifyClientConfirmation(c);
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): NormalizedEvent {
    if (!this.verifyWebhookSignature(rawBody, headers)) {
      throw new InvalidPaymentSignatureError(this.capabilities.key);
    }
    const payload: unknown = JSON.parse(rawBody);
    return this.toNormalizedEvent(payload, headers);
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.doVerifyCredentials();
      return true;
    } catch {
      return false;
    }
  }

  async listWebhooks(): Promise<ProviderWebhook[]> {
    return this.wrap(() => this.doListWebhooks());
  }

  async createWebhook(input: { url: string; secret: string; events: string[] }): Promise<ProviderWebhook> {
    if (!input.url || !input.secret || input.events.length === 0) {
      throw new PaymentValidationError('url, secret and at least one event are required');
    }
    return this.wrap(() => this.doCreateWebhook(input));
  }

  async updateWebhook(id: string, input: { url: string; secret: string; events: string[]; active: boolean }): Promise<ProviderWebhook> {
    if (!id || !input.url || !input.secret || input.events.length === 0) {
      throw new PaymentValidationError('id, url, secret and at least one event are required');
    }
    return this.wrap(() => this.doUpdateWebhook(id, input));
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
        throw new PaymentRequestRejectedError(this.capabilities.label, this.describeError(e));
      }
      throw new PaymentProviderError(this.capabilities.key, this.describeError(e), e);
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

  private describeError(e: unknown): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const err = e as { error?: { description?: string } };
      if (err.error?.description) return err.error.description;
    }
    if (e instanceof Error) return e.message;
    return 'Unknown provider error';
  }

  protected abstract doCreateOneTimeCheckout(input: OneTimeCheckoutInput): Promise<CheckoutStart>;
  protected abstract doEnsureProduct(input: EnsureProductInput): Promise<{ providerRef: string }>;
  protected abstract doCreateSubscription(input: SubscriptionCheckoutInput): Promise<CheckoutStart>;
  protected abstract doCancelSubscription(subscriptionRef: string, opts: { atCycleEnd: boolean }): Promise<void>;
  protected abstract doGetPaymentStatus(orderRef: string): Promise<PaymentStatusResult>;
  protected abstract doGetSubscriptionStatus(subscriptionRef: string): Promise<SubscriptionStatusResult>;
  protected abstract doVerifyClientConfirmation(c: ClientConfirmation): boolean;
  protected abstract doVerifyCredentials(): Promise<void>;
  protected abstract verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;
  protected abstract toNormalizedEvent(payload: unknown, headers: Record<string, string>): NormalizedEvent;

  protected doListWebhooks(): Promise<ProviderWebhook[]> {
    throw new PaymentCapabilityNotSupportedError(this.capabilities.label, 'webhook registration');
  }

  protected doCreateWebhook(input: { url: string; secret: string; events: string[] }): Promise<ProviderWebhook> {
    void input;
    throw new PaymentCapabilityNotSupportedError(this.capabilities.label, 'webhook registration');
  }

  protected doUpdateWebhook(id: string, input: { url: string; secret: string; events: string[]; active: boolean }): Promise<ProviderWebhook> {
    void id;
    void input;
    throw new PaymentCapabilityNotSupportedError(this.capabilities.label, 'webhook registration');
  }

  protected doCheckSubscriptionsAvailable(): Promise<boolean> {
    return Promise.resolve(this.capabilities.supportsSubscriptions);
  }
}
