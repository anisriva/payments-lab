export class PlanPriceNotFoundError extends Error {
  constructor(id: string) {
    super(`Plan price not found: ${id}`);
    this.name = 'PlanPriceNotFoundError';
  }
}

export class CreditPurchaseNotFoundError extends Error {
  constructor(id: string) {
    super(`Credit purchase not found: ${id}`);
    this.name = 'CreditPurchaseNotFoundError';
  }
}

export class PlatformSubscriptionNotFoundError extends Error {
  constructor(id: string) {
    super(`Subscription not found: ${id}`);
    this.name = 'PlatformSubscriptionNotFoundError';
  }
}

export class InvalidCreditAmountError extends Error {
  constructor(credits: number) {
    super(`Invalid credit amount: ${credits}`);
    this.name = 'InvalidCreditAmountError';
  }
}

export class NoPaymentProviderAvailableError extends Error {
  constructor(reason: string) {
    super(`No payment provider available: ${reason}`);
    this.name = 'NoPaymentProviderAvailableError';
  }
}

export class PaymentNotStartedError extends Error {
  constructor(recordId: string) {
    super(`Payment has not been started for record: ${recordId}`);
    this.name = 'PaymentNotStartedError';
  }
}
