import { z } from 'zod';

/**
 * Schema for starting a credit purchase
 * Used by:
 * - API: /api/platform/payments/credit-purchases (POST)
 * - Hook: useStartCreditPurchase
 * - Form: CustomCreditsForm
 */
export const creditPurchaseCreateSchema = z.object({
  projectId: z.string().min(1),
  gateway: z.string().min(1),
  payerCountry: z.string().length(2),
  credits: z.number().int(),
  kind: z.enum(['fixed', 'custom']),
});

export type CreditPurchaseCreate = z.infer<typeof creditPurchaseCreateSchema>;
