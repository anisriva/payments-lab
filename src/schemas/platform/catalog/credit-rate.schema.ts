import { z } from 'zod';

export const creditRateCreateSchema = z.object({
  currencyCode: z.string().length(3),
  rateMinor: z.number().int(),
});

export const creditRateUpdateSchema = z.object({
  rateMinor: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type CreditRateCreate = z.infer<typeof creditRateCreateSchema>;
export type CreditRateUpdate = z.infer<typeof creditRateUpdateSchema>;
