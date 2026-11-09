import { z } from 'zod';
import type { PaymentProvider } from './provider';

export const FEATURES = {
  // ── Required ──
  'credentials.verify':                { methods: ['verifyCredentials'], required: true },
  'webhook.verify':                    { methods: ['parseWebhook'], required: true },
  // ── One-time payments ──
  'checkout.one_time':                 { methods: ['createOneTimeCheckout'] },
  'checkout.custom_amount':            { methods: ['createOneTimeCheckout'] },
  'checkout.client_confirmation':      { methods: ['confirmClientPayment'] },
  'payment.read':                      { methods: ['getPaymentStatus'] },
  // ── Subscription plans (the provider object a subscription bills against) ──
  'subscription_plan.create':          { methods: ['createSubscriptionPlan'] },
  'subscription_plan.update':          { methods: ['updateSubscriptionPlan'] },
  'subscription_plan.disable':         { methods: ['updateSubscriptionPlan'] },
  'subscription_plan.delete':          { methods: ['deleteSubscriptionPlan'] },
  // ── Subscriptions ──
  'subscription.create':               { methods: ['createSubscription'] },
  'subscription.read':                 { methods: ['getSubscriptionStatus'] },
  'subscription.cancel':               { methods: ['cancelSubscription'] },
  'subscription.cancel_at_period_end': { methods: ['cancelSubscription'] },
  // ── Refunds ──
  'refund.create':                     { methods: ['createRefund'] },
  'refund.read':                       { methods: ['getRefundStatus'] },
  // ── Discounts ──
  'discount.create':                   { methods: ['createDiscount'] },
  'discount.apply':                    { methods: ['createOneTimeCheckout', 'createSubscription'] },
  // ── Webhook management ──
  'webhook.read':                      { methods: ['listWebhooks'] },
  'webhook.write':                     { methods: ['createWebhook', 'updateWebhook'] },
  'webhook.disable':                   { methods: ['updateWebhook'] },
  'webhook.delete':                    { methods: ['deleteWebhook'] },
  // ── Account ──
  'account.subscriptions_check':       { methods: ['checkSubscriptionsAvailable'] },
} as const satisfies Record<string, { methods: readonly (keyof PaymentProvider)[]; required?: true }>;

export type ProviderFeature = keyof typeof FEATURES;

export const manualStepSchema = z.object({
  title: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  // values the UI shows with copy buttons
  shows: z.array(z.enum(['webhookUrl', 'webhookEvents', 'webhookSecret'])).optional(),
});

export const featureSupportSchema = z.discriminatedUnion('supported', [
  z.object({ supported: z.literal(true) }),
  z.object({ supported: z.literal(false), manual: manualStepSchema.optional() }),
]);

export type FeatureSupport = z.infer<typeof featureSupportSchema>;
export type ManualStep = z.infer<typeof manualStepSchema>;

export const supports = (m: { features: Record<ProviderFeature, FeatureSupport> }, f: ProviderFeature): boolean =>
  m.features[f].supported;

/** Builds the manifest `features` object typed so every feature is present — no omissions, no extras. */
export function mapFeatures<S extends z.ZodTypeAny>(schema: S) {
  return z.object(
    Object.fromEntries(Object.keys(FEATURES).map((f) => [f, schema])) as Record<ProviderFeature, S>
  );
}
