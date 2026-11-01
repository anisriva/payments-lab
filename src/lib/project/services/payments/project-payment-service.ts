import type { PrismaClient, ProjectOrder, ProjectSubscription } from '@/generated/prisma';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { ProjectOfferingDAO } from '@/lib/project/dao/payments/project-offering-dao';
import { ProjectOrderDAO } from '@/lib/project/dao/payments/project-order-dao';
import { ProjectSubscriptionDAO } from '@/lib/project/dao/payments/project-subscription-dao';
import { PaymentConnectionService } from './payment-connection-service';
import { ProviderProductService } from '@/lib/common/services/payments/provider-product-service';
import { canMovePayment, canMoveSubscription } from '@/lib/common/services/payments/payment-transitions';
import { SUBSCRIPTION_TOTAL_CYCLES } from '@/lib/common/services/payments/payment-constants';
import { getPaymentEnvironment } from '@/lib/common/services/payments/payment-config';
import { InvalidPaymentSignatureError } from '@/lib/common/payments/core/errors';
import type { CheckoutInstruction, NormalizedEvent } from '@/lib/common/payments/core/types';
import type { PaginationInput } from '@/types/common/pagination';
import type { PaymentProvider as DbProvider } from '@/generated/prisma';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import {
  AmountBelowMinimumError,
  GatewayNotConnectedError,
  InvalidOfferingError,
  OfferingNotFoundError,
  OfferingNotPurchasableError,
  ProjectOrderNotFoundError,
  ProjectSubscriptionNotFoundError,
} from './errors';
import { PaymentNotStartedError } from '@/lib/platform/services/payments/errors';

const CURRENCY = 'INR';

export class ProjectPaymentService {
  private projectDAO: ProjectDAO;
  private offeringDAO: ProjectOfferingDAO;
  private orderDAO: ProjectOrderDAO;
  private subscriptionDAO: ProjectSubscriptionDAO;
  private paymentConnectionService: PaymentConnectionService;
  private providerProductService: ProviderProductService;

  constructor(private readonly prisma: PrismaClient) {
    this.projectDAO = new ProjectDAO(prisma);
    this.offeringDAO = new ProjectOfferingDAO(prisma);
    this.orderDAO = new ProjectOrderDAO(prisma);
    this.subscriptionDAO = new ProjectSubscriptionDAO(prisma);
    this.paymentConnectionService = new PaymentConnectionService(prisma);
    this.providerProductService = new ProviderProductService(prisma);
  }

  async listOfferings(projectId: string, pagination?: PaginationInput) {
    return this.offeringDAO.listByProject(projectId, { pagination });
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
    return this.offeringDAO.create({ projectId, name: data.name, priceType: data.priceType, amountMinor: data.amountMinor, interval: data.interval, currencyCode: CURRENCY, isActive: true });
  }

  private async getActiveConnection(projectId: string, provider: string) {
    const connection = await this.paymentConnectionService.getForProject(projectId, provider);
    if (!connection || !connection.isEnabled) throw new GatewayNotConnectedError(provider);
    return this.paymentConnectionService.getAdapter(connection.id, { requireEnabled: true });
  }

  async startOrder(projectId: string, input: { provider: string; offeringId: string; buyerEmail: string; amountMinor?: number }): Promise<{ recordId: string; instruction: CheckoutInstruction }> {
    const offering = await this.offeringDAO.findById(input.offeringId);
    if (!offering || offering.projectId !== projectId || !offering.isActive) throw new OfferingNotFoundError(input.offeringId);
    if (offering.priceType === 'recurring') throw new OfferingNotPurchasableError(offering.name);

    let amountMinor: number;
    if (offering.priceType === 'fixed') {
      amountMinor = offering.amountMinor;
    } else {
      const clientAmount = input.amountMinor;
      if (!Number.isInteger(clientAmount) || clientAmount! < offering.amountMinor) {
        throw new AmountBelowMinimumError(offering.amountMinor);
      }
      amountMinor = clientAmount!;
    }

    const { connection, adapter } = await this.getActiveConnection(projectId, input.provider);

    const order = await this.orderDAO.create({
      projectId, connectionId: connection.id, offeringId: offering.id, provider: connection.provider,
      environment: getPaymentEnvironment(), buyerEmail: input.buyerEmail,
      amountMinor, currencyCode: CURRENCY, status: 'pending',
    });

    let checkout;
    try {
      checkout = await adapter.createOneTimeCheckout({
        amount: { amountMinor, currency: CURRENCY },
        description: offering.name, receipt: order.id, buyerEmail: input.buyerEmail,
        notes: { flow: 'project', recordId: order.id },
      });
    } catch (e) {
      await this.orderDAO.update(order.id, { status: 'failed', failureReason: e instanceof Error ? e.message : 'Unknown error' });
      throw e;
    }
    await this.orderDAO.update(order.id, { providerOrderId: checkout.providerRef });
    return { recordId: order.id, instruction: checkout.instruction };
  }

  async startSubscription(projectId: string, input: { provider: string; offeringId: string; buyerEmail: string }): Promise<{ recordId: string; instruction: CheckoutInstruction }> {
    const offering = await this.offeringDAO.findById(input.offeringId);
    if (!offering || offering.projectId !== projectId || !offering.isActive) throw new OfferingNotFoundError(input.offeringId);
    if (offering.priceType !== 'recurring') throw new OfferingNotPurchasableError(offering.name);

    const { connection, adapter } = await this.getActiveConnection(projectId, input.provider);

    const productRef = await this.providerProductService.ensure({
      scope: connection.id, provider: connection.provider, environment: getPaymentEnvironment(),
      refType: 'offering', refId: offering.id, adapter,
      product: { name: offering.name, amount: { amountMinor: offering.amountMinor, currency: offering.currencyCode }, interval: offering.interval! },
    });

    const subscription = await this.subscriptionDAO.create({
      projectId, connectionId: connection.id, offeringId: offering.id, provider: connection.provider,
      environment: getPaymentEnvironment(), buyerEmail: input.buyerEmail, status: 'pending',
    });

    let checkout;
    try {
      checkout = await adapter.createSubscription({
        productRef, totalCycles: SUBSCRIPTION_TOTAL_CYCLES[offering.interval!],
        description: offering.name, buyerEmail: input.buyerEmail,
        notes: { flow: 'project', recordId: subscription.id },
      });
    } catch (e) {
      await this.subscriptionDAO.update(subscription.id, { status: 'cancelled', failureReason: e instanceof Error ? e.message : 'Unknown error' });
      throw e;
    }
    await this.subscriptionDAO.update(subscription.id, { providerSubscriptionId: checkout.providerRef });
    return { recordId: subscription.id, instruction: checkout.instruction };
  }

  async cancelSubscription(projectId: string, id: string, atCycleEnd: boolean): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    if (!sub.providerSubscriptionId) throw new PaymentNotStartedError(id);
    const { adapter } = await this.paymentConnectionService.getAdapter(sub.connectionId, { requireEnabled: false });
    await adapter.cancelSubscription(sub.providerSubscriptionId, { atCycleEnd });
    await this.subscriptionDAO.update(id, { cancelAtCycleEnd: atCycleEnd });
    return this.refreshSubscription(projectId, id);
  }

  async refreshOrder(projectId: string, id: string): Promise<ProjectOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order || order.projectId !== projectId) throw new ProjectOrderNotFoundError(id);
    if (!order.providerOrderId) return order;
    const { adapter } = await this.paymentConnectionService.getAdapter(order.connectionId, { requireEnabled: false });
    const result = await adapter.getPaymentStatus(order.providerOrderId);
    return this.applyOrderStatus(order, result.status, result.paymentId);
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
    const { adapter } = await this.paymentConnectionService.getAdapter(sub.connectionId, { requireEnabled: false });
    const result = await adapter.getSubscriptionStatus(sub.providerSubscriptionId);
    if (canMoveSubscription(sub.status, result.status)) {
      return this.subscriptionDAO.update(id, {
        status: result.status,
        currentPeriodStart: result.currentPeriodStart ?? undefined,
        currentPeriodEnd: result.currentPeriodEnd ?? undefined,
        canceledAt: result.status === 'cancelled' ? new Date() : undefined,
      });
    }
    return sub;
  }

  async syncSubscription(projectId: string, id: string): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    return sub.status === 'pending' ? this.refreshSubscription(projectId, id) : sub;
  }

  async confirmOrder(projectId: string, id: string, confirmation: { paymentId: string; signature: string }): Promise<ProjectOrder> {
    const order = await this.orderDAO.findById(id);
    if (!order || order.projectId !== projectId) throw new ProjectOrderNotFoundError(id);
    if (!order.providerOrderId) throw new PaymentNotStartedError(id);
    const { adapter } = await this.paymentConnectionService.getAdapter(order.connectionId, { requireEnabled: false });
    const valid = adapter.verifyClientConfirmation({ kind: 'order', providerRef: order.providerOrderId, paymentId: confirmation.paymentId, signature: confirmation.signature });
    if (!valid) throw new InvalidPaymentSignatureError(order.provider);
    return this.refreshOrder(projectId, id);
  }

  async confirmSubscription(projectId: string, id: string, confirmation: { paymentId: string; signature: string }): Promise<ProjectSubscription> {
    const sub = await this.subscriptionDAO.findById(id);
    if (!sub || sub.projectId !== projectId) throw new ProjectSubscriptionNotFoundError(id);
    if (!sub.providerSubscriptionId) throw new PaymentNotStartedError(id);
    const { adapter } = await this.paymentConnectionService.getAdapter(sub.connectionId, { requireEnabled: false });
    const valid = adapter.verifyClientConfirmation({ kind: 'subscription', providerRef: sub.providerSubscriptionId, paymentId: confirmation.paymentId, signature: confirmation.signature });
    if (!valid) throw new InvalidPaymentSignatureError(sub.provider);
    return this.refreshSubscription(projectId, id);
  }

  async applyEvent(event: NormalizedEvent, connectionId: string): Promise<string> {
    switch (event.type) {
      case 'payment.succeeded':
      case 'payment.failed': {
        const order = event.orderRef ? await this.orderDAO.findByConnectionAndProviderOrderId(connectionId, event.orderRef) : null;
        if (!order) return 'no matching order';
        const to = event.type === 'payment.succeeded' ? 'paid' : 'failed';
        const updated = await this.applyOrderStatus(order, to, event.paymentId);
        return `order ${order.id} → ${updated.status}`;
      }
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'subscription.halted':
      case 'subscription.completed': {
        const sub = event.subscriptionRef ? await this.subscriptionDAO.findByConnectionAndProviderSubscriptionId(connectionId, event.subscriptionRef) : null;
        if (!sub) return 'no matching subscription';
        const map: Record<string, ProjectSubscription['status']> = {
          'subscription.activated': 'active', 'subscription.charged': 'active',
          'subscription.cancelled': 'cancelled', 'subscription.halted': 'halted', 'subscription.completed': 'completed',
        };
        const to = map[event.type];
        if (!canMoveSubscription(sub.status, to)) return `subscription ${sub.id} already ${sub.status}`;
        await this.subscriptionDAO.update(sub.id, {
          status: to,
          currentPeriodStart: event.subscriptionPeriod?.start,
          currentPeriodEnd: event.subscriptionPeriod?.end,
          canceledAt: to === 'cancelled' ? new Date() : undefined,
        });
        return `subscription ${sub.id} → ${to}`;
      }
      default:
        return 'nothing to do';
    }
  }

  private async applyOrderStatus(order: ProjectOrder, to: 'pending' | 'paid' | 'failed', paymentId?: string): Promise<ProjectOrder> {
    if (!canMovePayment(order.status, to)) return order;
    if (to === 'paid') {
      return this.orderDAO.update(order.id, { status: 'paid', paidAt: new Date(), providerPaymentId: paymentId ?? undefined });
    }
    return this.orderDAO.update(order.id, { status: to });
  }
}
