import { countryAllowed, listProviders } from './factory';
import type { CheckoutMode, PaymentFlow, ProviderKey } from './types';

export interface SelectionInput {
  flow: PaymentFlow;
  mode: CheckoutMode;
  payerCountry: string;
  receiverCountry: string;
  allowed?: ProviderKey[];
}

export type SelectionResult =
  | { provider: ProviderKey; reason: string }
  | { provider: null; reason: string };

export function selectProvider(input: SelectionInput): SelectionResult {
  const reasons: string[] = [];

  for (const caps of listProviders(input.flow)) {
    if (input.allowed && !input.allowed.includes(caps.key)) {
      reasons.push(`${caps.key}: not connected`);
      continue;
    }
    if (!caps.implemented) {
      reasons.push(`${caps.key}: not implemented yet`);
      continue;
    }
    if (!countryAllowed(caps.receiverCountries, input.receiverCountry)) {
      reasons.push(`${caps.key}: cannot receive payments in ${input.receiverCountry}`);
      continue;
    }
    if (!countryAllowed(caps.payerCountries, input.payerCountry)) {
      reasons.push(`${caps.key}: does not accept payers from ${input.payerCountry}`);
      continue;
    }
    if (input.mode === 'subscription' && !caps.supportsSubscriptions) {
      reasons.push(`${caps.key}: no subscriptions`);
      continue;
    }
    return {
      provider: caps.key,
      reason: `${caps.label} selected for payer ${input.payerCountry}, receiver ${input.receiverCountry}`,
    };
  }

  return { provider: null, reason: reasons.join('; ') };
}
