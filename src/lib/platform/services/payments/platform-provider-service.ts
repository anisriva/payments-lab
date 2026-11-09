import type { PrismaClient, PaymentProvider } from '@/generated/prisma';
import { PlatformProviderRuleDAO } from '@/lib/platform/dao/payments/platform-provider-rule-dao';
import { PlatformProviderEventDAO } from '@/lib/platform/dao/payments/platform-provider-event-dao';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { runConnectionChecks, type ValidationReport } from '@/lib/common/payments/core/connection-checks';
import { webhookUrlFor } from '@/lib/common/services/payments/payment-webhook-service';
import { getPlatformProvider, PLATFORM_RECEIVER_COUNTRY } from '@/lib/common/services/payments/payment-config';
import { getAppBaseUrl } from '@/config/payments/env';
import { getPlatformCredentials } from '@/config/payments/platform-credentials';
import { getManifest, isProviderKey } from '@/lib/common/payments/core/registry.server';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isPublicBaseUrl(): boolean {
  try {
    const host = new URL(getAppBaseUrl()).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.local');
  } catch {
    return false;
  }
}

const CHECK_LABELS = {
  receiver_country: 'Country supported',
  key_mode: 'Key matches test/live mode',
  keys_valid: 'Keys accepted by the provider',
  subscriptions_available: 'Subscriptions available on this account',
  webhook_registered: 'Webhook registered',
} as const;

export class PlatformProviderService {
  private ruleDAO: PlatformProviderRuleDAO;
  private providerEventDAO: PlatformProviderEventDAO;
  private providerRulesService: ProviderRulesService;

  constructor(private readonly prisma: PrismaClient) {
    this.ruleDAO = new PlatformProviderRuleDAO(prisma);
    this.providerEventDAO = new PlatformProviderEventDAO(prisma);
    this.providerRulesService = new ProviderRulesService(prisma);
  }

  async validate(provider: string): Promise<ValidationReport> {
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const manifest = getManifest(provider);
    if (!manifest.audiences.includes('platform')) throw new ProviderNotImplementedError(provider);

    // A rules row is required — create code defaults when missing, never overwrite tab edits
    await this.providerRulesService.ensureRule(provider, 'platform');
    const rule = await this.providerRulesService.getRule(provider, 'platform');

    let adapter;
    let credentials: { webhookSecret?: string };
    try {
      credentials = getPlatformCredentials(provider) as { webhookSecret?: string };
      adapter = getPlatformProvider(provider);
    } catch (e) {
      const report: ValidationReport = { checks: [], canSave: false };
      report.checks.push({ key: 'receiver_country', label: CHECK_LABELS.receiver_country, blocking: true, status: 'skipped', detail: '' });
      report.checks.push({ key: 'key_mode', label: CHECK_LABELS.key_mode, blocking: true, status: 'fail', detail: describe(e) });
      for (const key of ['keys_valid', 'subscriptions_available', 'webhook_registered'] as const) {
        report.checks.push({ key, label: CHECK_LABELS[key], blocking: key === 'keys_valid', status: 'skipped', detail: '' });
      }
      await this.persist(provider, report, {});
      return report;
    }

    const url = webhookUrlFor({ kind: 'platform' }, provider as ProviderKey, getAppBaseUrl());
    const { report, webhook } = await runConnectionChecks(adapter, {
      rules: rule,
      receiverCountry: PLATFORM_RECEIVER_COUNTRY,
      webhook: { url, secret: credentials.webhookSecret!, isPublicBaseUrl: isPublicBaseUrl() },
    });

    await this.persist(provider, report, {
      webhookRef: webhook?.ref ?? null,
      webhookRegisteredAt: webhook?.registeredAt ?? null,
      webhookError: webhook?.error ?? null,
    });
    return report;
  }

  private async persist(
    provider: string,
    report: ValidationReport,
    webhook: { webhookRef?: string | null; webhookRegisteredAt?: Date | null; webhookError?: string | null },
  ) {
    await this.ruleDAO.update(provider as PaymentProvider, {
      ...(webhook.webhookRef !== undefined ? { webhookRef: webhook.webhookRef } : {}),
      ...(webhook.webhookRegisteredAt !== undefined ? { webhookRegisteredAt: webhook.webhookRegisteredAt } : {}),
      webhookError: webhook.webhookError ?? null,
      validationReport: report as unknown as Record<string, unknown> & object,
      validatedAt: new Date(),
    });
  }

  async getStatus(provider: string) {
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const row = await this.ruleDAO.findByProvider(provider);
    return {
      webhookUrl: webhookUrlFor({ kind: 'platform' }, provider, getAppBaseUrl()),
      webhookRef: row?.webhookRef ?? null,
      webhookRegisteredAt: row?.webhookRegisteredAt ?? null,
      webhookError: row?.webhookError ?? null,
      validationReport: row?.validationReport ?? null,
      validatedAt: row?.validatedAt ?? null,
      lastEvent: await this.providerEventDAO.findLatest(provider),
    };
  }
}
