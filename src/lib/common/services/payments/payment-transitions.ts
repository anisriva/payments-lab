import type { PaymentStatus, SubscriptionStatus } from '@/generated/prisma';

export function canMovePayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  if (from === 'paid' || from === 'refunded') return false;
  return (from === 'pending' && (to === 'paid' || to === 'failed' || to === 'refunded')) || (from === 'failed' && to === 'paid');
}

export function canMoveSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return false;
  if (from === 'canceled' || from === 'completed') return false;
  return true;
}

export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'completed',
];
export const LIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'incomplete', 'trialing', 'active', 'past_due',
];

export function paymentFromStates(to: PaymentStatus): PaymentStatus[] {
  return PAYMENT_STATUSES.filter((s) => canMovePayment(s, to));
}

export function subscriptionFromStates(to: SubscriptionStatus): SubscriptionStatus[] {
  return SUBSCRIPTION_STATUSES.filter((s) => canMoveSubscription(s, to));
}
