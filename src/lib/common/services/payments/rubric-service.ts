import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { explainSelection } from '@/lib/common/payments/core/selector';
import type {
  CheckoutMode,
  PaymentFlow,
  ProviderKey,
} from '@/lib/common/payments/core/types';
import type { SelectionExplanation, SelectionInput, SelectionResult } from '@/lib/common/payments/core/selector';
import { ProviderSettingsService } from '@/lib/common/services/payments/provider-settings-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { PLATFORM_RECEIVER_COUNTRY, getPaymentEnvironment } from '@/lib/common/services/payments/payment-config';

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

export class RubricService {
  private providerSettingsService: ProviderSettingsService;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.providerSettingsService = new ProviderSettingsService(prisma);
    this.countryService = new CountryService(prisma);
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
    const providers = await this.providerSettingsService.getEffectiveCapabilities(input.flow);
    const explanation = explainSelection(resolved, providers);

    return {
      input: resolved,
      explanation,
      factoryCall: explanation.result.provider === null
        ? null
        : {
            provider: explanation.result.provider,
            credentialsSource: input.flow === 'platform' ? 'platform env credentials' : 'decrypted PaymentConnection credentials',
            environment: getPaymentEnvironment(),
          },
    };
  }

  async platformMap(): Promise<PlatformMapRow[]> {
    const [countries, providers] = await Promise.all([
      this.countryService.listCountries(),
      this.providerSettingsService.getEffectiveCapabilities('platform'),
    ]);
    return countries.map((c) => {
      const base = { flow: 'platform' as const, payerCountry: c.code, receiverCountry: PLATFORM_RECEIVER_COUNTRY, currency: c.currencyCode };
      return {
        countryCode: c.code,
        countryName: c.name,
        currency: c.currencyCode,
        oneTime: explainSelection({ ...base, mode: 'one_time' }, providers).result,
        subscription: explainSelection({ ...base, mode: 'subscription' }, providers).result,
      };
    });
  }

  async projectMap(): Promise<ProjectMapRow[]> {
    const [countries, providers] = await Promise.all([
      this.countryService.listCountries(),
      this.providerSettingsService.getEffectiveCapabilities('project'),
    ]);
    return countries.map((c) => {
      const explanation = explainSelection(
        { flow: 'project', mode: 'one_time', payerCountry: c.code, receiverCountry: c.code, currency: c.currencyCode },
        providers
      );
      return {
        countryCode: c.code,
        countryName: c.name,
        currency: c.currencyCode,
        eligible: explanation.traces
          .filter((t) => t.passed)
          .map((t) => ({
            provider: t.provider,
            label: t.label,
            supportsSubscriptions: providers.find((p) => p.key === t.provider)?.supportsSubscriptions ?? false,
          })),
      };
    });
  }
}

