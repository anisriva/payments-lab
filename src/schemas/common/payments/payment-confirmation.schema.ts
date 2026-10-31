import { z } from 'zod';

/**
 * Schema for confirming a payment/subscription from the checkout handler
 * Used by:
 * - API: /api/platform/payments/credit-purchases/[id]/confirm (POST)
 * - API: /api/platform/payments/subscriptions/[id]/confirm (POST)
 * - API: /api/project/[projectId]/payments/orders/[id]/confirm (POST)
 * - API: /api/project/[projectId]/payments/subscriptions/[id]/confirm (POST)
 */
export const paymentConfirmationSchema = z.object({
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export type PaymentConfirmation = z.infer<typeof paymentConfirmationSchema>;
