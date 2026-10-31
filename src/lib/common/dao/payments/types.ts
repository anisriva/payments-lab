import type {
  PaymentProvider,
  PaymentEnvironment,
  ProviderProductRefType,
  Prisma,
} from '@/generated/prisma';
import type { PaginationInput, SortOptions } from '@/types/common/pagination';

export interface ProviderProductCreateInput {
  scope: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  refType: ProviderProductRefType;
  refId: string;
  providerRef: string;
}

export interface ProviderEventCreateInput {
  provider: PaymentProvider;
  scope: string;
  providerEventId: string;
  eventType: string;
  headers: Prisma.InputJsonValue;
  rawBody: string;
}

export interface ProviderEventListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    provider?: PaymentProvider;
    scope?: string;
  };
}
