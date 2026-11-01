import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { getAppBaseUrl } from './payment-config';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { ProviderKey, ProviderProfile } from '@/lib/common/payments/core/types';
import type { WebhookTarget } from './payment-webhook-service';

export type EnsureResult =
  | { status: 'registered'; webhookRef: string; events: string[] }
  | { status: 'manual'; reason: string };

export class WebhookRegistrationService {
  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {}

  urlFor(target: WebhookTarget, provider: ProviderKey): string {
    const base = getAppBaseUrl().replace(/\/$/, '');
    return target.kind === 'platform'
      ? `${base}/api/webhooks/platform/${provider}`
      : `${base}/api/webhooks/project/${target.projectId}/${provider}`;
  }

  isPublicBaseUrl(): boolean {
    try {
      const host = new URL(getAppBaseUrl()).hostname;
      return host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.local');
    } catch {
      return false;
    }
  }

  async ensure(input: {
    adapter: PaymentProvider;
    profile: ProviderProfile;
    url: string;
    secret: string;
  }): Promise<EnsureResult> {
    const { adapter, profile, url, secret } = input;
    if (!profile.webhook.autoRegister) {
      return { status: 'manual', reason: 'Provider does not support automatic registration' };
    }
    if (!this.isPublicBaseUrl()) {
      return { status: 'manual', reason: 'Webhooks can only be registered from the deployed app (APP_BASE_URL is not public)' };
    }
    const existing = await adapter.listWebhooks();
    const match = existing.find((w) => w.url === url);
    const webhook = match
      ? await adapter.updateWebhook(match.id, { url, secret, events: profile.webhook.events, active: true })
      : await adapter.createWebhook({ url, secret, events: profile.webhook.events });
    return { status: 'registered', webhookRef: webhook.id, events: webhook.events };
  }

  async deactivate(input: {
    adapter: PaymentProvider;
    profile: ProviderProfile;
    webhookRef: string;
    url: string;
    secret: string;
  }): Promise<void> {
    const { adapter, profile, webhookRef, url, secret } = input;
    if (!profile.webhook.canDeactivate) return;
    await adapter.updateWebhook(webhookRef, {
      url,
      secret,
      events: profile.webhook.events,
      active: false,
    });
  }
}
