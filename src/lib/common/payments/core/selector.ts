import { countryAllowed, currencyAllowed } from './factory';
import type { CheckoutMode, PaymentFlow, ProviderCapabilities, ProviderKey } from './types';

export interface SelectionInput {
  flow: PaymentFlow;
  mode: CheckoutMode;
  payerCountry: string;
  receiverCountry: string;
  currency: string;
  allowed?: ProviderKey[];
}

export type SelectionResult =
  | { provider: ProviderKey; reason: string }
  | { provider: null; reason: string };

export type SelectionCheck =
  | 'allowed' | 'implemented' | 'enabled' | 'receiver' | 'payer' | 'currency' | 'subscriptions';

export interface CheckResult {
  check: SelectionCheck;
  status: 'pass' | 'fail' | 'skipped';
  detail: string;
}

export interface ProviderTrace {
  provider: ProviderKey;
  label: string;
  checks: CheckResult[]; // always 7 entries, in the order above
  passed: boolean;
}

export interface SelectionExplanation {
  traces: ProviderTrace[];   // every provider passed in, in priority order
  result: SelectionResult;   // first provider with passed === true, else null + joined fail details
}

export function explainSelection(input: SelectionInput, providers: ProviderCapabilities[]): SelectionExplanation {
  const traces: ProviderTrace[] = [];
  const failDetails: string[] = [];
  let winner: ProviderTrace | null = null;

  for (const caps of providers) {
    const checks: CheckResult[] = [];
    let failed = false;

    const run = (check: SelectionCheck, passes: boolean, passDetail: string, failDetail: string) => {
      if (failed) {
        checks.push({ check, status: 'skipped', detail: '' });
      } else if (passes) {
        checks.push({ check, status: 'pass', detail: passDetail });
      } else {
        checks.push({ check, status: 'fail', detail: failDetail });
        failDetails.push(failDetail);
        failed = true;
      }
    };

    run(
      'allowed',
      !input.allowed || input.allowed.includes(caps.key),
      input.allowed === undefined ? 'no restriction' : 'connected',
      `${caps.key}: not connected`
    );
    run('implemented', caps.implemented, 'adapter available', `${caps.key}: not implemented yet`);
    run('enabled', caps.enabled !== false, 'enabled in Catalog', `${caps.key}: disabled in Catalog`);
    run(
      'receiver',
      countryAllowed(caps.receiverCountries, input.receiverCountry),
      `${input.receiverCountry} allowed`,
      `${caps.key}: cannot receive payments in ${input.receiverCountry}`
    );
    run(
      'payer',
      countryAllowed(caps.payerCountries, input.payerCountry),
      `${input.payerCountry} allowed`,
      `${caps.key}: does not accept payers from ${input.payerCountry}`
    );
    run(
      'currency',
      currencyAllowed(caps.currencies, input.currency),
      `${input.currency} allowed`,
      `${caps.key}: does not support ${input.currency}`
    );
    run(
      'subscriptions',
      input.mode !== 'subscription' || caps.supportsSubscriptions,
      input.mode === 'one_time' ? 'not needed' : 'supported',
      `${caps.key}: no subscriptions`
    );

    const trace: ProviderTrace = { provider: caps.key, label: caps.label, checks, passed: !failed };
    traces.push(trace);
    if (!failed && !winner) winner = trace;
  }

  const result: SelectionResult = winner
    ? { provider: winner.provider, reason: `${winner.label} selected for payer ${input.payerCountry}, receiver ${input.receiverCountry}` }
    : { provider: null, reason: failDetails.join('; ') };

  return { traces, result };
}

export function selectProvider(input: SelectionInput, providers: ProviderCapabilities[]): SelectionResult {
  return explainSelection(input, providers).result;
}
