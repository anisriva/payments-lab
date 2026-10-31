import { z } from 'zod';

const paymentsEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  RAZORPAY_KEY_ID: z.string().startsWith('rzp_'),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  PAYMENT_ENVIRONMENT: z.enum(['test', 'live']),
});

type PaymentsEnv = z.infer<typeof paymentsEnvSchema>;

let cachedEnv: PaymentsEnv | null = null;

export function getPaymentsEnv(): PaymentsEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = paymentsEnvSchema.safeParse(process.env);

  if (!result.success) {
    const invalidFields = result.error.issues.map(e => e.path.join('.'));
    throw new Error(`Invalid environment variables: ${invalidFields.join(', ')}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
