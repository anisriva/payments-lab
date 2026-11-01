import type {
  BillingInterval,
  CreditPurchaseKind,
  PaymentEnvironment,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
} from '@/generated/prisma';
import type { PaginationInput, SortOptions } from '@/types/common/pagination';

export interface PlatformPlanPriceCreateInput {
  planKey: string;
  displayName: string;
  interval: BillingInterval;
  amountMinor: number;
  currencyCode: string;
  isActive?: boolean;
}

export interface PlatformPlanPriceUpdateInput {
  displayName?: string;
  isActive?: boolean;
}

export interface PlatformPlanPriceListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    isActive?: boolean;
    currencyCode?: string;
  };
}

export interface AiCreditRateCreateInput {
  currencyCode: string;
  rateMinor: number;
  isActive?: boolean;
}

export interface AiCreditRateUpdateInput {
  rateMinor?: number;
  isActive?: boolean;
}

export interface AiCreditRateListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    currencyCode?: string;
    isActive?: boolean;
  };
}

export interface SubscriptionCreateInput {
  platformPlanPriceId: string;
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

export interface SubscriptionUpdateInput {
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtCycleEnd?: boolean;
  canceledAt?: Date | null;
  failureReason?: string | null;
}

export interface AiCreditPurchaseCreateInput {
  kind: CreditPurchaseKind;
  credits: number;
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

export interface AiCreditPurchaseUpdateInput {
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  status?: PaymentStatus;
  failureReason?: string | null;
  paidAt?: Date | null;
}

export interface PaymentCreateInput {
  kind: PaymentKind;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  providerPaymentId: string;
  amountMinor: number;
  currencyCode: string;
  aiCreditPurchaseId?: string | null;
  subscriptionId?: string | null;
}

export interface SubscriptionListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    provider?: PaymentProvider;
  };
}

export interface AiCreditPurchaseListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    provider?: PaymentProvider;
  };
}

export interface PaymentListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    provider?: PaymentProvider;
  };
}
