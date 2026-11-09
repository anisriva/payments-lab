import { defineManifest } from '../../contracts/manifest';

const OFF = { supported: false } as const;

export const RAZORPAY_MANIFEST = defineManifest({
  key: 'razorpay',
  brand: { name: 'Razorpay', docsUrl: 'https://razorpay.com/docs' },
  audiences: ['platform', 'project'],
  features: {
    'credentials.verify': { supported: true },
    'webhook.verify': { supported: true },
    'checkout.one_time': { supported: true },
    'checkout.custom_amount': { supported: true },
    'checkout.client_confirmation': { supported: true },
    'payment.read': { supported: true },
    'subscription_plan.create': { supported: true },
    'subscription_plan.update': {
      supported: false,
      manual: {
        title: 'Plans stay in Razorpay',
        steps: ["Razorpay can't rename plans. Folio stops offering the old price; the plan remains in your Razorpay dashboard."],
      },
    },
    'subscription_plan.disable': {
      supported: false,
      manual: {
        title: 'Plans stay in Razorpay',
        steps: ["Razorpay can't disable or delete plans. Folio stops offering it; the plan remains unused in your Razorpay dashboard."],
      },
    },
    'subscription_plan.delete': {
      supported: false,
      manual: {
        title: 'Plans stay in Razorpay',
        steps: ["Razorpay can't delete plans. Folio stops offering it; the plan remains unused in your Razorpay dashboard."],
      },
    },
    'subscription.create': { supported: true },
    'subscription.read': { supported: true },
    'subscription.cancel': { supported: true },
    'subscription.cancel_at_period_end': { supported: true },
    'refund.create': OFF,
    'refund.read': OFF,
    'discount.create': OFF,
    'discount.apply': OFF,
    'webhook.read': { supported: true },
    'webhook.write': { supported: true },
    'webhook.disable': { supported: true },
    'webhook.delete': {
      supported: false,
      manual: {
        title: 'Delete the webhook yourself',
        steps: ['Razorpay dashboard → Account & Settings → Webhooks → delete the Payments Lab webhook.'],
        shows: ['webhookUrl'],
      },
    },
    'account.subscriptions_check': { supported: true },
  },
  facts: { merchantOfRecord: false },
  coverage: [
    { receivers: ['IN'], payers: ['IN'], currencies: ['INR'] },
    {
      receivers: ['IN'],
      payers: { except: ['IN'] },
      currencies: '*',
      note: 'International payments — needs KYC and activation by Razorpay',
    },
  ],
  checkout: { kind: 'modal' },
  webhook: {
    events: [
      'payment.captured',
      'payment.failed',
      'order.paid',
      'subscription.activated',
      'subscription.charged',
      'subscription.cancelled',
      'subscription.halted',
      'subscription.completed',
    ],
  },
});
