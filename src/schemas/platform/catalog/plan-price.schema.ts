import { z } from 'zod';

export const planPriceCreateSchema = z.object({
  planKey: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  interval: z.enum(['monthly', 'yearly']),
  amountMinor: z.number().int(),
  marketKey: z.string().min(1),
});

export const planPriceUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type PlanPriceCreate = z.infer<typeof planPriceCreateSchema>;
export type PlanPriceUpdate = z.infer<typeof planPriceUpdateSchema>;
