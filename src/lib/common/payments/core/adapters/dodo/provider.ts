import { createHmac, timingSafeEqual } from 'node:crypto';
import { BasePaymentProvider } from '../../base-provider';
import { DODO_MANIFEST } from './manifest';
import { DODO_CREDENTIALS, type DodoCredentials } from './credentials';
import { toNormalizedEvent } from './events';
import type {
  CredentialCheck,
  PaymentEnvironment,
  ProviderWebhook,
  WebhookInput,
} from '../../contracts/provider';
import type { NormalizedEvent } from '../../contracts/events';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

interface DodoWebhook {
  id: string;
  url: string;
  disabled?: boolean;
  filter_types?: string[] | null;
}

export class DodoProvider extends BasePaymentProvider {
  readonly manifest = DODO_MANIFEST;
  private readonly credentials: DodoCredentials;
  private readonly baseUrl: string;

  constructor(credentials: unknown, private readonly environment: PaymentEnvironment) {
    super();
    this.credentials = DODO_CREDENTIALS.runtime.parse(credentials);
    this.baseUrl = environment === 'test'
      ? 'https://test.dodopayments.com'
      : 'https://live.dodopayments.com';
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const b = json as { message?: string; error?: string } | null;
      throw { statusCode: res.status, error: { description: b?.message ?? b?.error ?? `HTTP ${res.status}` } };
    }
    return json as T;
  }

  protected async doVerifyCredentials(): Promise<CredentialCheck> {
    const prefix = this.environment === 'test' ? 'dodo_test_' : 'dodo_live_';
    if (!this.credentials.apiKey.startsWith(prefix)) {
      return {
        valid: false,
        reason: 'wrong_mode',
        detail: `${this.environment} environment requires ${prefix} keys`,
      };
    }
    try {
      await this.request('GET', '/products?page_size=1');
      return { valid: true };
    } catch (e) {
      const statusCode = (e as { statusCode?: unknown })?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        const detail = (e as { error?: { description?: string } })?.error?.description ?? 'Dodo rejected the credentials';
        if (statusCode === 401 && /mode key/i.test(detail)) {
          return { valid: false, reason: 'wrong_mode', detail };
        }
        return { valid: false, reason: 'invalid_credentials', detail };
      }
      throw e; // outages are thrown, never reported as invalid credentials
    }
  }

  protected verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const id = headers['webhook-id'];
    const timestamp = headers['webhook-timestamp'];
    const signature = headers['webhook-signature'];
    if (!id || !timestamp || !signature) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

    const key = Buffer.from(this.credentials.webhookSecret.replace(/^whsec_/, ''), 'base64');
    const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
    return signature
      .split(' ')
      .some((entry) => entry.startsWith('v1,') && safeEqual(entry.slice(3), expected));
  }

  protected toNormalizedEvent(payload: unknown, headers: Record<string, string>): NormalizedEvent {
    return toNormalizedEvent(payload, headers);
  }

  // ── Webhook management ──

  private toProviderWebhook(w: DodoWebhook): ProviderWebhook {
    return { id: w.id, url: w.url, active: !w.disabled, events: w.filter_types ?? [] };
  }

  protected async doListWebhooks(): Promise<ProviderWebhook[]> {
    const webhooks: ProviderWebhook[] = [];
    let startingAfter: string | undefined;
    for (;;) {
      const page = await this.request<{ data?: DodoWebhook[]; done?: boolean; iterator?: string }>(
        'GET',
        `/webhooks?limit=100${startingAfter ? `&starting_after=${encodeURIComponent(startingAfter)}` : ''}`,
      );
      for (const w of page.data ?? []) webhooks.push(this.toProviderWebhook(w));
      if (page.done || !page.iterator || !page.data?.length) break;
      startingAfter = page.iterator;
    }
    return webhooks;
  }

  protected async doCreateWebhook(input: WebhookInput): Promise<ProviderWebhook & { secret?: string }> {
    const created = await this.request<DodoWebhook>('POST', '/webhooks', {
      url: input.url,
      filter_types: input.events,
    });
    const { secret } = await this.request<{ secret?: string }>('GET', `/webhooks/${created.id}/secret`);
    return { ...this.toProviderWebhook(created), secret };
  }

  protected async doUpdateWebhook(id: string, input: WebhookInput & { active: boolean }): Promise<ProviderWebhook> {
    // Dodo has no secret field — input.secret is ignored
    const res = await this.request<DodoWebhook>('PATCH', `/webhooks/${id}`, {
      url: input.url,
      filter_types: input.events,
      disabled: !input.active,
    });
    return this.toProviderWebhook(res);
  }

  protected async doDeleteWebhook(id: string): Promise<void> {
    await this.request('DELETE', `/webhooks/${id}`);
  }
}
