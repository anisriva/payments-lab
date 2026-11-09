import { supports } from './contracts/features';
import { countryAllowed, currencyAllowed, isCovered } from './coverage';
import type { ProviderManifest } from './contracts/manifest';
import type { CheckoutMode, PaymentFlow, ProviderKey } from './contracts/provider';

/** One audience rules row (platform_provider_rules / project_provider_rules). No row = disabled. */
export interface ProviderRule {
  isEnabled: boolean;
  priority: number;
  receiverCountries: string[] | '*';
  payerCountries: string[] | '*';
  currencies: string[] | '*';
}

export interface ProviderCandidate {
  manifest: ProviderManifest;
  rule: ProviderRule | null; // null → no rules row → disabled
  available: boolean;        // platform: env credentials exist · project: an enabled connection exists
}

export interface SelectionInput {
  flow: PaymentFlow;
  mode: CheckoutMode;
  payerCountry: string;
  receiverCountry: string;
  currency: string;
  allowed?: ProviderKey[]; // restrict to a subset (e.g. a project's connected providers)
}

export type SelectionResult =
  | { provider: ProviderKey; reason: string }
  | { provider: null; reason: string };

export type SelectionCheck =
  | 'allowed' | 'audience' | 'enabled' | 'receiver' | 'payer' | 'currency' | 'subscriptions' | 'available';

export interface CheckResult {
  check: SelectionCheck;
  status: 'pass' | 'fail' | 'skipped';
  detail: string;
}

export interface ProviderTrace {
  provider: ProviderKey;
  label: string;
  checks: CheckResult[]; // always 8 entries, in the order above
  passed: boolean;
}

export interface SelectionExplanation {
  traces: ProviderTrace[];   // every candidate, in priority order
  result: SelectionResult;   // lowest-priority candidate that passed, else null + joined fail details
}

export function explainSelection(input: SelectionInput, candidates: ProviderCandidate[]): SelectionExplanation {
  const sorted = [...candidates].sort(
    (a, b) => (a.rule?.priority ?? Number.MAX_SAFE_INTEGER) - (b.rule?.priority ?? Number.MAX_SAFE_INTEGER)
  );

  const traces: ProviderTrace[] = [];
  const failDetails: string[] = [];
  let winner: ProviderTrace | null = null;

  for (const { manifest, rule, available } of sorted) {
    const checks: CheckResult[] = [];
    let failed = false;
    const name = manifest.brand.name;

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
      !input.allowed || input.allowed.includes(manifest.key),
      input.allowed === undefined ? 'no restriction' : 'connected',
      `${manifest.key}: not connected`
    );
    run(
      'audience',
      manifest.audiences.includes(input.flow),
      `serves ${input.flow}`,
      `${name}: does not serve ${input.flow}`
    );
    run(
      'enabled',
      rule !== null && rule.isEnabled,
      rule ? 'enabled in rules' : 'enabled in rules',
      rule === null ? `${name}: no rules row — disabled` : `${name}: disabled in rules`
    );

    // Rules lists narrow the audience; coverage lanes are the provider's outer bound.
    const effective = rule ?? { receiverCountries: '*' as const, payerCountries: '*' as const, currencies: '*' as const };
    const coverage = isCovered(manifest, input.receiverCountry, input.payerCountry, input.currency);

    run(
      'receiver',
      countryAllowed(effective.receiverCountries, input.receiverCountry),
      `${input.receiverCountry} allowed`,
      `${name}: cannot receive payments in ${input.receiverCountry}`
    );
    run(
      'payer',
      countryAllowed(effective.payerCountries, input.payerCountry),
      `${input.payerCountry} allowed`,
      `${name}: does not accept payers from ${input.payerCountry}`
    );
    run(
      'currency',
      currencyAllowed(effective.currencies, input.currency) && coverage.covered,
      coverage.laneNote ? `${input.currency} covered — ${coverage.laneNote}` : `${input.currency} covered`,
      `${name}: does not cover ${input.receiverCountry}/${input.payerCountry}/${input.currency}`
    );
    run(
      'subscriptions',
      input.mode !== 'subscription' || supports(manifest, 'subscription.create'),
      input.mode === 'one_time' ? 'not needed' : 'supported',
      `${name}: no subscriptions`
    );
    run('available', available, 'account available', `${name}: no account available`);

    const trace: ProviderTrace = { provider: manifest.key, label: name, checks, passed: !failed };
    traces.push(trace);
    if (!failed && !winner) winner = trace;
  }

  const result: SelectionResult = winner
    ? { provider: winner.provider, reason: `${winner.label} selected for payer ${input.payerCountry}, receiver ${input.receiverCountry}` }
    : { provider: null, reason: failDetails.join('; ') };

  return { traces, result };
}

export function selectProvider(input: SelectionInput, candidates: ProviderCandidate[]): SelectionResult {
  return explainSelection(input, candidates).result;
}
