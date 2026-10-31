import type { PaymentStatus, SubscriptionStatus } from '@/generated/prisma';

export function canMovePayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  if (from === 'paid') return false;
  return (from === 'pending' && (to === 'paid' || to === 'failed')) || (from === 'failed' && to === 'paid');
}

export function canMoveSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return false;
  if (from === 'cancelled' || from === 'completed') return false;
  return true;
}
