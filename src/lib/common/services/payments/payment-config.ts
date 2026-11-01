import { getPaymentsEnv } from '@/lib/common/config/payments-env';
import { createProvider } from '@/lib/common/payments/core/factory';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { ProviderKey, PaymentEnvironment } from '@/lib/common/payments/core/types';

export {
  PLATFORM_RECEIVER_COUNTRY,
  CREDIT_QUICK_PICKS,
  MIN_CREDITS,
  MAX_CREDITS,
  SUBSCRIPTION_TOTAL_CYCLES,
} from './payment-constants';

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
