import type { PrismaClient, PaymentProvider } from '@/generated/prisma';
import { PaymentProviderSettingDAO } from '@/lib/common/dao/payments/payment-provider-setting-dao';
import { ProviderEventDAO } from '@/lib/common/dao/payments/provider-event-dao';
import { ProviderSettingsService } from '@/lib/common/services/payments/provider-settings-service';
import { WebhookRegistrationService } from '@/lib/common/services/payments/webhook-registration-service';
import { getPaymentEnvironment, getPlatformProvider } from '@/lib/common/services/payments/payment-config';
import { getPaymentsEnv } from '@/lib/common/config/payments-env';
import { getCapabilities, getProfile, isProviderKey } from '@/lib/common/payments/core/factory';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import type { ProviderKey, ValidationReport } from '@/lib/common/payments/core/types';

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class PlatformProviderService {
  private settingDAO: PaymentProviderSettingDAO;
  private providerEventDAO: ProviderEventDAO;
  private providerSettingsService: ProviderSettingsService;
  private webhookRegistrationService: WebhookRegistrationService;

  constructor(private readonly prisma: PrismaClient) {
    this.settingDAO = new PaymentProviderSettingDAO(prisma);
    this.providerEventDAO = new ProviderEventDAO(prisma);
    this.providerSettingsService = new ProviderSettingsService(prisma);
    this.webhookRegistrationService = new WebhookRegistrationService(prisma);
  }

  async validate(provider: string): Promise<ValidationReport> {
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const caps = getCapabilities(provider);
    if (!caps.implemented || !caps.flows.includes('platform')) throw new ProviderNotImplementedError(provider);
    const profile = getProfile(provider);
    if (!profile) throw new ProviderNotImplementedError(provider);

    const report: ValidationReport = { checks: [], canSave: true };
    const push = (key: string, status: 'pass' | 'fail' | 'warn' | 'skipped', detail: string) => {
      const def = profile.validationChecks.find((d) => d.key === key)!;
      report.checks.push({ key: def.key, label: def.label, blocking: def.blocking, status, detail });
      if (def.blocking && status === 'fail') report.canSave = false;
    };

    push('receiver_country', 'skipped', 'Folio receives in India');

    let adapter;
    try {
      adapter = getPlatformProvider(provider as ProviderKey);
      push('key_mode', 'pass', `keys match ${getPaymentEnvironment()} mode`);
    } catch (e) {
      push('key_mode', 'fail', describe(e));
      for (const key of ['keys_valid', 'subscriptions_available', 'webhook_registered']) push(key, 'skipped', '');
      await this.persist(provider, report, {});
      return report;
    }

    try {
      if (!(await adapter.verifyCredentials())) throw new Error('rejected');
      push('keys_valid', 'pass', 'accepted');
    } catch (e) {
      push('keys_valid', 'fail', e instanceof Error && e.message !== 'rejected' ? describe(e) : 'Razorpay rejected the credentials');
      for (const key of ['subscriptions_available', 'webhook_registered']) push(key, 'skipped', '');
      await this.persist(provider, report, {});
      return report;
    }

    try {
      if (!(await adapter.checkSubscriptionsAvailable())) throw new Error('unavailable');
      push('subscriptions_available', 'pass', 'available');
    } catch {
      push('subscriptions_available', 'warn', 'Subscriptions are not enabled on this Razorpay account');
    }

    let webhookRef: string | null = null;
    let webhookRegisteredAt: Date | null = null;
    let webhookError: string | null = null;
    const url = this.webhookRegistrationService.urlFor({ kind: 'platform' }, provider as ProviderKey);
    try {
      const secret = getPaymentsEnv().RAZORPAY_WEBHOOK_SECRET;
      const result = await this.webhookRegistrationService.ensure({ adapter, profile, url, secret });
      if (result.status === 'registered') {
        webhookRef = result.webhookRef;
        webhookRegisteredAt = new Date();
        push('webhook_registered', 'pass', `Registered · ${result.events.length} events`);
      } else {
        push('webhook_registered', 'warn', result.reason);
      }
    } catch (e) {
      webhookError = describe(e);
      push('webhook_registered', 'warn', webhookError);
    }

    await this.persist(provider, report, { webhookRef, webhookRegisteredAt, webhookError });
    return report;
  }

  private async persist(provider: string, report: ValidationReport, webhook: { webhookRef?: string | null; webhookRegisteredAt?: Date | null; webhookError?: string | null }) {
    // Create with code-default rules only when missing — never overwrite Catalog edits
    const existing = await this.settingDAO.findByProvider(provider as PaymentProvider, 'platform');
    if (!existing) {
      const caps = getCapabilities(provider as ProviderKey);
      const toArr = (l: string[] | '*') => (l === '*' ? ['*'] : l);
      await this.settingDAO.upsert(provider as PaymentProvider, 'platform', {
        isEnabled: true,
        receiverCountries: toArr(caps.receiverCountries),
        payerCountries: toArr(caps.payerCountries),
        currencies: toArr(caps.currencies),
      });
    }
    await this.settingDAO.update(provider as PaymentProvider, 'platform', {
      webhookRef: webhook.webhookRef ?? null,
      webhookRegisteredAt: webhook.webhookRegisteredAt ?? null,
      webhookError: webhook.webhookError ?? null,
      validationReport: report as unknown as Record<string, unknown> & object,
      validatedAt: new Date(),
    });
  }

  async getStatus(provider: string) {
    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const row = await this.settingDAO.findByProvider(provider, 'platform');
    return {
      webhookUrl: this.webhookRegistrationService.urlFor({ kind: 'platform' }, provider),
      webhookRef: row?.webhookRef ?? null,
      webhookRegisteredAt: row?.webhookRegisteredAt ?? null,
      webhookError: row?.webhookError ?? null,
      validationReport: row?.validationReport ?? null,
      validatedAt: row?.validatedAt ?? null,
      lastEvent: await this.providerEventDAO.findLatest(provider, 'platform'),
    };
  }
}
