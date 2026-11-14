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

export class NoCreditRateForCurrencyError extends Error {
  constructor(currency: string) {
    super(`No credit rate configured for currency: ${currency}`);
    this.name = 'NoCreditRateForCurrencyError';
  }
}

export class CreditRateNotFoundError extends Error {
  constructor(id: string) {
    super(`Credit rate not found: ${id}`);
    this.name = 'CreditRateNotFoundError';
  }
}

export class CreditRateExistsError extends Error {
  constructor(currency: string) {
    super(`A credit rate already exists for currency: ${currency}`);
    this.name = 'CreditRateExistsError';
  }
}

export class InvalidPlanPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlanPriceError';
  }
}

export class PlanPriceExistsError extends Error {
  constructor(planKey: string, interval: string, currency: string) {
    super(`Plan price already exists: ${planKey} / ${interval} / ${currency}`);
    this.name = 'PlanPriceExistsError';
  }
}

export class ActiveSubscriptionExistsError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} already has an active base-plan subscription — cancel it first`);
    this.name = 'ActiveSubscriptionExistsError';
  }
}

export class PlatformSubscriptionExistsError extends Error {
  constructor(projectId: string) {
    super('This project already has a live plan subscription.');
    this.name = 'PlatformSubscriptionExistsError';
    void projectId;
  }
}

export class PlanPriceInUseError extends Error {
  constructor(id: string) {
    super(`Plan price is in use and cannot be deleted: ${id}`);
    this.name = 'PlanPriceInUseError';
  }
}

export class PaymentNotStartedError extends Error {
  constructor(recordId: string) {
    super(`Payment has not been started for record: ${recordId}`);
    this.name = 'PaymentNotStartedError';
  }
}
