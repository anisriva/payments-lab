/**
 * Common pagination, sorting, and filtering types
 * Used across all DAOs and APIs for consistency
 */

/************** RESPONSE **********/
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/************** REQUEST **********/

// pagination
export interface PaginationInput {
  page: number;
  limit: number;
}

// Sort
export interface SortOptions<T = Record<string, unknown>> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

// API options
export interface BaseAPIOptions<T = Record<string, unknown>, F = Record<string, unknown>> {
  pagination?: PaginationInput;
  sort?: SortOptions<T>;
  filters?: F;
}

// search filters
export interface BaseSearchOptions {
  pagination?: PaginationInput;
  search?: string;
}

/************** DEFAULTS **********/
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 10,
} as const;
