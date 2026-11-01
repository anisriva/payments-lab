import { randomUUID } from 'node:crypto';
import type { PrismaClient, AiCreditPurchase, PlatformPlanPrice, Subscription } from '@/generated/prisma';
import { PlatformPlanPriceDAO } from '@/lib/platform/dao/payments/platform-plan-price-dao';
import { SubscriptionDAO } from '@/lib/platform/dao/payments/subscription-dao';
import { AiCreditPurchaseDAO } from '@/lib/platform/dao/payments/ai-credit-purchase-dao';
import { AiCreditRateDAO } from '@/lib/platform/dao/payments/ai-credit-rate-dao';
import { PaymentDAO } from '@/lib/platform/dao/payments/payment-dao';
import { ProviderProductDAO } from '@/lib/common/dao/payments/provider-product-dao';
import { ProviderProductService } from '@/lib/common/services/payments/provider-product-service';
import { ProviderSettingsService } from '@/lib/common/services/payments/provider-settings-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import {
  CREDIT_QUICK_PICKS,
  MAX_CREDITS,
  MIN_CREDITS,
  PLATFORM_RECEIVER_COUNTRY,
  SUBSCRIPTION_TOTAL_CYCLES,
  getPaymentEnvironment,
  getPlatformProvider,
} from '@/lib/common/services/payments/payment-config';
import { canMovePayment, canMoveSubscription } from '@/lib/common/services/payments/payment-transitions';
import { currencyAllowed, isProviderKey } from '@/lib/common/payments/core/factory';
import { selectProvider } from '@/lib/common/payments/core/selector';
import { InvalidPaymentSignatureError, PaymentValidationError, ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { CheckoutInstruction, CheckoutMode, NormalizedEvent, ProviderKey } from '@/lib/common/payments/core/types';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { PaginationInput } from '@/types/common/pagination';
import {
  CreditPurchaseNotFoundError,
  CreditRateExistsError,
  CreditRateNotFoundError,
  InvalidCreditAmountError,
  InvalidPlanPriceError,
  NoCreditRateForCurrencyError,
  NoPaymentProviderAvailableError,
  PaymentNotStartedError,
  PlanPriceExistsError,
  PlanPriceInUseError,
  PlanPriceNotFoundError,
  PlatformSubscriptionNotFoundError,
} from './errors';

export class PlatformPaymentService {
  private planPriceDAO: PlatformPlanPriceDAO;
  private subscriptionDAO: SubscriptionDAO;
  private creditPurchaseDAO: AiCreditPurchaseDAO;
  private creditRateDAO: AiCreditRateDAO;
  private paymentDAO: PaymentDAO;
  private providerProductDAO: ProviderProductDAO;
  private providerProductService: ProviderProductService;
  private providerSettingsService: ProviderSettingsService;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient) {
    this.planPriceDAO = new PlatformPlanPriceDAO(prisma);
    this.subscriptionDAO = new SubscriptionDAO(prisma);
    this.creditPurchaseDAO = new AiCreditPurchaseDAO(prisma);
    this.creditRateDAO = new AiCreditRateDAO(prisma);
    this.paymentDAO = new PaymentDAO(prisma);
    this.providerProductDAO = new ProviderProductDAO(prisma);
    this.providerProductService = new ProviderProductService(prisma);
    this.providerSettingsService = new ProviderSettingsService(prisma);
    this.countryService = new CountryService(prisma);
  }

  async listPlanPrices() {
    const result = await this.planPriceDAO.listActive();
    return result.data;
  }

  async listPlanPricesForPayer(payerCountry: string) {
    const country = await this.countryService.getCountry(payerCountry);
    const result = await this.planPriceDAO.listActiveByCurrency(country.currencyCode);
    return result.data;
  }

  async getCreditRateForPayer(payerCountry: string) {
    const country = await this.countryService.getCountry(payerCountry);
    return this.creditRateDAO.findActiveByCurrency(country.currencyCode);
  }

  async listPlanPricesForCatalog(options: { pagination?: PaginationInput } = {}) {
    const result = await this.planPriceDAO.list({ pagination: options.pagination });
    const products = await this.providerProductDAO.listByRefs(
      'plan_price',
      result.data.map((p) => p.id)
    );
    return {
      ...result,
      data: result.data.map((p) => ({
        ...p,
        providerRefs: products
          .filter((r) => r.refId === p.id)
          .map((r) => ({ provider: r.provider, providerRef: r.providerRef })),
      })),
    };
  }

  async listCreditRates(options: { pagination?: PaginationInput } = {}) {
    return this.creditRateDAO.list({ pagination: options.pagination });
  }

  async createPlanPrice(input: {
    planKey: string;
    displayName: string;
    interval: 'monthly' | 'yearly';
    amountMinor: number;
    currencyCode: string;
  }): Promise<PlatformPlanPrice> {
    // 1. Validate
    if (!/^[a-z0-9-]+$/.test(input.planKey)) {
      throw new InvalidPlanPriceError('planKey must be lowercase alphanumeric with dashes');
    }
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 100) {
      throw new InvalidPlanPriceError('amountMinor must be an integer of at least 100');
    }
    if (!(await this.countryService.listCurrencies()).includes(input.currencyCode)) {
      throw new InvalidPlanPriceError(`Unsupported currency: ${input.currencyCode}`);
    }

    const id = randomUUID();

    // 2. Eager plan creation at every capable provider (external calls — outside any transaction)
    const capabilities = await this.providerSettingsService.getEffectiveCapabilities('platform');
    for (const caps of capabilities) {
      if (!caps.implemented || caps.enabled === false || !caps.supportsSubscriptions) continue;
      if (!currencyAllowed(caps.currencies, input.currencyCode)) continue;
      await this.providerProductService.ensure({
        scope: 'platform',
        provider: caps.key,
        environment: getPaymentEnvironment(),
        refType: 'plan_price',
        refId: id,
        adapter: getPlatformProvider(caps.key),
        product: {
          name: input.displayName,
          amount: { amountMinor: input.amountMinor, currency: input.currencyCode },
          interval: input.interval,
        },
      });
    }

    // 3. Create the row with the explicit id
    try {
      return await this.planPriceDAO.create({ id, ...input, isActive: true });
    } catch (e) {
      if (e instanceof UniqueConstraintException) {
        throw new PlanPriceExistsError(input.planKey, input.interval, input.currencyCode);
      }
      throw e;
    }
  }

  async updatePlanPrice(
    id: string,
    data: { displayName?: string; isActive?: boolean }
  ): Promise<PlatformPlanPrice> {
    const planPrice = await this.planPriceDAO.findById(id);
    if (!planPrice) throw new PlanPriceNotFoundError(id);
    return this.planPriceDAO.update(id, data);
  }

  async deletePlanPrice(id: string): Promise<void> {
    const planPrice = await this.planPriceDAO.findById(id);
    if (!planPrice) throw new PlanPriceNotFoundError(id);
    if (await this.subscriptionDAO.existsForPlanPrice(id)) {
      throw new PlanPriceInUseError(id);
    }
    await this.prisma.$transaction(async (tx) => {
      await new ProviderProductDAO(tx).deleteByRef('plan_price', id);
      await new PlatformPlanPriceDAO(tx).delete(id);
    });
  }

  async createCreditRate(input: { currencyCode: string; rateMinor: number }) {
    if (!(await this.countryService.listCurrencies()).includes(input.currencyCode)) {
      throw new PaymentValidationError(`Unsupported currency: ${input.currencyCode}`);
    }
    if (!Number.isInteger(input.rateMinor) || input.rateMinor < 1) {
      throw new PaymentValidationError('rateMinor must be an integer of at least 1');
    }
    try {
      return await this.creditRateDAO.create({ ...input, isActive: true });
    } catch (e) {
      if (e instanceof UniqueConstraintException) {
        throw new CreditRateExistsError(input.currencyCode);
      }
      throw e;
    }
  }

  async updateCreditRate(id: string, data: { rateMinor?: number; isActive?: boolean }) {
    if (data.rateMinor !== undefined && (!Number.isInteger(data.rateMinor) || data.rateMinor < 1)) {
      throw new PaymentValidationError('rateMinor must be an integer of at least 1');
    }
    const rate = await this.creditRateDAO.findById(id);
    if (!rate) throw new CreditRateNotFoundError(id);
    return this.creditRateDAO.update(id, data);
  }

  async deleteCreditRate(id: string): Promise<void> {
    const rate = await this.creditRateDAO.findById(id);
    if (!rate) throw new CreditRateNotFoundError(id);
    await this.creditRateDAO.delete(id);
  }

  async getSelectionPreview(payerCountry: string) {
    const country = await this.countryService.getCountry(payerCountry);
    const providers = await this.providerSettingsService.getEffectiveCapabilities('platform');
    const base = { flow: 'platform' as const, payerCountry, receiverCountry: PLATFORM_RECEIVER_COUNTRY, currency: country.currencyCode };
    return {
      oneTime: selectProvider({ ...base, mode: 'one_time' }, providers),
      subscription: selectProvider({ ...base, mode: 'subscription' }, providers),
    };
  }

  async listCreditPurchases(options: { provider?: ProviderKey; pagination?: { page: number; limit: number } }) {
    return this.creditPurchaseDAO.list({ pagination: options.pagination, filters: { provider: options.provider } });
  }

  async listSubscriptions(options: { provider?: ProviderKey; pagination?: { page: number; limit: number } }) {
    return this.subscriptionDAO.list({ pagination: options.pagination, filters: { provider: options.provider } });
  }

  async listPayments(options: { provider?: ProviderKey; pagination?: { page: number; limit: number } }) {
    return this.paymentDAO.list({ pagination: options.pagination, filters: { provider: options.provider } });
  }

  private async resolveProvider(
    gateway: ProviderKey | 'auto',
    payerCountry: string,
    mode: CheckoutMode,
    currency: string
  ): Promise<{ provider: ProviderKey; adapter: PaymentProvider; selectionReason?: string }> {
    if (gateway !== 'auto' && !isProviderKey(gateway)) {
      throw new ProviderNotImplementedError(gateway);
    }
    const providers = await this.providerSettingsService.getEffectiveCapabilities('platform');
    const result = selectProvider(
      {
        flow: 'platform',
        mode,
        payerCountry,
        receiverCountry: PLATFORM_RECEIVER_COUNTRY,
        currency,
        ...(gateway !== 'auto' && { allowed: [gateway as ProviderKey] }),
      },
      providers
    );
    if (result.provider === null) {
      throw new NoPaymentProviderAvailableError(result.reason);
    }
    return { provider: result.provider, adapter: getPlatformProvider(result.provider), selectionReason: result.reason };
  }

  async startCreditPurchase(input: {
    gateway: string;
    payerCountry: string;
    credits: number;
    kind: 'fixed' | 'custom';
  }): Promise<{ recordId: string; provider: ProviderKey; selectionReason?: string; instruction: CheckoutInstruction }> {
    // 1. Validate credits
    const { credits, kind } = input;
    if (
      !Number.isInteger(credits) ||
      credits < MIN_CREDITS ||
      credits > MAX_CREDITS ||
      (kind === 'fixed' && !(CREDIT_QUICK_PICKS as readonly number[]).includes(credits))
    ) {
      throw new InvalidCreditAmountError(credits);
    }

    // 2. Resolve currency and rate from the Catalog
    const country = await this.countryService.getCountry(input.payerCountry);
    const rate = await this.creditRateDAO.findActiveByCurrency(country.currencyCode);
    if (!rate) throw new NoCreditRateForCurrencyError(country.currencyCode);

    // 3. Resolve provider
    const { provider, adapter, selectionReason } = await this.resolveProvider(input.gateway as ProviderKey | 'auto', input.payerCountry, 'one_time', country.currencyCode);

    // 4. Compute amount
    const amountMinor = credits * rate.rateMinor;

    // 5. Create pending record
    const purchase = await this.creditPurchaseDAO.create({
      kind,
      credits,
      amountMinor,
      currencyCode: country.currencyCode,
      provider,
      environment: getPaymentEnvironment(),
      status: 'pending',
    });

    // 6. Create provider checkout (outside any transaction)
    let checkout;
    try {
      checkout = await adapter.createOneTimeCheckout({
        amount: { amountMinor, currency: country.currencyCode },
        description: `${credits} AI credits`,
        receipt: purchase.id,
        notes: { flow: 'platform', recordId: purchase.id },
      });
    } catch (e) {
      await this.creditPurchaseDAO.update(purchase.id, {
        status: 'failed',
        failureReason: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }

    // 7. Save provider ref and return
    await this.creditPurchaseDAO.update(purchase.id, { providerOrderId: checkout.providerRef });
    return { recordId: purchase.id, provider, selectionReason, instruction: checkout.instruction };
  }

  async startSubscription(input: {
    gateway: string;
    payerCountry: string;
    planPriceId: string;
  }): Promise<{ recordId: string; provider: ProviderKey; selectionReason?: string; instruction: CheckoutInstruction }> {
    // 1. Plan price exists and active
    const planPrice = await this.planPriceDAO.findById(input.planPriceId);
    if (!planPrice || !planPrice.isActive) {
      throw new PlanPriceNotFoundError(input.planPriceId);
    }

    // 2. Resolve provider
    const { provider, adapter, selectionReason } = await this.resolveProvider(input.gateway as ProviderKey | 'auto', input.payerCountry, 'subscription', planPrice.currencyCode);

    // 3. Ensure provider product (plan)
    const productRef = await this.providerProductService.ensure({
      scope: 'platform',
      provider,
      environment: getPaymentEnvironment(),
      refType: 'plan_price',
      refId: planPrice.id,
      adapter,
      product: {
        name: planPrice.displayName,
        amount: { amountMinor: planPrice.amountMinor, currency: planPrice.currencyCode },
        interval: planPrice.interval,
      },
    });

    // 4. Create pending subscription
    const subscription = await this.subscriptionDAO.create({
      platformPlanPriceId: planPrice.id,
      provider,
      environment: getPaymentEnvironment(),
      status: 'pending',
    });

    // 5. Create provider subscription
    let checkout;
    try {
      checkout = await adapter.createSubscription({
        productRef,
        totalCycles: SUBSCRIPTION_TOTAL_CYCLES[planPrice.interval],
        description: planPrice.displayName,
        notes: { flow: 'platform', recordId: subscription.id },
      });
    } catch (e) {
      await this.subscriptionDAO.update(subscription.id, {
        status: 'cancelled',
        failureReason: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }

    // 6. Save provider ref and return
    await this.subscriptionDAO.update(subscription.id, { providerSubscriptionId: checkout.providerRef });
    return { recordId: subscription.id, provider, selectionReason, instruction: checkout.instruction };
  }

  async cancelSubscription(id: string, atCycleEnd: boolean): Promise<Subscription> {
    // 1. Load
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (!subscription.providerSubscriptionId) throw new PaymentNotStartedError(id);

    // 2. Cancel at provider
    const adapter = getPlatformProvider(subscription.provider);
    await adapter.cancelSubscription(subscription.providerSubscriptionId, { atCycleEnd });

    // 3. Update local flag and refresh
    await this.subscriptionDAO.update(id, { cancelAtCycleEnd: atCycleEnd });
    return this.refreshSubscription(id);
  }

  async refreshCreditPurchase(id: string): Promise<AiCreditPurchase> {
    const purchase = await this.creditPurchaseDAO.findById(id);
    if (!purchase) throw new CreditPurchaseNotFoundError(id);
    if (!purchase.providerOrderId) return purchase;

    const adapter = getPlatformProvider(purchase.provider);
    const result = await adapter.getPaymentStatus(purchase.providerOrderId);
    return this.applyPurchaseStatus(purchase, result.status, result.paymentId);
  }

  async syncCreditPurchase(id: string): Promise<AiCreditPurchase> {
    const purchase = await this.creditPurchaseDAO.findById(id);
    if (!purchase) throw new CreditPurchaseNotFoundError(id);
    if (purchase.status === 'pending') {
      return this.refreshCreditPurchase(id);
    }
    return purchase;
  }

  async refreshSubscription(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (!subscription.providerSubscriptionId) return subscription;

    const adapter = getPlatformProvider(subscription.provider);
    const result = await adapter.getSubscriptionStatus(subscription.providerSubscriptionId);

    if (canMoveSubscription(subscription.status, result.status)) {
      return this.subscriptionDAO.update(id, {
        status: result.status,
        currentPeriodStart: result.currentPeriodStart ?? undefined,
        currentPeriodEnd: result.currentPeriodEnd ?? undefined,
        canceledAt: result.status === 'cancelled' ? new Date() : undefined,
      });
    }
    if (result.currentPeriodStart || result.currentPeriodEnd) {
      return this.subscriptionDAO.update(id, {
        currentPeriodStart: result.currentPeriodStart ?? undefined,
        currentPeriodEnd: result.currentPeriodEnd ?? undefined,
      });
    }
    return subscription;
  }

  async syncSubscription(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (subscription.status === 'pending') {
      return this.refreshSubscription(id);
    }
    return subscription;
  }

  async confirmCreditPurchase(id: string, confirmation: { paymentId: string; signature: string }): Promise<AiCreditPurchase> {
    // 1. Load
    const purchase = await this.creditPurchaseDAO.findById(id);
    if (!purchase) throw new CreditPurchaseNotFoundError(id);
    if (!purchase.providerOrderId) throw new PaymentNotStartedError(id);

    // 2. Verify signature
    const adapter = getPlatformProvider(purchase.provider);
    const valid = adapter.verifyClientConfirmation({
      kind: 'order',
      providerRef: purchase.providerOrderId,
      paymentId: confirmation.paymentId,
      signature: confirmation.signature,
    });
    if (!valid) throw new InvalidPaymentSignatureError(purchase.provider);

    // 3. Status check is truth — never trust the client signature alone
    return this.refreshCreditPurchase(id);
  }

  async confirmSubscription(id: string, confirmation: { paymentId: string; signature: string }): Promise<Subscription> {
    // 1. Load
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (!subscription.providerSubscriptionId) throw new PaymentNotStartedError(id);

    // 2. Verify signature
    const adapter = getPlatformProvider(subscription.provider);
    const valid = adapter.verifyClientConfirmation({
      kind: 'subscription',
      providerRef: subscription.providerSubscriptionId,
      paymentId: confirmation.paymentId,
      signature: confirmation.signature,
    });
    if (!valid) throw new InvalidPaymentSignatureError(subscription.provider);

    // 3. Refresh from provider
    return this.refreshSubscription(id);
  }

  async applyEvent(event: NormalizedEvent): Promise<string> {
    switch (event.type) {
      case 'payment.succeeded':
      case 'payment.failed': {
        const purchase = event.orderRef
          ? await this.creditPurchaseDAO.findByProviderOrderId(event.orderRef)
          : null;
        if (!purchase) return 'no matching purchase';
        const to = event.type === 'payment.succeeded' ? 'paid' : 'failed';
        const updated = await this.applyPurchaseStatus(purchase, to, event.paymentId);
        return `purchase ${purchase.id} → ${updated.status}`;
      }
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'subscription.halted':
      case 'subscription.completed': {
        const subscription = event.subscriptionRef
          ? await this.subscriptionDAO.findByProviderSubscriptionId(event.subscriptionRef)
          : null;
        if (!subscription) return 'no matching subscription';

        if (!canMoveSubscription(subscription.status, event.type === 'subscription.activated' || event.type === 'subscription.charged' ? 'active' : event.type.replace('subscription.', '') as Subscription['status'])) {
          return `subscription ${subscription.id} already ${subscription.status}`;
        }

        if (event.type === 'subscription.charged') {
          return this.prisma.$transaction(async (tx) => {
            const txSubscriptionDAO = new SubscriptionDAO(tx);
            const txPaymentDAO = new PaymentDAO(tx);
            await txSubscriptionDAO.update(subscription.id, {
              status: 'active',
              currentPeriodStart: event.subscriptionPeriod?.start,
              currentPeriodEnd: event.subscriptionPeriod?.end,
            });
            const hasPayments = await txPaymentDAO.existsForSubscription(subscription.id);
            if (event.paymentId) {
              const existing = await txPaymentDAO.findByProviderPaymentId(event.paymentId);
              if (!existing && event.amount) {
                await txPaymentDAO.create({
                  kind: hasPayments ? 'subscription_renewal' : 'subscription_initial',
                  provider: subscription.provider,
                  environment: subscription.environment,
                  providerPaymentId: event.paymentId,
                  amountMinor: event.amount.amountMinor,
                  currencyCode: event.amount.currency,
                  subscriptionId: subscription.id,
                });
              }
            }
            return `subscription ${subscription.id} → active (charged)`;
          });
        }

        const statusMap: Record<string, Subscription['status']> = {
          'subscription.activated': 'active',
          'subscription.cancelled': 'cancelled',
          'subscription.halted': 'halted',
          'subscription.completed': 'completed',
        };
        const newStatus = statusMap[event.type];
        await this.subscriptionDAO.update(subscription.id, {
          status: newStatus,
          currentPeriodStart: event.subscriptionPeriod?.start,
          currentPeriodEnd: event.subscriptionPeriod?.end,
          canceledAt: newStatus === 'cancelled' ? new Date() : undefined,
        });
        return `subscription ${subscription.id} → ${newStatus}`;
      }
      case 'ignored':
        return 'ignored';
      default:
        return 'nothing to do';
    }
  }

  private async applyPurchaseStatus(
    purchase: AiCreditPurchase,
    to: 'pending' | 'paid' | 'failed',
    paymentId?: string
  ): Promise<AiCreditPurchase> {
    // 1. No-op if transition not allowed
    if (!canMovePayment(purchase.status, to)) return purchase;

    // 2. Non-paid transitions are single-table
    if (to !== 'paid') {
      return this.creditPurchaseDAO.update(purchase.id, { status: to });
    }

    // 3. Paid → transaction: update purchase + record Payment
    return this.prisma.$transaction(async (tx) => {
      const txPurchaseDAO = new AiCreditPurchaseDAO(tx);
      const txPaymentDAO = new PaymentDAO(tx);

      const updated = await txPurchaseDAO.update(purchase.id, {
        status: 'paid',
        paidAt: new Date(),
        providerPaymentId: paymentId ?? undefined,
      });

      if (paymentId) {
        const existing = await txPaymentDAO.findByProviderPaymentId(paymentId);
        if (!existing) {
          await txPaymentDAO.create({
            kind: 'one_time',
            provider: purchase.provider,
            environment: purchase.environment,
            providerPaymentId: paymentId,
            amountMinor: purchase.amountMinor,
            currencyCode: purchase.currencyCode,
            aiCreditPurchaseId: purchase.id,
          });
        }
      }

      return updated;
    });
  }
}
