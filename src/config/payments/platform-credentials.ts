import { getCredentials } from '@/lib/common/payments/core/registry.server';
import { PlatformCredentialsMissingError } from '@/lib/common/payments/core/errors';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';
import { getPaymentsEnv } from './env';

/** provider → env var names for each runtime credential field (platform only — nothing is stored). */
const ENV_VARS: Record<ProviderKey, Record<string, string>> = {
  razorpay: {
    keyId: 'RAZORPAY_KEY_ID',
    keySecret: 'RAZORPAY_KEY_SECRET',
    webhookSecret: 'RAZORPAY_WEBHOOK_SECRET',
  },
  dodo: {},
  stripe: {},
  paypal: {},
};

export function getPlatformCredentials(provider: ProviderKey): unknown {
  const mapping = ENV_VARS[provider];
  if (!mapping || Object.keys(mapping).length === 0) {
    throw new PlatformCredentialsMissingError(provider, ['<no env mapping configured>']);
  }
  const env = getPaymentsEnv() as unknown as Record<string, string | undefined>;
  const runtime = getCredentials(provider).runtime;
  const raw: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of Object.keys(runtime.shape)) {
    const varName = mapping[key];
    const value = varName ? env[varName] : undefined;
    if (!value) missing.push(varName ?? `${provider.toUpperCase()}_${key}`);
    else raw[key] = value;
  }
  if (missing.length > 0) throw new PlatformCredentialsMissingError(provider, missing);
  return runtime.parse(raw);
}
