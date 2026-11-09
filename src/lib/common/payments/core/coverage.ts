import type { CountryMatch, CurrencyMatch, ProviderManifest } from './contracts/manifest';

function countryMatches(match: CountryMatch, country: string): boolean {
  if (match === '*') return true;
  if (Array.isArray(match)) return match.includes(country);
  return !match.except.includes(country);
}

function currencyMatches(match: CurrencyMatch, currency: string): boolean {
  return match === '*' || match.includes(currency);
}

export interface CoverageResult {
  covered: boolean;
  laneNote?: string; // the matching lane's note, e.g. 'Needs international activation'
}

/** A payment is covered when any lane contains it. */
export function isCovered(
  manifest: ProviderManifest,
  receiver: string,
  payer: string,
  currency: string,
): CoverageResult {
  for (const lane of manifest.coverage) {
    if (
      countryMatches(lane.receivers, receiver) &&
      countryMatches(lane.payers, payer) &&
      currencyMatches(lane.currencies, currency)
    ) {
      return { covered: true, laneNote: lane.note };
    }
  }
  return { covered: false };
}

export function countryAllowed(match: CountryMatch | string[] | '*', country: string): boolean {
  if (match === '*') return true;
  if (Array.isArray(match)) return match.includes(country);
  return !match.except.includes(country);
}

export function currencyAllowed(match: CurrencyMatch | string[] | '*', currency: string): boolean {
  return match === '*' || match.includes(currency);
}

/** Every country/currency value that appears in at least one coverage lane. */
export function coveredValues(manifest: ProviderManifest): {
  receivers: string[] | '*';
  payers: string[] | '*';
  currencies: string[] | '*';
} {
  const collect = (values: (CountryMatch | CurrencyMatch)[]): string[] | '*' => {
    const out = new Set<string>();
    for (const v of values) {
      if (v === '*') return '*';
      if (Array.isArray(v)) v.forEach((c) => out.add(c));
      else return '*'; // an { except } lane accepts everything except a few — treat as '*'
    }
    return [...out];
  };
  return {
    receivers: collect(manifest.coverage.map((l) => l.receivers)),
    payers: collect(manifest.coverage.map((l) => l.payers)),
    currencies: collect(manifest.coverage.map((l) => l.currencies)),
  };
}
