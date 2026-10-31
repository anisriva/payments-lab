import { z } from 'zod';
export const paymentConnectionCreateSchema = z.object({ provider: z.string().min(1), keyId: z.string().min(1), keySecret: z.string().min(1), webhookSecret: z.string().min(1) });
export type PaymentConnectionCreate = z.infer<typeof paymentConnectionCreateSchema>;
