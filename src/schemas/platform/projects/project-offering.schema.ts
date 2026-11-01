import { z } from 'zod';
export const projectOfferingCreateSchema = z.object({ name: z.string().min(1).max(150), priceType: z.enum(['fixed', 'custom', 'recurring']), amountMinor: z.number().int(), interval: z.enum(['monthly', 'yearly']).optional() });
export const projectOfferingUpdateSchema = z.object({ name: z.string().min(1).max(150).optional(), isActive: z.boolean().optional() });
export type ProjectOfferingCreate = z.infer<typeof projectOfferingCreateSchema>;
export type ProjectOfferingUpdate = z.infer<typeof projectOfferingUpdateSchema>;
