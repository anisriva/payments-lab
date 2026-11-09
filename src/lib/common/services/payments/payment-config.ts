import { createProvider } from '@/lib/common/payments/core/registry.server';
import { getPlatformCredentials } from '@/config/payments/platform-credentials';
import { getPaymentEnvironment } from '@/config/payments/env';
import type { PaymentProvider } from '@/lib/common/payments/core/contracts/provider';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';

export {
  PLATFORM_RECEIVER_COUNTRY,
  CREDIT_QUICK_PICKS,
  MIN_CREDITS,
  MAX_CREDITS,
  SUBSCRIPTION_TOTAL_CYCLES,
} from './payment-constants';

export {
  getPaymentsEnv,
  getAppBaseUrl,
  getEncryptionKey,
  getPaymentEnvironment,
} from '@/config/payments/env';
export { getPlatformCredentials } from '@/config/payments/platform-credentials';

/** Platform audience: credentials come from env, never stored. */
export function getPlatformProvider(provider: ProviderKey): PaymentProvider {
  return createProvider(provider, getPlatformCredentials(provider), getPaymentEnvironment());
}
