import { z } from 'zod';

const paymentsEnvSchema = z.object({
  DATABASE_URL: z.url(),
  APP_BASE_URL: z.url(),
  PAYMENT_ENVIRONMENT: z.enum(['test', 'live']),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().startsWith('rzp_'),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(16),
});

export type PaymentsEnv = z.infer<typeof paymentsEnvSchema>;

let cachedEnv: PaymentsEnv | null = null;

export function getPaymentsEnv(): PaymentsEnv {
  if (cachedEnv) return cachedEnv;

  const result = paymentsEnvSchema.safeParse(process.env);
  if (!result.success) {
    const invalidFields = result.error.issues.map((e) => e.path.join('.'));
    throw new Error(`Invalid environment variables: ${invalidFields.join(', ')}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getAppBaseUrl(): string {
  return getPaymentsEnv().APP_BASE_URL;
}

export function getPaymentEnvironment(): PaymentsEnv['PAYMENT_ENVIRONMENT'] {
  return getPaymentsEnv().PAYMENT_ENVIRONMENT;
}

export function getEncryptionKey(): Buffer {
  const key = Buffer.from(getPaymentsEnv().CREDENTIALS_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}
