// Dodo Payments — registered 2026-11-14 (IMPL-DODO §2, Step 2).
// A feature flips to supported: true only in the step that implements it.
import { defineManifest } from '../../contracts/manifest';

const OFF = { supported: false } as const;

export const DODO_MANIFEST = defineManifest({
  key: 'dodo',
  brand: { name: 'Dodo Payments', docsUrl: 'https://docs.dodopayments.com' },
  audiences: ['platform'], // BYOP needs Folio-side changes first (provider-generated webhook secret) — see IMPL-DODO §1.11
  features: {
    'credentials.verify': { supported: true },            // GET /products (list_products_handler)
    'webhook.verify': { supported: true },                // Standard Webhooks headers, HMAC-SHA256
    'checkout.one_time': OFF,                             // Step 3 — POST /checkouts (create_session)
    'checkout.custom_amount': OFF,                        // Step 3 — product_cart[].amount on a pay_what_you_want product
    'checkout.client_confirmation': OFF,                  // return URL params (payment_id, status) are unsigned
    'payment.read': OFF,                                  // Step 3 — GET /checkouts/{id} → payment_id + payment_status
    'subscription_plan.create': OFF,                      // Step 4 — POST /products with recurring_price
    'subscription_plan.update': OFF,                      // Step 4 — PATCH /products/{id}
    'subscription_plan.disable': OFF,                     // Step 4 — DELETE /products/{id} = archive
    'subscription_plan.delete': {
      supported: false,
      manual: {
        title: 'Products stay archived in Dodo',
        steps: ['Dodo archives products instead of deleting them. Folio stops offering the plan; the archived product stays in your Dodo dashboard.'],
      },
    },
    'subscription.create': OFF,                           // Step 4 — POST /checkouts with a recurring product
    'subscription.read': OFF,                             // Step 4 — GET /subscriptions/{subscription_id}
    'subscription.cancel': OFF,                           // Step 4 — PATCH /subscriptions/{id} { status: 'cancelled' }
    'subscription.cancel_at_period_end': OFF,             // Step 4 — PATCH /subscriptions/{id} { cancel_at_next_billing_date: true }
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
