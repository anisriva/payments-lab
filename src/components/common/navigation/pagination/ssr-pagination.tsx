import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { getPaginationRange } from './pagination-range';

export interface SSRPaginationProps {
  /**
   * Current pathname (from usePathname or page context)
   */
  pathname: string;

  /**
   * Current search params (from useSearchParams or page context)
   */
  searchParams: Record<string, string | string[] | undefined>;

  /**
   * Current page number (1-indexed)
   */
  currentPage: number;

  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Query parameter name for page
   * @default 'page'
   */
  pageParam?: string;

  /**
   * Number of sibling pages to show on each side of current page
   * @default 1
   */
  siblingCount?: number;
}

/**
 * Server-rendered URL-driven pagination component
 *
 * Features:
 * - Updates ?page= param via Next Link (soft client navigation, not a full reload)
 * - Preserves all active params (q, status, etc.)
 * - Omits page=1 (canonical URL)
 * - Disabled prev/next at boundaries
 * - aria-current="page" for current page
 * - Accessible labels
 * - Compact ranges with ellipses
 * - NO router.refresh() / onClick - the URL change is the navigation
 *
 * @example
 * ```tsx
 * <SSRPagination
 *   pathname="/platform/projects/123/manage-contents/blogs"
 *   searchParams={searchParams}
 *   currentPage={result.page}
 *   totalPages={result.totalPages}
 * />
 * ```
 */
export function SSRPagination({
  pathname,
  searchParams,
  currentPage,
  totalPages,
  pageParam = 'page',
  siblingCount = 1,
}: SSRPaginationProps) {
  // Don't render if only one page
  if (totalPages <= 1) {
    return null;
  }

  /**
   * Build URL with updated page parameter
   */
  const buildUrl = (page: number): string => {
    const params = new URLSearchParams();

    // Preserve all existing params
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }
    });

    // Update page param (omit page=1 for canonical URL)
    if (page > 1) {
      params.set(pageParam, page.toString());
    } else {
      params.delete(pageParam);
    }

    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const pageNumbers = getPaginationRange(currentPage, totalPages, siblingCount);
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <Pagination>
      <PaginationContent>
        {/* Previous button */}
        <PaginationItem>
          {hasPrevious ? (
            <PaginationPrevious asChild aria-label={`Go to page ${currentPage - 1}`}>
              <Link href={buildUrl(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </Link>
            </PaginationPrevious>
          ) : (
            <PaginationPrevious
              href="#"
              aria-disabled="true"
              aria-label="No previous page"
              className="pointer-events-none opacity-50"
            />
          )}
        </PaginationItem>

        {/* Page numbers */}
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === 'ellipsis') {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          const isCurrent = pageNum === currentPage;

          return (
            <PaginationItem key={pageNum}>
              <PaginationLink
                asChild
                isActive={isCurrent}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={isCurrent ? `Current page, page ${pageNum}` : `Go to page ${pageNum}`}
              >
                <Link href={buildUrl(pageNum)}>{pageNum}</Link>
              </PaginationLink>
            </PaginationItem>
          );
        })}

        {/* Next button */}
        <PaginationItem>
          {hasNext ? (
            <PaginationNext asChild aria-label={`Go to page ${currentPage + 1}`}>
              <Link href={buildUrl(currentPage + 1)}>
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </PaginationNext>
          ) : (
            <PaginationNext
              href="#"
              aria-disabled="true"
              aria-label="No next page"
              className="pointer-events-none opacity-50"
            />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
