import { randomUUID } from 'node:crypto';
import type { PrismaClient, ProjectOffering, ProjectOrder, ProjectSubscription } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { ProjectOfferingDAO } from '@/lib/project/dao/payments/project-offering-dao';
import { ProjectOfferingPriceDAO } from '@/lib/project/dao/payments/project-offering-price-dao';
import { ProjectPaymentDAO } from '@/lib/project/dao/payments/project-payment-dao';
import { ProjectOrderDAO } from '@/lib/project/dao/payments/project-order-dao';
import { ProjectSubscriptionDAO } from '@/lib/project/dao/payments/project-subscription-dao';
import { ProjectPaymentConnectionDAO } from '@/lib/project/dao/payments/project-payment-connection-dao';
import { ProjectPaymentConnectionService } from './project-payment-connection-service';
import { ensurePlanRef, readPlanRef } from '@/lib/common/services/payments/provider-plan-service';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import {
  canMovePayment,
  paymentFromStates,
  subscriptionFromStates,
  LIVE_SUBSCRIPTION_STATUSES,
} from '@/lib/common/services/payments/payment-transitions';
import { SUBSCRIPTION_TOTAL_CYCLES } from '@/lib/common/services/payments/payment-constants';
import { getPaymentEnvironment } from '@/config/payments/env';
import { currencyAllowed } from '@/lib/common/payments/core/coverage';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { InvalidPaymentSignatureError, PaymentCapabilityNotSupportedError } from '@/lib/common/payments/core/errors';
import type { CheckoutInstruction } from '@/lib/common/payments/core/contracts/checkout';
import type { NormalizedEvent } from '@/lib/common/payments/core/contracts/events';
import type { PaginationInput } from '@/types/common/pagination';
import type { PaymentProvider as DbProvider } from '@/generated/prisma';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import {
  AmountBelowMinimumError,
  CurrencyNotSupportedError,
  GatewayNotConnectedError,
  InvalidOfferingError,
  OfferingInUseError,
  OfferingNotFoundError,
  OfferingNotPurchasableError,
  ProjectOrderNotFoundError,
  ProjectSubscriptionNotFoundError,
} from './errors';
import { PaymentNotStartedError } from '@/lib/platform/services/payments/errors';

export class ProjectPaymentService {
  private projectDAO: ProjectDAO;
  private offeringDAO: ProjectOfferingDAO;
  private offeringPriceDAO: ProjectOfferingPriceDAO;
  private paymentDAO: ProjectPaymentDAO;
  private orderDAO: ProjectOrderDAO;
  private subscriptionDAO: ProjectSubscriptionDAO;
  private connectionDAO: ProjectPaymentConnectionDAO;
  private connectionService: ProjectPaymentConnectionService;
  private providerRulesService: ProviderRulesService;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient) {
    this.projectDAO = new ProjectDAO(prisma);
    this.offeringDAO = new ProjectOfferingDAO(prisma);
    this.offeringPriceDAO = new ProjectOfferingPriceDAO(prisma);
    this.paymentDAO = new ProjectPaymentDAO(prisma);
    this.orderDAO = new ProjectOrderDAO(prisma);
    this.subscriptionDAO = new ProjectSubscriptionDAO(prisma);
    this.connectionDAO = new ProjectPaymentConnectionDAO(prisma);
    this.connectionService = new ProjectPaymentConnectionService(prisma);
    this.providerRulesService = new ProviderRulesService(prisma);
    this.countryService = new CountryService(prisma);
  }

  async listOfferings(projectId: string, pagination?: PaginationInput) {
    return this.offeringDAO.listByProject(projectId, { pagination });
  }

  async listActiveOfferings(projectId: string, pagination?: PaginationInput) {
    return this.offeringDAO.listActiveByProject(projectId, { pagination });
  }

  async listOfferingsForSetup(projectId: string, pagination?: PaginationInput) {
    const result = await this.offeringDAO.listByProject(projectId, { pagination });
    const connections = await this.connectionDAO.listEnabledByProject(projectId);
    const byId = new Map(connections.map((c) => [c.id, c.provider]));
    const prices = await Promise.all(result.data.map((o) => this.offeringPriceDAO.listForOffering(o.id)));
    return {
      ...result,
      data: result.data.map((o, i) => ({
        ...o,
        prices: prices[i],
        providerRefs: prices[i].flatMap((pr) =>
          Object.entries((pr.providerPlanRefs ?? {}) as Record<string, string>).map(
            ([connectionId, providerRef]) => ({ scope: connectionId, provider: byId.get(connectionId) ?? connectionId, providerRef }),
          )),
      })),
    };
  }

  async listOrders(input: { projectId: string; provider?: DbProvider; pagination?: PaginationInput }) {
    return this.orderDAO.list({ pagination: input.pagination, filters: { projectId: input.projectId, provider: input.provider } });
  }

  async listSubscriptions(input: { projectId: string; provider?: DbProvider; buyerEmail?: string; pagination?: PaginationInput }) {
    return this.subscriptionDAO.list({ pagination: input.pagination, filters: { projectId: input.projectId, provider: input.provider, buyerEmail: input.buyerEmail } });
  }

  async createOffering(projectId: string, data: { name: string; priceType: 'fixed' | 'custom' | 'recurring'; amountMinor: number; interval?: 'monthly' | 'yearly' }) {
    const project = await this.projectDAO.findById(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    if (!Number.isInteger(data.amountMinor) || data.amountMinor < 100) {
      throw new InvalidOfferingError('amountMinor must be an integer of at least 100');
    }
    if (data.priceType === 'recurring' && !data.interval) {
      throw new InvalidOfferingError('recurring offerings require an interval');
    }
    if (data.priceType !== 'recurring' && data.interval) {
      throw new InvalidOfferingError('only recurring offerings may have an interval');
    }

    const currencyCode = (await this.countryService.getCountry(project.countryCode)).currencyCode;
    const offeringId = randomUUID();
    const priceId = data.priceType === 'recurring' ? randomUUID() : undefined;
    const providerPlanRefs: Record<string, string> = {};

    // Eager plan creation at every enabled connection that supports it
    // (external calls — outside any transaction; any failure aborts the create)
    if (data.priceType === 'recurring') {
      const connections = await this.connectionDAO.listEnabledByProject(projectId);
      for (const connection of connections) {
        const rule = await this.providerRulesService.getRule(connection.provider, 'project');
        if (!rule?.isEnabled || !currencyAllowed(rule.currencies, currencyCode)) continue;
        const { adapter } = await this.connectionService.getAdapter(connection.id, { requireEnabled: true });
        if (!supports(adapter.manifest, 'subscription_plan.create')) continue;
        const { providerRef } = await adapter.createSubscriptionPlan!({
          name: data.name,
          amount: { amountMinor: data.amountMinor, currency: currencyCode },
          interval: data.interval!,
        });
        providerPlanRefs[connection.id] = providerRef;
      }
    }

    const offering = await this.offeringDAO.create({
      id: offeringId, projectId, module: 'shop', moduleItemId: offeringId,
      name: data.name, isActive: true,
    });
    await this.offeringPriceDAO.create({
      id: priceId, offeringId: offering.id, marketId: null, priceType: data.priceType,
      amount: data.amountMinor, currencyCode, billingMode: data.interval ?? null,
      providerPlanRefs, isActive: true,
    });
    return offering;
  }

  async updateOffering(
    projectId: string,
    offeringId: string,
    data: { name?: string; isActive?: boolean },
  ): Promise<ProjectOffering> {
    const offering = await this.offeringDAO.findById(offeringId);
    if (!offering || offering.projectId !== projectId) throw new OfferingNotFoundError(offeringId);
    return this.offeringDAO.update(offeringId, data);
  }

  async deleteOffering(projectId: string, offeringId: string): Promise<void> {
    const offering = await this.offeringDAO.findById(offeringId);
    if (!offering || offering.projectId !== projectId) throw new OfferingNotFoundError(offeringId);
    if (
      (await this.orderDAO.existsForOffering(offeringId)) ||
      (await this.subscriptionDAO.existsForOffering(offeringId))
    ) {
      throw new OfferingInUseError(offeringId);
    }
    await this.offeringDAO.delete(offeringId);
  }

  private async getActiveConnection(projectId: string, provider: string) {
    const connection = await this.connectionService.getForProject(projectId, provider);
    if (!connection || !connection.isEnabled) throw new GatewayNotConnectedError(provider);
    return this.connectionService.getAdapter(connection.id, { requireEnabled: true });
  }

  private async assertCurrencySupported(provider: DbProvider, currencyCode: string) {
    const rule = await this.providerRulesService.getRule(provider, 'project');
    const covered = rule?.currencies ?? '*';
    if (!currencyAllowed(covered, currencyCode)) {
      throw new CurrencyNotSupportedError(provider, currencyCode);
    }
  }

  async startOrder(projectId: string, input: { provider: string; offeringId: string; buyerEmail: string; amountMinor?: number }): Promise<{ recordId: string; provider: DbProvider; instruction: CheckoutInstruction }> {
    const offering = await this.offeringDAO.findById(input.offeringId);
    if (!offering || offering.projectId !== projectId || !offering.isActive) throw new OfferingNotFoundError(input.offeringId);
    const market = await this.countryService.getMarket(projectId ? (await this.projectDAO.findById(projectId))!.countryCode : '');
    const price = await this.offeringPriceDAO.resolveForMarket(offering.id, market?.id ?? null);
    if (!price || price.priceType === 'recurring') throw new OfferingNotPurchasableError(offering.name);

    let unitAmount: number;
    if (price.priceType === 'fixed') {
      unitAmount = price.amount;
    } else {
      const clientAmount = input.amountMinor;
      if (!Number.isInteger(clientAmount) || clientAmount! < price.amount) {
        throw new AmountBelowMinimumError(price.amount);
      }
      unitAmount = clientAmount!;
    }

    const { connection, adapter } = await this.getActiveConnection(projectId, input.provider);
    await this.assertCurrencySupported(connection.provider, price.currencyCode);
    if (!supports(adapter.manifest, 'checkout.one_time')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'one-time checkout');
    }
    if (price.priceType === 'custom' && !supports(adapter.manifest, 'checkout.custom_amount')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'custom amounts');
    }

    const projectUser = await this.prisma.projectUser.upsert({
      where: { projectId_email: { projectId, email: input.buyerEmail } },
      create: { projectId, email: input.buyerEmail },
      update: {},
    });
    const order = await this.orderDAO.create({
      projectId, projectUserId: projectUser.id, connectionId: connection.id,
      projectOfferingPriceId: price.id, provider: connection.provider,
      environment: getPaymentEnvironment(), buyerEmail: input.buyerEmail,
      quantity: 1, unitAmount, amount: unitAmount, currencyCode: price.currencyCode, status: 'pending',
    });

    let checkout;
    try {
      checkout = await adapter.createOneTimeCheckout!({
        reference: { kind: 'project_order', id: order.id },
        amount: { amountMinor: unitAmount, currency: price.currencyCode },
        description: offering.name,
        buyer: { email: input.buyerEmail },
        context: { projectId },
      });
    } catch (e) {
      await this.orderDAO.update(order.id, { status: 'failed', failureReason: e instanceof Error ? e.message : 'Unknown error' });
      throw e;
    }
    await this.orderDAO.update(order.id, { providerOrderId: checkout.providerRef });
    return { recordId: order.id, provider: connection.provider, instruction: checkout.instruction };
  }

  async startSubscription(projectId: string, input: { provider: string; offeringId: string; buyerEmail: string }): Promise<{ recordId: string; provider: DbProvider; instruction: CheckoutInstruction }> {
    const offering = await this.offeringDAO.findById(input.offeringId);
    if (!offering || offering.projectId !== projectId || !offering.isActive) throw new OfferingNotFoundError(input.offeringId);
    const project = await this.projectDAO.findById(projectId);
    const market = project ? await this.countryService.getMarket(project.countryCode) : null;
    const price = await this.offeringPriceDAO.resolveForMarket(offering.id, market?.id ?? null);
    if (!price || price.priceType !== 'recurring') throw new OfferingNotPurchasableError(offering.name);

    const { connection, adapter } = await this.getActiveConnection(projectId, input.provider);
    await this.assertCurrencySupported(connection.provider, price.currencyCode);
    if (!supports(adapter.manifest, 'subscription.create')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'subscriptions');
    }

    const planRef = await ensurePlanRef({
      providerPlanRefs: price.providerPlanRefs,
      key: connection.id,
      adapter,
      plan: {
        name: offering.name,
        amount: { amountMinor: price.amount, currency: price.currencyCode },
        interval: price.billingMode!,
      },
      persist: async (refs) => { await this.offeringPriceDAO.update(price.id, { providerPlanRefs: refs }); },
    });

    const projectUser = await this.prisma.projectUser.upsert({
      where: { projectId_email: { projectId, email: input.buyerEmail } },
      create: { projectId, email: input.buyerEmail },
      update: {},
    });
    const subscription = await this.subscriptionDAO.create({
      projectId, projectUserId: projectUser.id, connectionId: connection.id,
      projectOfferingPriceId: price.id, provider: connection.provider, quantity: 1,
      environment: getPaymentEnvironment(), buyerEmail: input.buyerEmail, status: 'incomplete',
    });

    let checkout;
    try {
      checkout = await adapter.createSubscription!({
        reference: { kind: 'project_subscription', id: subscription.id },
        planRef,
        totalCycles: SUBSCRIPTION_TOTAL_CYCLES[price.billingMode!],
        description: offering.name,
        buyer: { email: input.buyerEmail },
        context: { projectId },
      });
    } catch (e) {
      await this.subscriptionDAO.update(subscription.id, { status: 'canceled', failureReason: e instanceof Error ? e.message : 'Unknown error' });
      throw e;
    }
    await this.subscriptionDAO.update(subscription.id, { providerSubscriptionId: checkout.providerRef });
    return { recordId: subscription.id, provider: connection.provider, instruction: checkout.instruction };
  }

  async cancelSubscription(projectId: string, id: string, atPeriodEnd: boolean): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    if (!sub.providerSubscriptionId) throw new PaymentNotStartedError(id);
    const { adapter } = await this.connectionService.getAdapter(sub.connectionId, { requireEnabled: false });
    const feature = atPeriodEnd ? 'subscription.cancel_at_period_end' : 'subscription.cancel';
    if (!supports(adapter.manifest, feature)) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'subscription cancellation');
    }
    await adapter.cancelSubscription!(sub.providerSubscriptionId, { atPeriodEnd });
    await this.subscriptionDAO.update(id, { cancelAtPeriodEnd: atPeriodEnd });
    return this.refreshSubscription(projectId, id);
  }

  async refreshOrder(projectId: string, id: string): Promise<ProjectOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order || order.projectId !== projectId) throw new ProjectOrderNotFoundError(id);
    if (!order.providerOrderId) return order;
    const { adapter } = await this.connectionService.getAdapter(order.connectionId, { requireEnabled: false });
    if (!supports(adapter.manifest, 'payment.read')) return order;
    const result = await adapter.getPaymentStatus!(order.providerOrderId);
    return this.applyOrderStatus(order, result.status === 'refunded' ? 'refunded' : result.status, result.paymentId);
  }

  async syncOrder(projectId: string, id: string): Promise<ProjectOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order || order.projectId !== projectId) throw new ProjectOrderNotFoundError(id);
    return order.status === 'pending' ? this.refreshOrder(projectId, id) : order;
  }

  async refreshSubscription(projectId: string, id: string): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    if (!sub.providerSubscriptionId) return sub;
    const { adapter } = await this.connectionService.getAdapter(sub.connectionId, { requireEnabled: false });
    if (!supports(adapter.manifest, 'subscription.read')) return sub;
    const result = await adapter.getSubscriptionStatus!(sub.providerSubscriptionId);
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
    return (await this.subscriptionDAO.findById(id)) ?? sub;
  }

  async syncSubscription(projectId: string, id: string): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    return sub.status === 'incomplete' ? this.refreshSubscription(projectId, id) : sub;
  }

  async confirmOrder(projectId: string, id: string, confirmation: { paymentId: string; signature: string }): Promise<ProjectOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order || order.projectId !== projectId) throw new ProjectOrderNotFoundError(id);
    if (!order.providerOrderId) throw new PaymentNotStartedError(id);
    const { adapter } = await this.connectionService.getAdapter(order.connectionId, { requireEnabled: false });
    if (!supports(adapter.manifest, 'checkout.client_confirmation')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'client confirmation');
    }
    const result = await adapter.confirmClientPayment!({
      providerRef: order.providerOrderId,
      payload: { paymentId: confirmation.paymentId, signature: confirmation.signature, kind: 'order' },
    });
    if (!result.confirmed) throw new InvalidPaymentSignatureError(order.provider);
    return this.refreshOrder(projectId, id);
  }

  async confirmSubscription(projectId: string, id: string, confirmation: { paymentId: string; signature: string }): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    if (!sub.providerSubscriptionId) throw new PaymentNotStartedError(id);
    const { adapter } = await this.connectionService.getAdapter(sub.connectionId, { requireEnabled: false });
    if (!supports(adapter.manifest, 'checkout.client_confirmation')) {
      throw new PaymentCapabilityNotSupportedError(adapter.manifest.brand.name, 'client confirmation');
    }
    const result = await adapter.confirmClientPayment!({
      providerRef: sub.providerSubscriptionId,
      payload: { paymentId: confirmation.paymentId, signature: confirmation.signature, kind: 'subscription' },
    });
    if (!result.confirmed) throw new InvalidPaymentSignatureError(sub.provider);
    return this.refreshSubscription(projectId, id);
  }

  async applyEvent(event: NormalizedEvent, connectionId: string): Promise<string> {
    switch (event.type) {
      case 'payment.succeeded':
      case 'payment.failed': {
        const order = event.reference?.kind === 'project_order'
          ? await this.orderDAO.findById(event.reference.id)
          : event.orderRef
            ? await this.orderDAO.findByConnectionAndProviderOrderId(connectionId, event.orderRef)
            : null;
        if (!order || order.connectionId !== connectionId) return 'no matching order';
        const to = event.type === 'payment.succeeded' ? 'paid' : 'failed';
        const updated = await this.applyOrderStatus(order, to, event.paymentId);
        return `order ${order.id} → ${updated.status}`;
      }
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'subscription.halted':
      case 'subscription.completed': {
        const sub = event.reference?.kind === 'project_subscription'
          ? await this.subscriptionDAO.findById(event.reference.id)
          : event.subscriptionRef
            ? await this.subscriptionDAO.findByConnectionAndProviderSubscriptionId(connectionId, event.subscriptionRef)
            : null;
        if (!sub || sub.connectionId !== connectionId) return 'no matching subscription';

        if (event.type === 'subscription.charged') {
          return this.prisma.$transaction(async (tx) => {
            const txSubscriptionDAO = new ProjectSubscriptionDAO(tx);
            const txPaymentDAO = new ProjectPaymentDAO(tx);
            const moved = await txSubscriptionDAO.updateIfStatus(sub.id, LIVE_SUBSCRIPTION_STATUSES, {
              status: 'active',
              currentPeriodStart: event.subscriptionPeriod?.start,
              currentPeriodEnd: event.subscriptionPeriod?.end,
            });
            let note = `subscription ${sub.id} charged`;
            if (event.paymentId && event.amount && !(await txPaymentDAO.findByProviderPaymentId(event.paymentId))) {
              const hasPayments = await txPaymentDAO.existsForSubscription(sub.id);
              await txPaymentDAO.create({
                projectId: sub.projectId,
                kind: hasPayments ? 'subscription_renewal' : 'subscription_initial',
                provider: sub.provider,
                providerPaymentId: event.paymentId,
                amount: event.amount.amountMinor,
                currencyCode: event.amount.currency,
                projectSubscriptionId: sub.id,
              });
              note += ' (payment recorded)';
            } else {
              note += ' (payment already recorded)';
            }
            if (!moved) {
              const current = await txSubscriptionDAO.findById(sub.id);
              note += `; status unchanged (${current?.status})`;
            }
            return note;
          });
        }

        const map: Record<string, ProjectSubscription['status']> = {
          'subscription.activated': 'active',
          'subscription.cancelled': 'canceled',
          'subscription.halted': 'past_due',
          'subscription.completed': 'completed',
        };
        const to = map[event.type];
        const moved = await this.subscriptionDAO.updateIfStatus(sub.id, subscriptionFromStates(to), {
          status: to,
          currentPeriodStart: event.subscriptionPeriod?.start,
          currentPeriodEnd: event.subscriptionPeriod?.end,
          canceledAt: to === 'canceled' ? new Date() : undefined,
        });
        if (!moved) {
          const current = await this.subscriptionDAO.findById(sub.id);
          return `subscription ${sub.id} already ${current?.status}`;
        }
        return `subscription ${sub.id} → ${to}`;
      }
      default:
        return 'nothing to do';
    }
  }

  private async applyOrderStatus(order: ProjectOrder, to: 'pending' | 'paid' | 'failed' | 'refunded', paymentId?: string): Promise<ProjectOrder> {
    if (!canMovePayment(order.status, to)) return order;
    if (to === 'paid') {
      return this.prisma.$transaction(async (tx) => {
        const txOrderDAO = new ProjectOrderDAO(tx);
        const txPaymentDAO = new ProjectPaymentDAO(tx);
        const claimed = await txOrderDAO.updateIfStatus(order.id, paymentFromStates('paid'), {
          status: 'paid', paidAt: new Date(), fulfilledAt: new Date(), providerPaymentId: paymentId ?? undefined,
        });
        if (!claimed) return (await txOrderDAO.findById(order.id)) ?? order;
        if (paymentId && !(await txPaymentDAO.findByProviderPaymentId(paymentId))) {
          await txPaymentDAO.create({
            projectId: order.projectId, kind: 'order', provider: order.provider,
            providerPaymentId: paymentId, amount: order.amount, currencyCode: order.currencyCode,
            projectOrderId: order.id,
          });
        }
        return (await txOrderDAO.findById(order.id)) ?? order;
      });
    }
    await this.orderDAO.updateIfStatus(order.id, paymentFromStates(to), { status: to });
    return (await this.orderDAO.findById(order.id)) ?? order;
  }
}
