import type { PaginationInput } from '@/types/common/pagination';

export interface CountryUpsertInput {
  name: string;
  currencyCode: string;
}

export interface CountryListOptions {
  pagination?: PaginationInput;
}
