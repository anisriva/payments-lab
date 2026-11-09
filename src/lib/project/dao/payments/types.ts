import type {
  BillingMode,
  Prisma,
  ProjectOfferingPriceType,
  PaymentEnvironment,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
} from '@/generated/prisma';
import type { PaginationInput, SortOptions } from '@/types/common/pagination';

export interface ProjectPaymentConnectionUpsertInput {
  id: string;
  projectId: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  credentialsEnc: string;
  displayHint: string;
  isEnabled?: boolean;
  verifiedAt?: Date | null;
}

export interface ProjectPaymentConnectionUpdateInput {
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
  module: string;
  moduleItemId: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ProjectOfferingUpdateInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ProjectOfferingPriceCreateInput {
  offeringId: string;
  marketId?: string | null;
  priceType: ProjectOfferingPriceType;
  amount: number;
  currencyCode: string;
  billingMode?: BillingMode | null;
  providerPlanRefs?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export interface ProjectOfferingPriceUpdateInput {
  amount?: number;
  isActive?: boolean;
  providerPlanRefs?: Prisma.InputJsonValue;
}

export interface ProjectOrderCreateInput {
  projectId: string;
  projectUserId: string;
  connectionId: string;
  projectOfferingPriceId: string;
  buyerEmail: string;
  quantity?: number;
  unitAmount: number;
  amount: number;
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
  fulfilledAt?: Date | null;
}

export interface ProjectSubscriptionCreateInput {
  projectId: string;
  projectUserId: string;
  connectionId: string;
  projectOfferingPriceId: string;
  buyerEmail: string;
  quantity?: number;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  failureReason?: string | null;
}

export interface ProjectSubscriptionUpdateInput {
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  failureReason?: string | null;
}

export interface ProjectPaymentConnectionListOptions {
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
