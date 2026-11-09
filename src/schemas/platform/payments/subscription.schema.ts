import { z } from 'zod';

/**
 * Schema for starting a platform subscription
 * Used by:
 * - API: /api/platform/payments/subscriptions (POST)
 * - Hook: useStartPlatformSubscription
 * - Form: subscription plan cards
 */
export const platformSubscriptionCreateSchema = z.object({
  projectId: z.string().min(1),
  gateway: z.string().min(1),
  payerCountry: z.string().length(2),
  planPriceId: z.string().uuid(),
});

export type PlatformSubscriptionCreate = z.infer<typeof platformSubscriptionCreateSchema>;

/**
 * Schema for cancelling a subscription
 * Used by:
 * - API: /api/platform/payments/subscriptions/[id]/cancel (POST)
 * - API: /api/project/[projectId]/payments/subscriptions/[id]/cancel (POST)
 * - Hooks: useCancelPlatformSubscription, useCancelProjectSubscription
 */
export const subscriptionCancelSchema = z.object({
  atCycleEnd: z.boolean(),
});

export type SubscriptionCancel = z.infer<typeof subscriptionCancelSchema>;
