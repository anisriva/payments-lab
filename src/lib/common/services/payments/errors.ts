export class UnsupportedWebhookProviderError extends Error {
  constructor(provider: string) {
    super(`Webhooks are not supported for provider: ${provider}`);
    this.name = 'UnsupportedWebhookProviderError';
  }
}

export class InvalidPaymentFlowError extends Error {
  constructor(flow: string) {
    super(`Invalid payment flow: ${flow}`);
    this.name = 'InvalidPaymentFlowError';
  }
}

export class ProviderSettingInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderSettingInvalidError';
  }
}

export class ProviderEventNotFoundError extends Error {
  constructor(id: string) {
    super(`Provider event not found: ${id}`);
    this.name = 'ProviderEventNotFoundError';
  }
}
