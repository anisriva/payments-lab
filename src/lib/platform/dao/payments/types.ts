import type {
  BillingMode,
  PaymentEnvironment,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@/generated/prisma';
import type { PaginationInput, SortOptions } from '@/types/common/pagination';

export interface PlatformPlanPriceCreateInput {
  planId: string;
  marketId: string;
  billingMode: BillingMode;
  unitAmount: number;
  currencyCode: string;
  providerPlanRefs?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export interface PlatformPlanPriceUpdateInput {
  isActive?: boolean;
  providerPlanRefs?: Prisma.InputJsonValue;
}

export interface PlatformPlanPriceListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: { isActive?: boolean; currencyCode?: string; marketId?: string };
}

export interface PlatformSubscriptionCreateInput {
  projectId: string;
  platformUserId: string;
  platformPlanPriceId?: string;
  platformOfferingPriceId?: string;
  quantity?: number;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
}

export interface PlatformSubscriptionUpdateInput {
  providerSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  trialEnd?: Date | null;
  failureReason?: string | null;
}

export interface PlatformSubscriptionListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: { provider?: PaymentProvider };
}

export interface PlatformOrderCreateInput {
  projectId: string;
  platformUserId: string;
  platformOfferingPriceId: string;
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

export interface PlatformOrderUpdateInput {
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  status?: PaymentStatus;
  failureReason?: string | null;
  paidAt?: Date | null;
  fulfilledAt?: Date | null;
}

export interface PlatformOrderListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: { provider?: PaymentProvider };
}

export interface PlatformPaymentCreateInput {
  kind: PaymentKind;
  projectId?: string | null;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  providerPaymentId: string;
  amount: number;
  currencyCode: string;
  platformOrderId?: string | null;
  platformSubscriptionId?: string | null;
}

export interface PlatformPaymentListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: { provider?: PaymentProvider };
}

export interface PlatformOfferingCreateInput {
  key: string;
  name: string;
  unitLabel?: string | null;
  minQuantity?: number;
  maxQuantity: number;
  quantityStep?: number;
  quickPicks?: number[];
  isActive?: boolean;
}

export interface PlatformOfferingPriceCreateInput {
  offeringId: string;
  marketId: string;
  priceType: 'one_time' | 'recurring';
  billingMode?: BillingMode | null;
  unitAmount: number;
  currencyCode: string;
  providerPlanRefs?: Prisma.InputJsonValue;
  isActive?: boolean;
}
