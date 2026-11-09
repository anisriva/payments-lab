import type { Money } from './provider';

export type PaymentRecordKind =
  | 'platform_subscription'   // base plan or a recurring platform offering (e.g. seats)
  | 'platform_order'          // one-time platform offering (AI credits, storage extension…)
  | 'project_subscription'
  | 'project_order';

export interface PaymentReference { kind: PaymentRecordKind; id: string; }
export interface PaymentContext { projectId?: string; platformUserId?: string; sku?: string; }

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
  reference?: PaymentReference;  // our own record reference — matched first
  orderRef?: string;             // provider-side refs — fallback matching only
  subscriptionRef?: string;
  paymentId?: string;
  amount?: Money;
  subscriptionPeriod?: { start: Date; end: Date };
  occurredAt: Date;
}
