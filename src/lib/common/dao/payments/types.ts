import type {
  PaymentProvider,
  Prisma,
} from '@/generated/prisma';
import type { PaginationInput, SortOptions } from '@/types/common/pagination';

// ── Provider rules ──

export interface ProviderRuleUpsertInput {
  isEnabled?: boolean;
  priority?: number;
  receiverCountries?: string[];
  payerCountries?: string[];
  currencies?: string[];
}

export interface ProviderRuleUpdateInput extends ProviderRuleUpsertInput {
  webhookRef?: string | null;
  webhookRegisteredAt?: Date | null;
  webhookError?: string | null;
  validationReport?: Prisma.InputJsonValue;
  validatedAt?: Date | null;
}

export interface ProviderRuleListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
}

// ── Provider events ──

export interface ProviderEventCreateInput {
  provider: PaymentProvider;
  connectionId?: string; // project events only
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
    connectionId?: string;
    connectionIds?: string[];
  };
}
