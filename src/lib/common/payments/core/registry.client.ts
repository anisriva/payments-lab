import type { ProviderManifest } from './contracts/manifest';
import type { CredentialModule } from './contracts/credentials';
import type { CheckoutLauncher } from './contracts/checkout';
import type { PaymentFlow, ProviderKey } from './contracts/provider';
import { ProviderNotImplementedError } from './errors';
import { RAZORPAY_MANIFEST } from './adapters/razorpay/manifest';
import { RAZORPAY_CREDENTIALS } from './adapters/razorpay/credentials';
import { RAZORPAY_CLIENT } from './adapters/razorpay/client';
import RAZORPAY_ONBOARDING_MD from './adapters/razorpay/onboarding.md';

export interface ClientAdapter {
  manifest: ProviderManifest;
  credentials: CredentialModule;
  client: CheckoutLauncher;
  onboarding: string; // markdown — the creator-facing setup guide
}

const CLIENT_ADAPTERS: ClientAdapter[] = [
  { manifest: RAZORPAY_MANIFEST, credentials: RAZORPAY_CREDENTIALS, client: RAZORPAY_CLIENT, onboarding: RAZORPAY_ONBOARDING_MD },
];

export function isProviderKey(value: string): value is ProviderKey {
  return CLIENT_ADAPTERS.some((e) => e.manifest.key === value);
}

export function listManifests(audience?: PaymentFlow): ProviderManifest[] {
  return CLIENT_ADAPTERS.map((e) => e.manifest).filter((m) => !audience || m.audiences.includes(audience));
}

export function getClientAdapter(key: ProviderKey): ClientAdapter {
  const entry = CLIENT_ADAPTERS.find((e) => e.manifest.key === key);
  if (!entry) throw new ProviderNotImplementedError(key);
  return entry;
}
