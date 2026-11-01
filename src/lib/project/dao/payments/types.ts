import type {
  BillingInterval,
  Prisma,
  OfferingPriceType,
  PaymentEnvironment,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
} from '@/generated/prisma';
import type { PaginationInput, SortOptions } from '@/types/common/pagination';

export interface PaymentConnectionUpsertInput {
  id: string;
  projectId: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  credentialsEnc: string;
  displayHint: string;
  isEnabled?: boolean;
  verifiedAt?: Date | null;
}

export interface PaymentConnectionUpdateInput {
  credentialsEnc?: string;
  displayHint?: string;
  isEnabled?: boolean;
  verifiedAt?: Date | null;
  webhookRef?: string | null;
  webhookActive?: boolean | null;
  webhookRegisteredAt?: Date | null;
  webhookError?: string | null;
  validationReport?: Prisma.InputJsonValue;
  validatedAt?: Date | null;
}

export interface ProjectOfferingCreateInput {
  id?: string;
  projectId: string;
  name: string;
  priceType: OfferingPriceType;
  amountMinor: number;
  currencyCode: string;
  interval?: BillingInterval | null;
  isActive?: boolean;
}

export interface ProjectOfferingUpdateInput {
  name?: string;
  isActive?: boolean;
}

export interface ProjectOrderCreateInput {
  projectId: string;
  connectionId: string;
  offeringId: string;
  buyerEmail: string;
  amountMinor: number;
  currencyCode: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  status?: PaymentStatus;
  failureReason?: string | null;
  paidAt?: Date | null;
}

export interface ProjectOrderUpdateInput {
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  status?: PaymentStatus;
  failureReason?: string | null;
  paidAt?: Date | null;
}

export interface ProjectSubscriptionCreateInput {
  projectId: string;
  connectionId: string;
  offeringId: string;
  buyerEmail: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtCycleEnd?: boolean;
  canceledAt?: Date | null;
  failureReason?: string | null;
}

export interface ProjectSubscriptionUpdateInput {
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtCycleEnd?: boolean;
  canceledAt?: Date | null;
  failureReason?: string | null;
}

export interface PaymentConnectionListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
}

export interface ProjectOfferingListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    isActive?: boolean;
  };
}

export interface ProjectOrderListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters: {
    projectId: string;
    provider?: PaymentProvider;
  };
}

export interface ProjectSubscriptionListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters: {
    projectId: string;
    provider?: PaymentProvider;
    buyerEmail?: string;
  };
}
