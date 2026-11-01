import { z } from 'zod';
export const paymentConnectionCreateSchema = z.object({
  provider: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
});
export type PaymentConnectionCreate = z.infer<typeof paymentConnectionCreateSchema>;
