// REVIEWED DRAFT — Dodo Payments pass 2 (2026-11-14). Final verdicts in docs/specs/IMPL-DODO.md §1.3.
// Windsurf: start with only credentials.verify, webhook.verify and webhook.* true; flip the rest in the step that implements them (§2).
import { defineManifest } from '../../contracts/manifest';

const OFF = { supported: false } as const;

export const DODO_MANIFEST = defineManifest({
  key: 'dodo',
  brand: { name: 'Dodo Payments', docsUrl: 'https://docs.dodopayments.com' },
  audiences: ['platform'], // BYOP needs Folio-side changes first (provider-generated webhook secret) — see IMPL-DODO §1.11
  features: {
    'credentials.verify': { supported: true },            // GET /products (list_products_handler)
    'webhook.verify': { supported: true },                // Standard Webhooks headers, HMAC-SHA256
    'checkout.one_time': { supported: true },             // POST /checkouts (create_session) with a one-time product
    'checkout.custom_amount': { supported: true },        // product_cart[].amount on a pay_what_you_want product — amounts below the product price → 422 (E4)
    'checkout.client_confirmation': OFF,                  // return URL params (payment_id, status) are unsigned
    'payment.read': { supported: true },                  // GET /checkouts/{id} → payment_id + payment_status (E2.3)
    'subscription_plan.create': { supported: true },      // POST /products with recurring_price
    'subscription_plan.update': { supported: true },      // PATCH /products/{id} — name (our updateSubscriptionPlan only renames/activates)
    'subscription_plan.disable': { supported: true },     // DELETE /products/{id} = archive (reversible: POST /products/{id}/unarchive)
    'subscription_plan.delete': {
      supported: false,
      manual: {
        title: 'Products stay archived in Dodo',
        steps: ['Dodo archives products instead of deleting them. Folio stops offering the plan; the archived product stays in your Dodo dashboard.'],
      },
    },
    'subscription.create': { supported: true },           // POST /checkouts with a recurring product
    'subscription.read': { supported: true },             // GET /subscriptions/{subscription_id}
    'subscription.cancel': { supported: true },           // PATCH /subscriptions/{id} { status: 'cancelled' }
    'subscription.cancel_at_period_end': { supported: true }, // PATCH /subscriptions/{id} { cancel_at_next_billing_date: true }
    'refund.create': OFF,                                 // POST /refunds exists — not researched (no flow uses refunds yet)
    'refund.read': OFF,                                   // GET /refunds/{id} exists — not researched
    'discount.create': OFF,                               // POST /discounts exists — not researched
    'discount.apply': OFF,                                // checkout discount_codes exists — not researched
    'webhook.read': { supported: true },                  // GET /webhooks (list_webhooks)
    'webhook.write': { supported: true },                 // POST /webhooks, PATCH /webhooks/{id}; secret via GET /webhooks/{id}/secret
    'webhook.disable': { supported: true },               // PATCH /webhooks/{id} { disabled: true }
    'webhook.delete': { supported: true },                // DELETE /webhooks/{id}
    'account.subscriptions_check': OFF,                   // no documented account capability check
  },
  facts: { merchantOfRecord: true },
  coverage: [
    {
      receivers: ['IN'],
      payers: '*', // narrowed per audience by the Providers-tab rule
      currencies: '*',
      note: 'Merchant of record — Dodo adds and remits tax. Non-USD/EUR/GBP payments settle in USD.',
    },
  ],
  checkout: { kind: 'redirect' },
  webhook: {
    events: [
      'payment.succeeded',
      'payment.failed',
      'subscription.active',
      'subscription.renewed',
      'subscription.on_hold',
      'subscription.past_due',
      'subscription.cancelled',
      'subscription.expired',
      // subscription.failed is not subscribed: a failed attempt doesn't end the checkout session (IMPL-DODO §1.4)
    ],
  },
});
