import type { PrismaClient, AiCreditPurchase, Subscription } from '@/generated/prisma';
import { PlatformPlanPriceDAO } from '@/lib/platform/dao/payments/platform-plan-price-dao';
import { SubscriptionDAO } from '@/lib/platform/dao/payments/subscription-dao';
import { AiCreditPurchaseDAO } from '@/lib/platform/dao/payments/ai-credit-purchase-dao';
import { PaymentDAO } from '@/lib/platform/dao/payments/payment-dao';
import { ProviderProductService } from '@/lib/common/services/payments/provider-product-service';
import {
  CREDIT_QUICK_PICKS,
  CREDIT_RATE_MINOR,
  MAX_CREDITS,
  MIN_CREDITS,
  PLATFORM_CURRENCY,
  PLATFORM_RECEIVER_COUNTRY,
  SUBSCRIPTION_TOTAL_CYCLES,
  getPaymentEnvironment,
  getPlatformProvider,
} from '@/lib/common/services/payments/payment-config';
import { canMovePayment, canMoveSubscription } from '@/lib/common/services/payments/payment-transitions';
import { getCapabilities, isProviderKey } from '@/lib/common/payments/core/factory';
import { selectProvider } from '@/lib/common/payments/core/selector';
import { InvalidPaymentSignatureError, ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { CheckoutInstruction, CheckoutMode, NormalizedEvent, ProviderKey } from '@/lib/common/payments/core/types';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import {
  CreditPurchaseNotFoundError,
  InvalidCreditAmountError,
  NoPaymentProviderAvailableError,
  PaymentNotStartedError,
  PlanPriceNotFoundError,
  PlatformSubscriptionNotFoundError,
} from './errors';

export class PlatformPaymentService {
  private planPriceDAO: PlatformPlanPriceDAO;
  private subscriptionDAO: SubscriptionDAO;
  private creditPurchaseDAO: AiCreditPurchaseDAO;
  private paymentDAO: PaymentDAO;
  private providerProductService: ProviderProductService;

  constructor(private readonly prisma: PrismaClient) {
    this.planPriceDAO = new PlatformPlanPriceDAO(prisma);
    this.subscriptionDAO = new SubscriptionDAO(prisma);
    this.creditPurchaseDAO = new AiCreditPurchaseDAO(prisma);
    this.paymentDAO = new PaymentDAO(prisma);
    this.providerProductService = new ProviderProductService(prisma);
  }

  async listPlanPrices() {
    const result = await this.planPriceDAO.listActive();
    return result.data;
  }

  async getSelectionPreview(payerCountry: string) {
    return {
      oneTime: selectProvider({
        flow: 'platform',
        mode: 'one_time',
        payerCountry,
        receiverCountry: PLATFORM_RECEIVER_COUNTRY,
      }),
      subscription: selectProvider({
        flow: 'platform',
        mode: 'subscription',
        payerCountry,
        receiverCountry: PLATFORM_RECEIVER_COUNTRY,
      }),
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

  private resolveProvider(
    gateway: ProviderKey | 'auto',
    payerCountry: string,
    mode: CheckoutMode
  ): { provider: ProviderKey; adapter: PaymentProvider; selectionReason?: string } {
    if (gateway === 'auto') {
      const result = selectProvider({
        flow: 'platform',
        mode,
        payerCountry,
        receiverCountry: PLATFORM_RECEIVER_COUNTRY,
      });
      if (result.provider === null) {
        throw new NoPaymentProviderAvailableError(result.reason);
      }
      return { provider: result.provider, adapter: getPlatformProvider(result.provider), selectionReason: result.reason };
    }
    if (!isProviderKey(gateway)) {
      throw new ProviderNotImplementedError(gateway);
    }
    const caps = getCapabilities(gateway);
    if (!caps.implemented || !caps.flows.includes('platform')) {
      throw new ProviderNotImplementedError(gateway);
    }
    return { provider: gateway, adapter: getPlatformProvider(gateway) };
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

    // 2. Resolve provider
    const { provider, adapter, selectionReason } = this.resolveProvider(input.gateway as ProviderKey | 'auto', input.payerCountry, 'one_time');

    // 3. Compute amount
    const amountMinor = credits * CREDIT_RATE_MINOR;

    // 4. Create pending record
    const purchase = await this.creditPurchaseDAO.create({
      kind,
      credits,
      amountMinor,
      currencyCode: PLATFORM_CURRENCY,
      provider,
      environment: getPaymentEnvironment(),
      status: 'pending',
    });

    // 5. Create provider checkout (outside any transaction)
    let checkout;
    try {
      checkout = await adapter.createOneTimeCheckout({
        amount: { amountMinor, currency: PLATFORM_CURRENCY },
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

    // 6. Save provider ref and return
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
    const { provider, adapter, selectionReason } = this.resolveProvider(input.gateway as ProviderKey | 'auto', input.payerCountry, 'subscription');

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
