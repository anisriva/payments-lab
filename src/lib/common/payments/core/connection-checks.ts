import { supports } from './contracts/features';
import type { ManualStep } from './contracts/features';
import { countryAllowed } from './coverage';
import type { PaymentProvider, ProviderWebhook } from './contracts/provider';
import type { ProviderRule } from './selector';

export type ValidationCheckKey =
  | 'receiver_country' | 'key_mode' | 'keys_valid' | 'subscriptions_available' | 'webhook_registered';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skipped';

export interface ValidationCheckResult {
  key: ValidationCheckKey;
  label: string;
  blocking: boolean;
  status: CheckStatus;
  detail: string;
}

export interface ValidationReport {
  checks: ValidationCheckResult[];
  canSave: boolean; // false when any blocking check failed
}

export interface ConnectionCheckContext {
  /** Audience rules row for this provider (receiver country gate). Null → treated as no restriction. */
  rules?: Pick<ProviderRule, 'receiverCountries'> | null;
  /** The merchant's country — checked against rules ∩ coverage lanes. */
  receiverCountry?: string;
  /** Webhook registration target. Omit to skip the webhook step. */
  webhook?: {
    url: string;
    secret: string;
    /** Skip registration when the base URL isn't public — reported as a warning. */
    isPublicBaseUrl: boolean;
  };
}

export interface ConnectionCheckResult {
  report: ValidationReport;
  webhook?: {
    ref: string | null;
    active: boolean | null;
    registeredAt: Date | null;
    error: string | null;
  };
  /** Present when webhook.write is unsupported — the UI renders the manifest's manual step. */
  webhookManualStep?: ManualStep;
}

const CHECK_DEFS: Record<ValidationCheckKey, { label: string; blocking: boolean }> = {
  receiver_country: { label: 'Country supported', blocking: true },
  key_mode: { label: 'Key matches test/live mode', blocking: true },
  keys_valid: { label: 'Keys accepted by the provider', blocking: true },
  subscriptions_available: { label: 'Subscriptions available on this account', blocking: false },
  webhook_registered: { label: 'Webhook registered', blocking: false },
};

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * One function for connect, revalidate and platform validate:
 * rules/coverage → verifyCredentials → checkSubscriptionsAvailable (if supported)
 * → webhook (if supported, else the manual step). Never re-implement a check in a service.
 */
export async function runConnectionChecks(
  adapter: PaymentProvider,
  context: ConnectionCheckContext = {},
): Promise<ConnectionCheckResult> {
  const { manifest } = adapter;
  const name = manifest.brand.name;
  const report: ValidationReport = { checks: [], canSave: true };

  const push = (key: ValidationCheckKey, status: CheckStatus, detail: string) => {
    const def = CHECK_DEFS[key];
    report.checks.push({ key, label: def.label, blocking: def.blocking, status, detail });
    if (def.blocking && status === 'fail') report.canSave = false;
  };
  const skipRest = (...keys: ValidationCheckKey[]) => keys.forEach((k) => push(k, 'skipped', ''));

  // 1. Rules/coverage — the receiver's country must be inside the rules row and a lane
  if (context.receiverCountry !== undefined) {
    const rulesOk = !context.rules || countryAllowed(context.rules.receiverCountries, context.receiverCountry);
    const laneOk = manifest.coverage.some((lane) => countryAllowed(lane.receivers, context.receiverCountry!));
    if (rulesOk && laneOk) {
      push('receiver_country', 'pass', `${context.receiverCountry} allowed`);
    } else {
      push('receiver_country', 'fail', `${name} cannot receive payments in ${context.receiverCountry}`);
      skipRest('key_mode', 'keys_valid', 'subscriptions_available', 'webhook_registered');
      return { report };
    }
  } else {
    push('receiver_country', 'skipped', '');
  }

  // 2. Credentials — verifyCredentials reports wrong_mode distinctly, throws on outages
  let credentialCheck;
  try {
    credentialCheck = await adapter.verifyCredentials();
  } catch (e) {
    push('key_mode', 'fail', describe(e));
    skipRest('keys_valid', 'subscriptions_available', 'webhook_registered');
    return { report };
  }
  if (credentialCheck.valid) {
    push('key_mode', 'pass', 'key mode matches');
    push('keys_valid', 'pass', 'accepted');
  } else if (credentialCheck.reason === 'wrong_mode') {
    push('key_mode', 'fail', credentialCheck.detail);
    skipRest('keys_valid', 'subscriptions_available', 'webhook_registered');
    return { report };
  } else {
    push('key_mode', 'pass', 'key mode matches');
    push('keys_valid', 'fail', credentialCheck.detail || `${name} rejected the credentials`);
    skipRest('subscriptions_available', 'webhook_registered');
    return { report };
  }

  // 3. Subscriptions available — only when the provider can check (non-blocking)
  if (supports(manifest, 'account.subscriptions_check')) {
    try {
      const ok = await adapter.checkSubscriptionsAvailable!();
      if (ok) {
        push('subscriptions_available', 'pass', 'available');
      } else {
        push('subscriptions_available', 'warn', `Subscriptions are not enabled on this ${name} account — recurring offerings won't work`);
      }
    } catch (e) {
      push('subscriptions_available', 'warn', describe(e));
    }
  } else {
    push('subscriptions_available', 'skipped', `${name} can't check this — verify manually before selling recurring offerings`);
  }

  // 4. Webhook — delete → disable → manual step is handled by the caller on disconnect
  const result: ConnectionCheckResult = { report };
  if (!context.webhook) {
    push('webhook_registered', 'skipped', '');
    return result;
  }

  const webhookState = { ref: null as string | null, active: null as boolean | null, registeredAt: null as Date | null, error: null as string | null };
  result.webhook = webhookState;

  if (!supports(manifest, 'webhook.write')) {
    const f = manifest.features['webhook.write'];
    result.webhookManualStep = f.supported ? undefined : f.manual;
    push('webhook_registered', 'warn', result.webhookManualStep?.title ?? `${name} does not manage webhooks through the API`);
    return result;
  }
  if (!context.webhook.isPublicBaseUrl) {
    push('webhook_registered', 'warn', 'Skipped — APP_BASE_URL is not public; register the webhook in the provider dashboard');
    return result;
  }

  try {
    const input = { url: context.webhook.url, secret: context.webhook.secret, events: manifest.webhook.events };
    const existing = adapter.listWebhooks ? await adapter.listWebhooks() : [];
    const match = existing.find((w: ProviderWebhook) => w.url === input.url);
    const webhook = match
      ? await adapter.updateWebhook!(match.id, { ...input, active: true })
      : await adapter.createWebhook!(input);
    webhookState.ref = webhook.id;
    webhookState.active = webhook.active;
    webhookState.registeredAt = new Date();
    push('webhook_registered', 'pass', `Registered · ${webhook.events.length} events`);
  } catch (e) {
    webhookState.error = describe(e);
    push('webhook_registered', 'warn', webhookState.error);
  }
  return result;
}

/** Removal degrades gracefully: delete if supported → else disable → else the manual step for the UI. */
export async function removeWebhook(
  adapter: PaymentProvider,
  id: string,
  input: { url: string; secret: string },
): Promise<{ removed: 'deleted' | 'disabled' } | { removed: 'manual'; step?: ManualStep }> {
  const { manifest } = adapter;
  if (supports(manifest, 'webhook.delete')) {
    await adapter.deleteWebhook!(id);
    return { removed: 'deleted' };
  }
  if (supports(manifest, 'webhook.disable')) {
    await adapter.updateWebhook!(id, { url: input.url, secret: input.secret, events: manifest.webhook.events, active: false });
    return { removed: 'disabled' };
  }
  const feature = manifest.features['webhook.delete'];
  return { removed: 'manual', step: feature.supported ? undefined : feature.manual };
}
