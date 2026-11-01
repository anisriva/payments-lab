import type { PrismaClient, PaymentProviderSetting, PaymentProvider } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { PaymentProviderSettingDAO } from '@/lib/common/dao/payments/payment-provider-setting-dao';
import { getCapabilities, getProfile, isProviderKey, listProviders } from '@/lib/common/payments/core/factory';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { PaymentFlow, ProviderCapabilities, ProviderKey, ProviderProfile } from '@/lib/common/payments/core/types';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { ProviderSettingInvalidError } from './errors';

function toCapList(list: string[]): string[] | '*' {
  return list.length === 1 && list[0] === '*' ? '*' : list;
}

export interface CatalogProviderSetting {
  provider: ProviderKey;
  code: ProviderCapabilities;
  effective: ProviderCapabilities;
  hasRow: boolean;
  profile: ProviderProfile | null;
}

export class ProviderSettingsService {
  private settingDAO: PaymentProviderSettingDAO;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.settingDAO = new PaymentProviderSettingDAO(prisma);
    this.countryService = new CountryService(prisma);
  }

  async getEffectiveCapabilities(flow: PaymentFlow): Promise<ProviderCapabilities[]> {
    const rows = await this.settingDAO.listAll(flow);
    const byProvider = new Map(rows.data.map((r) => [r.provider, r]));

    return listProviders(flow).map((caps) => {
      const row = byProvider.get(caps.key);
      if (!row) return caps;
      return {
        ...caps,
        receiverCountries: toCapList(row.receiverCountries),
        payerCountries: toCapList(row.payerCountries),
        currencies: toCapList(row.currencies),
        enabled: row.isEnabled,
      };
    });
  }

  async getEffectiveCapability(provider: ProviderKey, flow: PaymentFlow): Promise<ProviderCapabilities> {
    const row = await this.settingDAO.findByProvider(provider, flow);
    const caps = getCapabilities(provider);
    if (!row) return caps;
    return {
      ...caps,
      receiverCountries: toCapList(row.receiverCountries),
      payerCountries: toCapList(row.payerCountries),
      currencies: toCapList(row.currencies),
      enabled: row.isEnabled,
    };
  }

  async listSettingsForCatalog(flow: PaymentFlow): Promise<CatalogProviderSetting[]> {
    const rows = await this.settingDAO.listAll(flow);
    const byProvider = new Map(rows.data.map((r) => [r.provider, r]));
    const effective = await this.getEffectiveCapabilities(flow);

    return effective.map((eff) => ({
      provider: eff.key,
      code: getCapabilities(eff.key),
      effective: eff,
      hasRow: byProvider.has(eff.key),
      profile: getProfile(eff.key),
    }));
  }

  async updateSetting(
    provider: string,
    flow: PaymentFlow,
    data: {
      isEnabled?: boolean;
      receiverCountries?: string[];
      payerCountries?: string[];
      currencies?: string[];
    }
  ): Promise<PaymentProviderSetting> {
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const caps = getCapabilities(provider);
    if (!caps.implemented) throw new ProviderNotImplementedError(provider);

    for (const list of [data.receiverCountries, data.payerCountries, data.currencies]) {
      if (!list) continue;
      if (list.includes('*') && list.length > 1) {
        throw new ProviderSettingInvalidError("'*' can't be mixed with other values");
      }
    }

    for (const list of [data.receiverCountries, data.payerCountries]) {
      if (!list || (list.length === 1 && list[0] === '*')) continue;
      for (const code of list) {
        await this.countryService.getCountry(code);
      }
    }

    if (data.currencies && !(data.currencies.length === 1 && data.currencies[0] === '*')) {
      const valid = await this.countryService.listCurrencies();
      for (const currency of data.currencies) {
        if (!/^[A-Z]{3}$/.test(currency) || !valid.includes(currency)) {
          throw new ProviderSettingInvalidError(`Invalid currency: ${currency}`);
        }
      }
    }

    const existing = await this.settingDAO.findByProvider(provider as PaymentProvider, flow);
    const toArr = (list: string[] | '*') => (list === '*' ? ['*'] : list);
    const base = {
      isEnabled: existing?.isEnabled ?? true,
      receiverCountries: existing?.receiverCountries ?? toArr(caps.receiverCountries),
      payerCountries: existing?.payerCountries ?? toArr(caps.payerCountries),
      currencies: existing?.currencies ?? toArr(caps.currencies),
    };

    return this.settingDAO.upsert(provider as PaymentProvider, flow, {
      ...base,
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      ...(data.receiverCountries && { receiverCountries: data.receiverCountries }),
      ...(data.payerCountries && { payerCountries: data.payerCountries }),
      ...(data.currencies && { currencies: data.currencies }),
    });
  }
}
