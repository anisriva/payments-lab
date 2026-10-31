import { getPaymentsEnv } from '@/lib/common/config/payments-env';
import { createProvider } from '@/lib/common/payments/core/factory';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { ProviderKey, PaymentEnvironment } from '@/lib/common/payments/core/types';

export const PLATFORM_RECEIVER_COUNTRY = 'IN';
export const PLATFORM_CURRENCY = 'INR';
export const CREDIT_RATE_MINOR = 50;
export const CREDIT_QUICK_PICKS = [100, 250, 500, 1000] as const;
export const MIN_CREDITS = 100;
export const MAX_CREDITS = 100000;
export const SUBSCRIPTION_TOTAL_CYCLES = { monthly: 12, yearly: 3 } as const;
export const PAYER_COUNTRIES = ['IN', 'US', 'GB', 'DE', 'AE', 'SG'] as const;

export function getPaymentEnvironment(): PaymentEnvironment {
  return getPaymentsEnv().PAYMENT_ENVIRONMENT;
}

export function getPlatformCredentials(provider: ProviderKey): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
} {
  if (provider === 'razorpay') {
    const env = getPaymentsEnv();
    return {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    };
  }
  throw new ProviderNotImplementedError(provider);
}

export function getEncryptionKey(): Buffer {
  const key = Buffer.from(getPaymentsEnv().CREDENTIALS_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

export function getPlatformProvider(provider: ProviderKey): PaymentProvider {
  return createProvider(provider, getPlatformCredentials(provider), getPaymentEnvironment());
}

export function getAppBaseUrl(): string {
  return getPaymentsEnv().APP_BASE_URL;
}
