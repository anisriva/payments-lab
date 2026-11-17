# Dodo Payments

Dodo Payments is the platform's merchant of record — it collects tax, invoices buyers and settles to us.

## Setup

1. Sign in to the [Dodo dashboard](https://app.dodopayments.com) and switch to the mode matching `PAYMENT_ENVIRONMENT` (Test / Live).
2. **Developer → API Keys → Create New Key** → copy the key (`dodo_test_…` / `dodo_live_…`) into `DODO_API_KEY`.
3. The signing secret comes from the registered webhook endpoint (`GET /webhooks/{id}/secret`, `whsec_…`) → `DODO_WEBHOOK_SECRET`.

## Good to know

- Checkout is a **redirect** to Dodo's hosted page; buyers return to our status page.
- Amounts below a product's price are rejected (422 `REQUEST_AMOUNT_BELOW_MINIMUM`).
- Products can't be deleted — they are archived.
- Non-USD/EUR/GBP payments settle in USD.
