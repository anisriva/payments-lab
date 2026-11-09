# Connect Razorpay

1. **Create a Razorpay account** — [Sign up](https://razorpay.com/signup) if you don't have one.
2. **Switch to Test Mode** — use the toggle at the top of the dashboard while you're trying things out.
3. **Generate test API keys** — Account & Settings → API Keys → Generate Test Key. The secret is shown **only once**.
4. **Paste your keys here** — we validate them and register the webhook for you.

## Good to know

- International payments need completed KYC and activation by Razorpay.
- Test and live modes use separate keys — a `rzp_test_` key only works in test mode.
- Plans can't be edited or deleted once created.
- Webhooks can't be deleted through the API — they can be disabled, or deleted in the Razorpay dashboard.
