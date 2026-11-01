export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(`Payment provider "${provider}" is not available yet`);
    this.name = 'ProviderNotImplementedError';
  }
}

export class InvalidPaymentSignatureError extends Error {
  constructor(public readonly provider: string) {
    super(`Payment signature could not be verified`);
    this.name = 'InvalidPaymentSignatureError';
  }
}

export class PaymentRequestRejectedError extends Error {
  public readonly provider: string;

  constructor(provider: string, message: string) {
    super(`${provider} rejected the request: ${message}`);
    this.name = 'PaymentRequestRejectedError';
    this.provider = provider;
  }
}

export class PaymentProviderError extends Error {
  public readonly provider: string;
  public readonly cause?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(`Razorpay request failed: ${message}`);
    this.name = 'PaymentProviderError';
    this.provider = provider;
    this.cause = cause;
  }
}

export class PaymentCapabilityNotSupportedError extends Error {
  constructor(provider: string, capability: string) {
    super(`${provider} does not support ${capability}`);
    this.name = 'PaymentCapabilityNotSupportedError';
  }
}
