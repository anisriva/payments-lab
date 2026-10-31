import type { ApiResponse, PaginatedApiResponse } from '@/types/common';
import type { PaginationResult } from '@/types/common/pagination';

/**
 * Fetch wrapper for internal API routes (client-side).
 * Parses the ApiResponse<T> envelope, throws an Error carrying the API's
 * user-safe message on any failure, and returns the narrowed data on success.
 *
 * JSON requests only — for FormData uploads call fetch directly
 * (a manual Content-Type header breaks the multipart boundary).
 *
 * @example
 * // Query (object)
 * queryFn: () => apiFetch<Project>(`/api/platform/projects/${projectId}`)
 *
 * // Mutation
 * mutationFn: (data: CreateProjectInput) =>
 *   apiFetch<Project>('/api/platform/projects', {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *   })
 */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  customErrorMessage?: string
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  // Infra failures (502 pages, proxy errors) return non-JSON bodies —
  // surface a status message instead of a JSON parse crash
  const apiResponse = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!apiResponse) {
    throw new Error(`Request failed (${response.status})`);
  }

  if (!response.ok || !apiResponse.success) {
    const apiError = 'error' in apiResponse ? apiResponse.error : undefined;
    throw new Error(apiError || customErrorMessage || `Request failed (${response.status})`);
  }

  // TypeScript has narrowed to the success branch — no cast
  return apiResponse.data as T;
}

/**
 * Fetch wrapper for paginated list endpoints (client-side).
 * Parses the PaginatedApiResponse<T> envelope and reassembles the
 * PaginationResult<T> shape that the rest of the app expects.
 *
 * List routes return: { success: true, data: T[], meta: {...} }
 * This function returns: { data: T[], meta: {...} }
 *
 * @example
 * // Query (list)
 * queryFn: () => apiFetchPaginated<Project>('/api/platform/projects?page=1')
 *
 * // Usage in component:
 * const { data } = useProjects({ page: 1, search: 'blog' });
 * // data.data = projects, data.meta = pagination info
 */
export async function apiFetchPaginated<T>(
  url: string,
  init?: RequestInit,
  customErrorMessage?: string
): Promise<PaginationResult<T>> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body = (await response.json().catch(() => null)) as PaginatedApiResponse<T> | null;

  if (!body) {
    throw new Error(`Request failed (${response.status})`);
  }

  if (!response.ok || !body.success) {
    const apiError = 'error' in body ? body.error : undefined;
    throw new Error(apiError || customErrorMessage || `Request failed (${response.status})`);
  }

  if (!body.meta) {
    // A route nested PaginationResult under data or dropped meta —
    // fail loudly instead of rendering pagination UI with no page info
    throw new Error('List response missing meta — route does not follow apis.md');
  }

  return { data: body.data, meta: body.meta };
}
