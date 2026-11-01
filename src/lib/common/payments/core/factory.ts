import { RazorpayProvider, parseRazorpayCredentials, RAZORPAY_CAPABILITIES, RAZORPAY_PROFILE } from './adapters/razorpay';
import { ProviderNotImplementedError } from './errors';
import type { PaymentEnvironment, PaymentFlow, ProviderCapabilities, ProviderKey, ProviderProfile } from './types';
import type { PaymentProvider } from './provider';

interface RegistryEntry {
  capabilities: ProviderCapabilities;
  profile?: ProviderProfile;
  create?: (credentials: unknown, environment: PaymentEnvironment) => PaymentProvider;
}

const REGISTRY: RegistryEntry[] = [
  {
    capabilities: RAZORPAY_CAPABILITIES,
    profile: RAZORPAY_PROFILE,
    create: (c, env) => new RazorpayProvider(parseRazorpayCredentials(c), env),
  },
  {
    capabilities: {
      key: 'dodo',
      label: 'Dodo Payments',
      implemented: false,
      flows: ['platform'],
      receiverCountries: '*',
      payerCountries: '*',
      currencies: '*',
      supportsSubscriptions: true,
      supportsCustomAmount: true,
    },
  },
  {
    capabilities: {
      key: 'stripe',
      label: 'Stripe',
      implemented: false,
      flows: ['project'],
      receiverCountries: '*',
      payerCountries: '*',
      currencies: '*',
      supportsSubscriptions: true,
      supportsCustomAmount: true,
    },
  },
  {
    capabilities: {
      key: 'paypal',
      label: 'PayPal',
      implemented: false,
      flows: ['project'],
      receiverCountries: '*',
      payerCountries: '*',
      currencies: '*',
      supportsSubscriptions: true,
      supportsCustomAmount: true,
    },
  },
];

export function isProviderKey(value: string): value is ProviderKey {
  return REGISTRY.some((e) => e.capabilities.key === value);
}

export function listProviders(flow?: PaymentFlow): ProviderCapabilities[] {
  return REGISTRY.map((e) => e.capabilities).filter(
    (c) => !flow || c.flows.includes(flow)
  );
}

export function getProfile(key: ProviderKey): ProviderProfile | null {
  return REGISTRY.find((e) => e.capabilities.key === key)?.profile ?? null;
}

export function getCapabilities(key: ProviderKey): ProviderCapabilities {
  const entry = REGISTRY.find((e) => e.capabilities.key === key);
  if (!entry) throw new ProviderNotImplementedError(key);
  return entry.capabilities;
}

export function createProvider(
  key: ProviderKey,
  credentials: unknown,
  environment: PaymentEnvironment
): PaymentProvider {
  const entry = REGISTRY.find((e) => e.capabilities.key === key);
  if (!entry || !entry.create) {
    throw new ProviderNotImplementedError(key);
  }
  return entry.create(credentials, environment);
}

export function countryAllowed(list: string[] | '*', country: string): boolean {
  return list === '*' || list.includes(country);
}

export function currencyAllowed(list: string[] | '*', currency: string): boolean {
  return list === '*' || list.includes(currency);
}
