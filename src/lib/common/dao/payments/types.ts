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

export interface PaymentProviderSettingUpsertInput {
  isEnabled?: boolean;
  receiverCountries: string[];
  payerCountries: string[];
  currencies: string[];
}

export interface PaymentProviderSettingUpdateInput {
  isEnabled?: boolean;
  receiverCountries?: string[];
  payerCountries?: string[];
  currencies?: string[];
  webhookRef?: string | null;
  webhookRegisteredAt?: Date | null;
  webhookError?: string | null;
  validationReport?: Prisma.InputJsonValue;
  validatedAt?: Date | null;
}

export interface PaymentProviderSettingListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
}

export interface ProviderEventListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
  filters?: {
    provider?: PaymentProvider;
    scope?: string;
    scopes?: string[];
    excludeScope?: string;
  };
}
