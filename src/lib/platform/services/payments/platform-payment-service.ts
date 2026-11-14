import { randomUUID } from 'node:crypto';
import type { PrismaClient, PlatformOrder, PlatformPlanPrice, PlatformSubscription } from '@/generated/prisma';
import { PlatformPlanPriceDAO } from '@/lib/platform/dao/payments/platform-plan-price-dao';
import { PlatformSubscriptionDAO } from '@/lib/platform/dao/payments/platform-subscription-dao';
import { PlatformOrderDAO } from '@/lib/platform/dao/payments/platform-order-dao';
import { PlatformOfferingDAO, PlatformOfferingPriceDAO } from '@/lib/platform/dao/payments/platform-offering-dao';
import { PlatformPaymentDAO } from '@/lib/platform/dao/payments/platform-payment-dao';
import { ensurePlanRef } from '@/lib/common/services/payments/provider-plan-service';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import {
  CREDIT_QUICK_PICKS,
  MAX_CREDITS,
  MIN_CREDITS,
  PLATFORM_RECEIVER_COUNTRY,
  SUBSCRIPTION_TOTAL_CYCLES,
  getPlatformProvider,
} from '@/lib/common/services/payments/payment-config';
import { getPaymentEnvironment } from '@/config/payments/env';
import { getPlatformCredentials } from '@/config/payments/platform-credentials';
import {
  canMovePayment,
  paymentFromStates,
  subscriptionFromStates,
  LIVE_SUBSCRIPTION_STATUSES,
} from '@/lib/common/services/payments/payment-transitions';
import { log } from '@/lib/common/utils';
import { currencyAllowed } from '@/lib/common/payments/core/coverage';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { isProviderKey } from '@/lib/common/payments/core/registry.server';
import { selectProvider } from '@/lib/common/payments/core/selector';
import {
  InvalidPaymentSignatureError,
  PaymentCapabilityNotSupportedError,
  PaymentValidationError,
  ProviderNotImplementedError,
} from '@/lib/common/payments/core/errors';
import type { CheckoutInstruction } from '@/lib/common/payments/core/contracts/checkout';
import type { CheckoutMode, PaymentProvider, ProviderKey } from '@/lib/common/payments/core/contracts/provider';
import type { NormalizedEvent } from '@/lib/common/payments/core/contracts/events';
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
  ActiveSubscriptionExistsError,
  PlatformSubscriptionExistsError,
  PlanPriceInUseError,
  PlanPriceNotFoundError,
  PlatformSubscriptionNotFoundError,
} from './errors';

function platformAvailable(provider: ProviderKey): boolean {
  try {
    getPlatformCredentials(provider);
    return true;
  } catch {
    return false;
  }
}

export class PlatformPaymentService {
  private planPriceDAO: PlatformPlanPriceDAO;
  private subscriptionDAO: PlatformSubscriptionDAO;
  private orderDAO: PlatformOrderDAO;
  private offeringDAO: PlatformOfferingDAO;
  private offeringPriceDAO: PlatformOfferingPriceDAO;
  private paymentDAO: PlatformPaymentDAO;
  private providerRulesService: ProviderRulesService;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient) {
    this.planPriceDAO = new PlatformPlanPriceDAO(prisma);
    this.subscriptionDAO = new PlatformSubscriptionDAO(prisma);
    this.orderDAO = new PlatformOrderDAO(prisma);
    this.offeringDAO = new PlatformOfferingDAO(prisma);
    this.offeringPriceDAO = new PlatformOfferingPriceDAO(prisma);
    this.paymentDAO = new PlatformPaymentDAO(prisma);
    this.providerRulesService = new ProviderRulesService(prisma);
    this.countryService = new CountryService(prisma);
  }

  async listPlanPrices() {
    const result = await this.planPriceDAO.listActive();
    return result.data;
  }

  async listPlanPricesForPayer(payerCountry: string) {
    const market = await this.countryService.getMarket(payerCountry);
    const result = await this.planPriceDAO.listActiveByMarket(market.id);
    return result.data;
  }

  async getCreditRateForPayer(payerCountry: string) {
    const market = await this.countryService.getMarket(payerCountry);
    return this.offeringPriceDAO.findActive('ai_credits', market.id, 'one_time');
  }

  async listPlanPricesForCatalog(options: { pagination?: PaginationInput } = {}) {
    const result = await this.planPriceDAO.list({ pagination: options.pagination });
    return {
      ...result,
      data: result.data.map((p) => ({
        ...p,
        providerRefs: Object.entries((p.providerPlanRefs ?? {}) as Record<string, string>).map(
          ([provider, providerRef]) => ({ provider, providerRef }),
        ),
      })),
    };
  }

  async listCreditRates(options: { pagination?: PaginationInput } = {}) {
    const offering = await this.offeringDAO.findByKey('ai_credits');
    const data = offering ? await this.offeringPriceDAO.listForOffering(offering.id) : [];
    return { data, meta: { page: 1, limit: data.length, total: data.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
  }

  private async marketForCurrency(currencyCode: string) {
    const market = await this.prisma.market.findFirst({ where: { defaultCurrencyCode: currencyCode, isActive: true } });
    if (!market) throw new CreditRateNotFoundError(currencyCode);
    return market;
  }

  async createPlanPrice(input: {
    planKey: string;
    displayName: string;
    interval: 'monthly' | 'yearly';
    amountMinor: number;
    marketKey: string;
  }): Promise<PlatformPlanPrice> {
    // 1. Validate
    if (!/^[a-z0-9-]+$/.test(input.planKey)) {
      throw new InvalidPlanPriceError('planKey must be lowercase alphanumeric with dashes');
    }
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 100) {
      throw new InvalidPlanPriceError('amountMinor must be an integer of at least 100');
    }
    const market = await this.prisma.market.findUnique({ where: { key: input.marketKey as never } });
    if (!market) throw new InvalidPlanPriceError(`Unknown market: ${input.marketKey}`);
    const plan = await this.prisma.platformPlan.upsert({
      where: { key: input.planKey },
      create: { key: input.planKey, name: input.displayName },
      update: {},
    });
    const currencyCode = market.defaultCurrencyCode;

    const id = randomUUID();
    const providerPlanRefs: Record<string, string> = {};

    // 2. Eager plan creation at every capable provider (external calls — outside any transaction)
    const candidates = await this.providerRulesService.getCandidates('platform', platformAvailable);
    for (const { manifest, rule, available } of candidates) {
      if (!rule?.isEnabled || !available) continue;
      if (!supports(manifest, 'subscription_plan.create')) continue;
      if (!currencyAllowed(rule.currencies, currencyCode)) continue;
      const adapter = getPlatformProvider(manifest.key);
      const { providerRef } = await adapter.createSubscriptionPlan!({
        name: input.displayName,
        amount: { amountMinor: input.amountMinor, currency: currencyCode },
        interval: input.interval,
      });
      providerPlanRefs[manifest.key] = providerRef;
    }

    // 3. Create the row with the explicit id
    try {
      return await this.planPriceDAO.create({
        id, planId: plan.id, marketId: market.id, billingMode: input.interval,
        unitAmount: input.amountMinor, currencyCode, providerPlanRefs, isActive: true,
      });
    } catch (e) {
      if (e instanceof UniqueConstraintException) {
        throw new PlanPriceExistsError(input.planKey, input.interval, currencyCode);
      }
      throw e;
    }
  }

  async updatePlanPrice(
    id: string,
    data: { displayName?: string; isActive?: boolean },
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
    await this.planPriceDAO.delete(id);
  }

  async createCreditRate(input: { currencyCode: string; rateMinor: number }) {
    if (!Number.isInteger(input.rateMinor) || input.rateMinor < 1) {
      throw new PaymentValidationError('rateMinor must be an integer of at least 1');
    }
    const market = await this.marketForCurrency(input.currencyCode);
    const offering = await this.offeringDAO.findByKey('ai_credits');
    if (!offering) throw new CreditRateNotFoundError('ai_credits');
    const existing = await this.offeringPriceDAO.findActive('ai_credits', market.id, 'one_time');
    if (existing) throw new CreditRateExistsError(input.currencyCode);
    return this.offeringPriceDAO.create({ offeringId: offering.id, marketId: market.id, priceType: 'one_time', unitAmount: input.rateMinor, currencyCode: input.currencyCode, isActive: true });
  }

  async updateCreditRate(id: string, data: { rateMinor?: number; isActive?: boolean }) {
    if (data.rateMinor !== undefined && (!Number.isInteger(data.rateMinor) || data.rateMinor < 1)) {
      throw new PaymentValidationError('rateMinor must be an integer of at least 1');
    }
    const rate = await this.offeringPriceDAO.findById(id);
    if (!rate) throw new CreditRateNotFoundError(id);
    return this.offeringPriceDAO.update(id, { unitAmount: data.rateMinor, isActive: data.isActive });
  }

  async deleteCreditRate(id: string) {
    const rate = await this.offeringPriceDAO.findById(id);
    if (!rate) throw new CreditRateNotFoundError(id);
    await this.offeringPriceDAO.update(id, { isActive: false });
  }

  async getSelectionPreview(payerCountry: string) {
    const country = await this.countryService.getCountry(payerCountry);
    const candidates = await this.providerRulesService.getCandidates('platform', platformAvailable);
    const base = { flow: 'platform' as const, payerCountry, receiverCountry: PLATFORM_RECEIVER_COUNTRY, currency: country.currencyCode };
    return {
      oneTime: selectProvider({ ...base, mode: 'one_time' }, candidates),
      subscription: selectProvider({ ...base, mode: 'subscription' }, candidates),
    };
  }

  async listCreditPurchases(options: { provider?: ProviderKey; pagination?: { page: number; limit: number } }) {
    return this.orderDAO.list({ pagination: options.pagination, filters: { provider: options.provider } });
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
    currency: string,
  ): Promise<{ provider: ProviderKey; adapter: PaymentProvider; selectionReason?: string }> {
    if (gateway !== 'auto' && !isProviderKey(gateway)) {
      throw new ProviderNotImplementedError(gateway);
    }
    const candidates = await this.providerRulesService.getCandidates('platform', platformAvailable);
    const result = selectProvider(
      {
        flow: 'platform',
        mode,
        payerCountry,
        receiverCountry: PLATFORM_RECEIVER_COUNTRY,
        currency,
        ...(gateway !== 'auto' && { allowed: [gateway as ProviderKey] }),
      },
      candidates,
    );
    if (result.provider === null) {
      throw new NoPaymentProviderAvailableError(result.reason);
    }
    return { provider: result.provider, adapter: getPlatformProvider(result.provider), selectionReason: result.reason };
  }

  private async labPlatformUserId(): Promise<string> {
    const user = await this.prisma.platformUser.findFirst();
    if (!user) throw new PaymentValidationError('No platform user — run the seed');
    return user.id;
  }

  async startCreditPurchase(input: {
    gateway: string;
    projectId: string;
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

    // 2. Resolve the ai_credits offering price at the payer's market
    const market = await this.countryService.getMarket(input.payerCountry);
    const price = await this.offeringPriceDAO.findActive('ai_credits', market.id, 'one_time');
    if (!price) throw new NoCreditRateForCurrencyError(market.defaultCurrencyCode);

    // 3. Resolve provider
    const { provider, adapter, selectionReason } = await this.resolveProvider(
      input.gateway as ProviderKey | 'auto', input.payerCountry, 'one_time', price.currencyCode,
    );
    if (!supports(adapter.manifest, 'checkout.one_time')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'one-time checkout');
    }

    // 4. Compute amount
    const amount = credits * price.unitAmount;

    // 5. Create pending record
    const order = await this.orderDAO.create({
      projectId: input.projectId,
      platformUserId: await this.labPlatformUserId(),
      platformOfferingPriceId: price.id,
      quantity: credits,
      unitAmount: price.unitAmount,
      amount,
      currencyCode: price.currencyCode,
      provider,
      environment: getPaymentEnvironment(),
      status: 'pending',
    });
    void kind;

    // 6. Create provider checkout (outside any transaction)
    let checkout;
    try {
      checkout = await adapter.createOneTimeCheckout!({
        reference: { kind: 'platform_order', id: order.id },
        amount: { amountMinor: amount, currency: price.currencyCode },
        description: `${credits} AI credits`,
        context: { sku: 'ai_credits' },
      });
    } catch (e) {
      await this.orderDAO.update(order.id, {
        status: 'failed',
        failureReason: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }

    // 7. Save provider ref and return
    await this.orderDAO.update(order.id, { providerOrderId: checkout.providerRef });
    return { recordId: order.id, provider, selectionReason, instruction: checkout.instruction };
  }

  async startSubscription(input: {
    gateway: string;
    projectId: string;
    payerCountry: string;
    planPriceId: string;
  }): Promise<{ recordId: string; provider: ProviderKey; selectionReason?: string; instruction: CheckoutInstruction }> {
    // 1. Plan price exists and active
    const planPrice = await this.planPriceDAO.findById(input.planPriceId);
    if (!planPrice || !planPrice.isActive) {
      throw new PlanPriceNotFoundError(input.planPriceId);
    }

    // 2. Resolve provider
    const { provider, adapter, selectionReason } = await this.resolveProvider(
      input.gateway as ProviderKey | 'auto', input.payerCountry, 'subscription', planPrice.currencyCode,
    );
    if (!supports(adapter.manifest, 'subscription.create')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'subscriptions');
    }

    // 3. Ensure provider plan (providerPlanRefs keyed by provider)
    const planRef = await ensurePlanRef({
      providerPlanRefs: planPrice.providerPlanRefs,
      key: provider,
      adapter,
      plan: {
        name: planPrice.plan.name,
        amount: { amountMinor: planPrice.unitAmount, currency: planPrice.currencyCode },
        interval: planPrice.billingMode,
      },
      persist: async (refs) => { await this.planPriceDAO.update(planPrice.id, { providerPlanRefs: refs }); },
    });

    // 4. Create pending subscription — one non-ended base-plan subscription per project
    for (const stale of await this.subscriptionDAO.listIncompleteBasePlans(input.projectId)) {
      if (stale.providerSubscriptionId) {
        const staleAdapter = getPlatformProvider(stale.provider);
        if (supports(staleAdapter.manifest, 'subscription.cancel')) {
          try {
            await staleAdapter.cancelSubscription!(stale.providerSubscriptionId, { atPeriodEnd: false });
          } catch (e) {
            log(`startSubscription: could not cancel superseded subscription ${stale.id}`, e, 'warn');
          }
        }
      }
      // Known edge: if the superseded checkout is paid later in another tab, its status
      // events are ignored (terminal), but Fix 1 still records the payment in the ledger,
      // so it's visible for a manual refund.
      await this.subscriptionDAO.updateIfStatus(stale.id, ['incomplete'], {
        status: 'canceled',
        canceledAt: new Date(),
        failureReason: 'Superseded by a new checkout',
      });
    }
    const existing = await this.prisma.platformSubscription.findFirst({
      where: { projectId: input.projectId, platformPlanPriceId: { not: null }, status: { notIn: ['canceled', 'completed'] } },
    });
    if (existing) throw new ActiveSubscriptionExistsError(input.projectId);
    let subscription: PlatformSubscription;
    try {
      subscription = await this.subscriptionDAO.create({
        projectId: input.projectId,
        platformUserId: await this.labPlatformUserId(),
        platformPlanPriceId: planPrice.id,
        quantity: 1,
        provider,
        environment: getPaymentEnvironment(),
        status: 'incomplete',
      });
    } catch (e) {
      if (e instanceof UniqueConstraintException) {
        throw new PlatformSubscriptionExistsError(input.projectId);
      }
      throw e;
    }

    // 5. Create provider subscription
    let checkout;
    try {
      checkout = await adapter.createSubscription!({
        reference: { kind: 'platform_subscription', id: subscription.id },
        planRef,
        totalCycles: SUBSCRIPTION_TOTAL_CYCLES[planPrice.billingMode],
        description: planPrice.plan.name,
      });
    } catch (e) {
      await this.subscriptionDAO.update(subscription.id, {
        status: 'canceled',
        failureReason: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }

    // 6. Save provider ref and return
    await this.subscriptionDAO.update(subscription.id, { providerSubscriptionId: checkout.providerRef });
    return { recordId: subscription.id, provider, selectionReason, instruction: checkout.instruction };
  }

  async cancelSubscription(id: string, atPeriodEnd: boolean): Promise<PlatformSubscription> {
    // 1. Load
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (!subscription.providerSubscriptionId) throw new PaymentNotStartedError(id);

    // 2. Cancel at provider — always behind its feature
    const adapter = getPlatformProvider(subscription.provider);
    const feature = atPeriodEnd ? 'subscription.cancel_at_period_end' : 'subscription.cancel';
    if (!supports(adapter.manifest, feature)) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'subscription cancellation');
    }
    await adapter.cancelSubscription!(subscription.providerSubscriptionId, { atPeriodEnd });

    // 3. Update local flag and refresh
    await this.subscriptionDAO.update(id, { cancelAtPeriodEnd: atPeriodEnd });
    return this.refreshSubscription(id);
  }

  async refreshCreditPurchase(id: string): Promise<PlatformOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order) throw new CreditPurchaseNotFoundError(id);
    if (!order.providerOrderId) return order;

    const adapter = getPlatformProvider(order.provider);
    if (!supports(adapter.manifest, 'payment.read')) return order;
    const result = await adapter.getPaymentStatus!(order.providerOrderId);
    return this.applyOrderStatus(order, result.status === 'refunded' ? 'refunded' : result.status, result.paymentId);
  }

  async syncCreditPurchase(id: string): Promise<PlatformOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order) throw new CreditPurchaseNotFoundError(id);
    if (order.status === 'pending') {
      return this.refreshCreditPurchase(id);
    }
    return order;
  }

  async refreshSubscription(id: string): Promise<PlatformSubscription> {
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (!subscription.providerSubscriptionId) return subscription;

    const adapter = getPlatformProvider(subscription.provider);
    if (!supports(adapter.manifest, 'subscription.read')) return subscription;
    const result = await adapter.getSubscriptionStatus!(subscription.providerSubscriptionId);

    const moved = await this.subscriptionDAO.updateIfStatus(id, subscriptionFromStates(result.status), {
      status: result.status,
      currentPeriodStart: result.currentPeriodStart ?? undefined,
      currentPeriodEnd: result.currentPeriodEnd ?? undefined,
      canceledAt: result.status === 'canceled' ? new Date() : undefined,
    });
    if (!moved && (result.currentPeriodStart || result.currentPeriodEnd)) {
      await this.subscriptionDAO.update(id, {
        currentPeriodStart: result.currentPeriodStart ?? undefined,
        currentPeriodEnd: result.currentPeriodEnd ?? undefined,
      });
    }
    return (await this.subscriptionDAO.findById(id)) ?? subscription;
  }

  async syncSubscription(id: string): Promise<PlatformSubscription> {
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (subscription.status === 'incomplete') {
      return this.refreshSubscription(id);
    }
    return subscription;
  }

  async confirmCreditPurchase(id: string, confirmation: { paymentId: string; signature: string }): Promise<PlatformOrder> {
    // 1. Load
    const order = await this.orderDAO.findById(id);
    if (!order) throw new CreditPurchaseNotFoundError(id);
    if (!order.providerOrderId) throw new PaymentNotStartedError(id);

    // 2. Verify signature — behind checkout.client_confirmation
    const adapter = getPlatformProvider(order.provider);
    if (!supports(adapter.manifest, 'checkout.client_confirmation')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'client confirmation');
    }
    const result = await adapter.confirmClientPayment!({
      providerRef: order.providerOrderId,
      payload: { paymentId: confirmation.paymentId, signature: confirmation.signature, kind: 'order' },
    });
    if (!result.confirmed) throw new InvalidPaymentSignatureError(order.provider);

    // 3. Status check is truth — never trust the client signature alone
    return this.refreshCreditPurchase(id);
  }

  async confirmSubscription(id: string, confirmation: { paymentId: string; signature: string }): Promise<PlatformSubscription> {
    // 1. Load
    const subscription = await this.subscriptionDAO.findById(id);
    if (!subscription) throw new PlatformSubscriptionNotFoundError(id);
    if (!subscription.providerSubscriptionId) throw new PaymentNotStartedError(id);

    // 2. Verify signature
    const adapter = getPlatformProvider(subscription.provider);
    if (!supports(adapter.manifest, 'checkout.client_confirmation')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'client confirmation');
    }
    const result = await adapter.confirmClientPayment!({
      providerRef: subscription.providerSubscriptionId,
      payload: { paymentId: confirmation.paymentId, signature: confirmation.signature, kind: 'subscription' },
    });
    if (!result.confirmed) throw new InvalidPaymentSignatureError(subscription.provider);

    // 3. Refresh from provider
    return this.refreshSubscription(id);
  }

  async applyEvent(event: NormalizedEvent): Promise<string> {
    switch (event.type) {
      case 'payment.succeeded':
      case 'payment.failed': {
        // Matched by our reference first; the provider ref is the fallback
        const order = event.reference?.kind === 'platform_order'
          ? await this.orderDAO.findById(event.reference.id)
          : event.orderRef
            ? await this.orderDAO.findByProviderOrderId(event.orderRef)
            : null;
        if (!order) return 'no matching order';
        if (event.orderRef && order.providerOrderId && order.providerOrderId !== event.orderRef) {
          return 'reference/provider ref mismatch';
        }
        const to = event.type === 'payment.succeeded' ? 'paid' : 'failed';
        const updated = await this.applyOrderStatus(order, to, event.paymentId);
        return `order ${order.id} → ${updated.status}`;
      }
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'subscription.halted':
      case 'subscription.completed': {
        const subscription = event.reference?.kind === 'platform_subscription'
          ? await this.subscriptionDAO.findById(event.reference.id)
          : event.subscriptionRef
            ? await this.subscriptionDAO.findByProviderSubscriptionId(event.subscriptionRef)
            : null;
        if (!subscription) return 'no matching subscription';

        if (event.type === 'subscription.charged') {
          return this.prisma.$transaction(async (tx) => {
            const txSubscriptionDAO = new PlatformSubscriptionDAO(tx);
            const txPaymentDAO = new PlatformPaymentDAO(tx);
            const moved = await txSubscriptionDAO.updateIfStatus(subscription.id, LIVE_SUBSCRIPTION_STATUSES, {
              status: 'active',
              currentPeriodStart: event.subscriptionPeriod?.start,
              currentPeriodEnd: event.subscriptionPeriod?.end,
            });
            let note = `subscription ${subscription.id} charged`;
            if (event.paymentId && event.amount && !(await txPaymentDAO.findByProviderPaymentId(event.paymentId))) {
              const hasPayments = await txPaymentDAO.existsForSubscription(subscription.id);
              await txPaymentDAO.create({
                kind: hasPayments ? 'subscription_renewal' : 'subscription_initial',
                provider: subscription.provider,
                environment: subscription.environment,
                providerPaymentId: event.paymentId,
                amount: event.amount.amountMinor,
                currencyCode: event.amount.currency,
                projectId: subscription.projectId,
                platformSubscriptionId: subscription.id,
              });
              note += ' (payment recorded)';
            } else {
              note += ' (payment already recorded)';
            }
            if (!moved) {
              const current = await txSubscriptionDAO.findById(subscription.id);
              note += `; status unchanged (${current?.status})`;
            }
            return note;
          });
        }

        const statusMap: Record<string, PlatformSubscription['status']> = {
          'subscription.activated': 'active',
          'subscription.cancelled': 'canceled',
          'subscription.halted': 'past_due',
          'subscription.completed': 'completed',
        };
        const newStatus = statusMap[event.type];
        const moved = await this.subscriptionDAO.updateIfStatus(subscription.id, subscriptionFromStates(newStatus), {
          status: newStatus,
          currentPeriodStart: event.subscriptionPeriod?.start,
          currentPeriodEnd: event.subscriptionPeriod?.end,
          canceledAt: newStatus === 'canceled' ? new Date() : undefined,
        });
        if (!moved) {
          const current = await this.subscriptionDAO.findById(subscription.id);
          return `subscription ${subscription.id} already ${current?.status}`;
        }
        return `subscription ${subscription.id} → ${newStatus}`;
      }
      case 'ignored':
        return 'ignored';
      default:
        return 'nothing to do';
    }
  }

  private async applyOrderStatus(
    order: PlatformOrder,
    to: 'pending' | 'paid' | 'failed' | 'refunded',
    paymentId?: string,
  ): Promise<PlatformOrder> {
    // 1. No-op if transition not allowed
    if (!canMovePayment(order.status, to)) return order;

    // 2. Non-paid transitions are single-table
    if (to !== 'paid') {
      await this.orderDAO.updateIfStatus(order.id, paymentFromStates(to), { status: to });
      return (await this.orderDAO.findById(order.id)) ?? order;
    }

    // 3. Paid → transaction: claim the transition, then record payment + fulfil
    return this.prisma.$transaction(async (tx) => {
      const txOrderDAO = new PlatformOrderDAO(tx);
      const txPaymentDAO = new PlatformPaymentDAO(tx);

      const claimed = await txOrderDAO.updateIfStatus(order.id, paymentFromStates('paid'), {
        status: 'paid',
        paidAt: new Date(),
        fulfilledAt: new Date(),
        providerPaymentId: paymentId ?? undefined,
      });
      if (!claimed) return (await txOrderDAO.findById(order.id)) ?? order;

      if (paymentId) {
        const existing = await txPaymentDAO.findByProviderPaymentId(paymentId);
        if (!existing) {
          await txPaymentDAO.create({
            kind: 'order',
            provider: order.provider,
            environment: order.environment,
            providerPaymentId: paymentId,
            amount: order.amount,
            currencyCode: order.currencyCode,
            projectId: order.projectId,
            platformOrderId: order.id,
          });
        }
      }

      return (await txOrderDAO.findById(order.id)) ?? order;
    });
  }
}
