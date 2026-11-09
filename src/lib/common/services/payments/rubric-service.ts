import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { explainSelection, type ProviderCandidate } from '@/lib/common/payments/core/selector';
import { supports } from '@/lib/common/payments/core/contracts/features';
import type {
  CheckoutMode,
  PaymentFlow,
  ProviderKey,
} from '@/lib/common/payments/core/contracts/provider';
import type { SelectionExplanation, SelectionInput, SelectionResult } from '@/lib/common/payments/core/selector';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { PLATFORM_RECEIVER_COUNTRY } from '@/lib/common/services/payments/payment-constants';
import { getPaymentEnvironment } from '@/config/payments/env';
import { getPlatformCredentials } from '@/config/payments/platform-credentials';

export interface SimulateInput {
  flow: PaymentFlow;
  mode: CheckoutMode;
  payerCountry: string;
  receiverCountry: string;
  currency?: string;
  allowed?: ProviderKey[];
}

export interface SimulateResult {
  input: SelectionInput;
  explanation: SelectionExplanation;
  factoryCall: { provider: ProviderKey; credentialsSource: string; environment: string } | null;
}

export interface PlatformMapRow {
  countryCode: string;
  countryName: string;
  currency: string;
  oneTime: SelectionResult;
  subscription: SelectionResult;
}

export interface ProjectMapRow {
  countryCode: string;
  countryName: string;
  currency: string;
  eligible: { provider: ProviderKey; label: string; supportsSubscriptions: boolean }[];
}

function platformAvailable(provider: ProviderKey): boolean {
  try {
    getPlatformCredentials(provider);
    return true;
  } catch {
    return false;
  }
}

export class RubricService {
  private providerRulesService: ProviderRulesService;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.providerRulesService = new ProviderRulesService(prisma);
    this.countryService = new CountryService(prisma);
  }

  private candidates(flow: PaymentFlow): Promise<ProviderCandidate[]> {
    // Rubric is generic — project availability (a creator's connection) can't be known here
    return this.providerRulesService.getCandidates(flow, (p) =>
      flow === 'platform' ? platformAvailable(p) : true,
    );
  }

  async simulate(input: SimulateInput): Promise<SimulateResult> {
    const receiverCountry = input.flow === 'platform' ? PLATFORM_RECEIVER_COUNTRY : input.receiverCountry;

    let currency = input.currency;
    if (!currency) {
      const base = input.flow === 'platform'
        ? await this.countryService.getCountry(input.payerCountry)
        : await this.countryService.getCountry(receiverCountry);
      currency = base.currencyCode;
    }

    const resolved: SelectionInput = { ...input, receiverCountry, currency };
    const candidates = await this.candidates(input.flow);
    const explanation = explainSelection(resolved, candidates);

    return {
      input: resolved,
      explanation,
      factoryCall: explanation.result.provider === null
        ? null
        : {
            provider: explanation.result.provider,
            credentialsSource: input.flow === 'platform' ? 'platform env credentials' : 'decrypted project connection credentials',
            environment: getPaymentEnvironment(),
          },
    };
  }

  async platformMap(): Promise<PlatformMapRow[]> {
    const [countries, candidates] = await Promise.all([
      this.countryService.listCountries(),
      this.candidates('platform'),
    ]);
    return countries.map((c) => {
      const base = { flow: 'platform' as const, payerCountry: c.countryCode, receiverCountry: PLATFORM_RECEIVER_COUNTRY, currency: c.currencyCode };
      return {
        countryCode: c.countryCode,
        countryName: c.name,
        currency: c.currencyCode,
        oneTime: explainSelection({ ...base, mode: 'one_time' }, candidates).result,
        subscription: explainSelection({ ...base, mode: 'subscription' }, candidates).result,
      };
    });
  }

  async projectMap(): Promise<ProjectMapRow[]> {
    const [countries, candidates] = await Promise.all([
      this.countryService.listCountries(),
      this.candidates('project'),
    ]);
    return countries.map((c) => {
      const explanation = explainSelection(
        { flow: 'project', mode: 'one_time', payerCountry: c.countryCode, receiverCountry: c.countryCode, currency: c.currencyCode },
        candidates,
      );
      return {
        countryCode: c.countryCode,
        countryName: c.name,
        currency: c.currencyCode,
        eligible: explanation.traces
          .filter((t) => t.passed)
          .map((t) => ({
            provider: t.provider,
            label: t.label,
            supportsSubscriptions:
              candidates.find((p) => p.manifest.key === t.provider)
                ? supports(candidates.find((p) => p.manifest.key === t.provider)!.manifest, 'subscription.create')
                : false,
          })),
      };
    });
  }
}
