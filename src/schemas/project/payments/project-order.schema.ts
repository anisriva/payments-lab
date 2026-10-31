import { z } from 'zod';
export const projectOrderCreateSchema = z.object({ provider: z.string().min(1), offeringId: z.string().uuid(), buyerEmail: z.string().email(), amountMinor: z.number().int().optional() });
export type ProjectOrderCreate = z.infer<typeof projectOrderCreateSchema>;
