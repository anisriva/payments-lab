import { z } from 'zod';
import { FEATURES, supports, type ProviderFeature } from './contracts/features';
import type { ProviderManifest } from './contracts/manifest';
import type { CredentialModule } from './contracts/credentials';
import type { PaymentEnvironment, PaymentFlow, PaymentProvider, ProviderKey } from './contracts/provider';
import { BasePaymentProvider } from './base-provider';
import { ProviderNotImplementedError } from './errors';
import { RAZORPAY_MANIFEST } from './adapters/razorpay/manifest';
import { RAZORPAY_CREDENTIALS } from './adapters/razorpay/credentials';
import { RazorpayProvider } from './adapters/razorpay/provider';

type ProviderClass = new (credentials: unknown, environment: PaymentEnvironment) => PaymentProvider;

/** Method → the protected do-/hook impls a supported feature must override. */
const IMPLS: Record<string, string[]> = {
  verifyCredentials: ['doVerifyCredentials'],
  parseWebhook: ['verifyWebhookSignature', 'toNormalizedEvent'],
};
const implsFor = (method: string): string[] =>
  IMPLS[method] ?? ['do' + method[0].toUpperCase() + method.slice(1)];

const registryEntrySchema = z.object({
  manifest: z.custom<ProviderManifest>((m) => m != null && typeof m === 'object' && 'key' in m),
  credentials: z.custom<CredentialModule>((c) => c != null && typeof c === 'object' && 'runtime' in c),
  providerClass: z.custom<ProviderClass>((c) => typeof c === 'function'),
});

const registrySchema = z.array(registryEntrySchema).superRefine((entries, ctx) => {
  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    const { manifest, providerClass } = entry;
    const base = ['manifest', 'key'];

    if (seen.has(manifest.key)) {
      ctx.addIssue({ code: 'custom', path: [i, ...base], message: `Duplicate provider key "${manifest.key}"` });
    }
    seen.add(manifest.key);
    if (!(providerClass.prototype instanceof BasePaymentProvider)) {
      ctx.addIssue({ code: 'custom', path: [i, ...base], message: `providerClass for "${manifest.key}" must extend BasePaymentProvider` });
    }
    // manifest is an instance field — the pairing is enforced again at createProvider()
    const protoManifest = (providerClass.prototype as unknown as { manifest?: { key?: string } }).manifest;
    if (protoManifest && protoManifest.key !== manifest.key) {
      ctx.addIssue({ code: 'custom', path: [i, ...base], message: `providerClass.manifest.key does not match manifest "${manifest.key}"` });
    }

    for (const feature of Object.keys(FEATURES) as ProviderFeature[]) {
      if (!supports(manifest, feature)) continue;
      for (const method of FEATURES[feature].methods) {
        for (const impl of implsFor(method)) {
          const fn = (providerClass.prototype as Record<string, unknown>)[impl];
          const baseFn = (BasePaymentProvider.prototype as unknown as Record<string, unknown>)[impl];
          if (typeof fn !== 'function' || fn === baseFn) {
            ctx.addIssue({
              code: 'custom',
              path: [i, ...base, 'features', feature],
              message: `"${manifest.key}" declares "${feature}" but doesn't implement ${method}`,
            });
          }
        }
      }
    }
  });
});

const ADAPTERS = registrySchema.parse([
  { manifest: RAZORPAY_MANIFEST, credentials: RAZORPAY_CREDENTIALS, providerClass: RazorpayProvider },
  // + one line per provider
]);

export function isProviderKey(value: string): value is ProviderKey {
  return ADAPTERS.some((e) => e.manifest.key === value);
}

export function listManifests(audience?: PaymentFlow): ProviderManifest[] {
  return ADAPTERS.map((e) => e.manifest).filter((m) => !audience || m.audiences.includes(audience));
}

export function getManifest(key: ProviderKey): ProviderManifest {
  const entry = ADAPTERS.find((e) => e.manifest.key === key);
  if (!entry) throw new ProviderNotImplementedError(key);
  return entry.manifest;
}

export function getCredentials(key: ProviderKey): CredentialModule {
  const entry = ADAPTERS.find((e) => e.manifest.key === key);
  if (!entry) throw new ProviderNotImplementedError(key);
  return entry.credentials;
}

export function createProvider(
  key: ProviderKey,
  credentials: unknown,
  environment: PaymentEnvironment,
): PaymentProvider {
  const entry = ADAPTERS.find((e) => e.manifest.key === key);
  if (!entry) throw new ProviderNotImplementedError(key);
  return new entry.providerClass(credentials, environment);
}
