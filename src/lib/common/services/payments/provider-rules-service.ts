import type { PrismaClient, PaymentProvider } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { PlatformProviderRuleDAO } from '@/lib/platform/dao/payments/platform-provider-rule-dao';
import { ProjectProviderRuleDAO } from '@/lib/project/dao/payments/project-provider-rule-dao';
import { getManifest, isProviderKey, listManifests } from '@/lib/common/payments/core/registry.server';
import { providerKeySchema, type ProviderManifest } from '@/lib/common/payments/core/contracts/manifest';
import { coveredValues } from '@/lib/common/payments/core/coverage';
import { ProviderNotImplementedError, PaymentValidationError } from '@/lib/common/payments/core/errors';
import type { PaymentFlow, ProviderKey } from '@/lib/common/payments/core/contracts/provider';
import type { ProviderCandidate, ProviderRule } from '@/lib/common/payments/core/selector';
import { ProviderSettingInvalidError } from './errors';

function toCapList(list: string[]): string[] | '*' {
  return list.length === 1 && list[0] === '*' ? '*' : list;
}

function toRule(row: {
  isEnabled: boolean;
  priority: number;
  receiverCountries: string[];
  payerCountries: string[];
  currencies: string[];
} | null): ProviderRule | null {
  if (!row) return null;
  return {
    isEnabled: row.isEnabled,
    priority: row.priority,
    receiverCountries: toCapList(row.receiverCountries),
    payerCountries: toCapList(row.payerCountries),
    currencies: toCapList(row.currencies),
  };
}

export interface CatalogProviderRule {
  provider: ProviderKey;
  implemented: boolean;
  manifest: ProviderManifest | null;
  rule: ProviderRule | null;   // null → no row → disabled
  hasRow: boolean;
}

/**
 * Owns each audience's rules tables (platform_provider_rules / project_provider_rules).
 * A provider with no row is disabled for that audience — enabling is a deliberate step.
 */
export class ProviderRulesService {
  private platformRuleDAO: PlatformProviderRuleDAO;
  private projectRuleDAO: ProjectProviderRuleDAO;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.platformRuleDAO = new PlatformProviderRuleDAO(prisma);
    this.projectRuleDAO = new ProjectProviderRuleDAO(prisma);
  }

  private dao(flow: PaymentFlow) {
    return flow === 'platform' ? this.platformRuleDAO : this.projectRuleDAO;
  }

  async getRule(provider: ProviderKey, flow: PaymentFlow): Promise<ProviderRule | null> {
    const row = await this.dao(flow).findByProvider(provider);
    return toRule(row);
  }

  /** Selection candidates for a flow: manifest + rules row + caller-supplied availability. */
  async getCandidates(
    flow: PaymentFlow,
    isAvailable: (provider: ProviderKey) => boolean | Promise<boolean>,
  ): Promise<ProviderCandidate[]> {
    const rows = await this.dao(flow).listAll();
    const byProvider = new Map(rows.data.map((r) => [r.provider, r]));

    return Promise.all(
      listManifests(flow).map(async (manifest) => ({
        manifest,
        rule: toRule(byProvider.get(manifest.key) ?? null),
        available: await isAvailable(manifest.key),
      })),
    );
  }

  /** Every known provider for the Providers tab — implemented and not. */
  async listForProvidersTab(flow: PaymentFlow): Promise<CatalogProviderRule[]> {
    const rows = await this.dao(flow).listAll();
    const byProvider = new Map(rows.data.map((r) => [r.provider, r]));
    const manifests = new Map(listManifests().map((m) => [m.key, m]));

    return providerKeySchema.options.map((key) => {
      const row = byProvider.get(key as PaymentProvider) ?? null;
      return {
        provider: key,
        implemented: manifests.has(key),
        manifest: manifests.get(key) ?? null,
        rule: toRule(row),
        hasRow: row !== null,
      };
    });
  }

  /** Create the row if missing (code defaults), never overwrite tab edits. */
  async ensureRule(provider: ProviderKey, flow: PaymentFlow): Promise<void> {
    const manifest = getManifest(provider);
    const existing = await this.dao(flow).findByProvider(provider);
    if (existing) return;
    const covered = coveredValues(manifest);
    const toArr = (l: string[] | '*') => (l === '*' ? ['*'] : l);
    // A newly added provider stays disabled until someone enables it in the Providers tab
    await this.dao(flow).upsert(provider, {
      isEnabled: false,
      receiverCountries: toArr(covered.receivers),
      payerCountries: toArr(covered.payers),
      currencies: toArr(covered.currencies),
    });
  }

  async updateRule(
    provider: string,
    flow: PaymentFlow,
    data: {
      isEnabled?: boolean;
      priority?: number;
      receiverCountries?: string[];
      payerCountries?: string[];
      currencies?: string[];
    },
  ) {
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const manifest = getManifest(provider);

    for (const list of [data.receiverCountries, data.payerCountries, data.currencies]) {
      if (!list) continue;
      if (list.includes('*') && list.length > 1) {
        throw new ProviderSettingInvalidError("'*' can't be mixed with other values");
      }
      if (list.length === 0) {
        throw new ProviderSettingInvalidError('Rule lists cannot be empty');
      }
    }

    // Reject any country or currency that appears in no coverage lane
    const covered = coveredValues(manifest);
    const check = (values: string[] | undefined, coveredList: string[] | '*', label: string) => {
      if (!values || coveredList === '*' || values.includes('*')) return;
      for (const v of values) {
        if (!coveredList.includes(v)) {
          throw new ProviderSettingInvalidError(`${manifest.brand.name} has no coverage lane for ${label} ${v}`);
        }
      }
    };
    check(data.receiverCountries, covered.receivers, 'receiver country');
    check(data.payerCountries, covered.payers, 'payer country');
    check(data.currencies, covered.currencies, 'currency');

    if (data.priority !== undefined && (!Number.isInteger(data.priority) || data.priority < 0)) {
      throw new PaymentValidationError('priority must be a non-negative integer');
    }

    return this.dao(flow).upsert(provider as PaymentProvider, data);
  }
}
