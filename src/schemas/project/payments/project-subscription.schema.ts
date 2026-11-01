import { z } from 'zod';
export const projectSubscriptionCreateSchema = z.object({ provider: z.string().min(1), offeringId: z.string().uuid(), buyerEmail: z.string().email() });
export type ProjectSubscriptionCreate = z.infer<typeof projectSubscriptionCreateSchema>;
