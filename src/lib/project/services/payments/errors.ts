export class PaymentConnectionNotFoundError extends Error {
  constructor(id: string) { super(`Payment connection not found: ${id}`); this.name = 'PaymentConnectionNotFoundError'; }
}
export class GatewayNotConnectedError extends Error {
  constructor(label: string) { super(`${label} is not connected for this project`); this.name = 'GatewayNotConnectedError'; }
}
export class GatewayCredentialsRejectedError extends Error {
  constructor(label: string) { super(`${label} rejected the provided credentials`); this.name = 'GatewayCredentialsRejectedError'; }
}
export class GatewayCountryNotSupportedError extends Error {
  constructor(label: string, country: string) { super(`${label} does not support receivers in ${country}`); this.name = 'GatewayCountryNotSupportedError'; }
}
export class PaymentConnectionDisabledError extends Error {
  constructor(id: string) { super(`Payment connection is disabled: ${id}`); this.name = 'PaymentConnectionDisabledError'; }
}
export class OfferingNotFoundError extends Error {
  constructor(id: string) { super(`Offering not found: ${id}`); this.name = 'OfferingNotFoundError'; }
}
export class InvalidOfferingError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidOfferingError'; }
}
export class OfferingNotPurchasableError extends Error {
  constructor(name: string) { super(`Offering is not purchasable: ${name}`); this.name = 'OfferingNotPurchasableError'; }
}
export class AmountBelowMinimumError extends Error {
  constructor(minimumMinor: number) { super(`Amount is below the minimum of ${minimumMinor}`); this.name = 'AmountBelowMinimumError'; }
}
export class ProjectOrderNotFoundError extends Error {
  constructor(id: string) { super(`Project order not found: ${id}`); this.name = 'ProjectOrderNotFoundError'; }
}
export class ProjectSubscriptionNotFoundError extends Error {
  constructor(id: string) { super(`Project subscription not found: ${id}`); this.name = 'ProjectSubscriptionNotFoundError'; }
}
