import type { PaginationInput, SortOptions } from '@/types/common/pagination';

export interface ProjectCreateInput {
  name: string;
  countryCode: string;
}

export interface ProjectListOptions {
  pagination?: PaginationInput;
  sort?: SortOptions;
}
