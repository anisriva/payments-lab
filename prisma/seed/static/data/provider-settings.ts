export const PROVIDER_SETTINGS = [
  {
    provider: 'razorpay',
    flow: 'platform',
    isEnabled: true,
    receiverCountries: ['IN'],
    payerCountries: ['IN'],
    currencies: ['INR'],
  },
  {
    provider: 'razorpay',
    flow: 'project',
    isEnabled: true,
    receiverCountries: ['IN'],
    payerCountries: ['IN'],
    currencies: ['INR'],
  },
] as const;
