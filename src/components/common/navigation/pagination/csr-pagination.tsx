'use client';

import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNextButton,
  PaginationPreviousButton,
} from '@/components/ui/pagination';
import { getPaginationRange } from './pagination-range';

export interface CSRPaginationProps {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;

  /**
   * Total number of pages
   */
  totalPages: number;

  /**
   * Called with the next page number when the user navigates.
   * The caller owns the page state (useState, react-query, etc.) and is
   * responsible for re-fetching/re-rendering based on the new value.
   */
  onPageChange: (page: number) => void;

  /**
   * Number of sibling pages to show on each side of current page
   * @default 1
   */
  siblingCount?: number;

  /**
   * Disables all controls, e.g. while a page fetch is in flight
   * @default false
   */
  disabled?: boolean;
}

/**
 * Client-driven pagination component for strictly client-side navigation
 * (in-memory lists, client-fetched data, modals, etc).
 *
 * Features:
 * - Same range/ellipsis/a11y behavior as SSRPagination, but renders buttons
 *   and calls `onPageChange` instead of building URLs
 * - No URL/history changes - caller owns page state entirely
 *
 * @example
 * ```tsx
 * const [page, setPage] = useState(1);
 * <CSRPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
 * ```
 */
export function CSRPagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  disabled = false,
}: CSRPaginationProps) {
  // Don't render if only one page
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = getPaginationRange(currentPage, totalPages, siblingCount);
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <Pagination>
      <PaginationContent>
        {/* Previous button */}
        <PaginationItem>
          <PaginationPreviousButton
            disabled={disabled || !hasPrevious}
            aria-label={hasPrevious ? `Go to page ${currentPage - 1}` : 'No previous page'}
            onClick={() => onPageChange(currentPage - 1)}
          />
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
              <PaginationButton
                isActive={isCurrent}
                disabled={disabled}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={isCurrent ? `Current page, page ${pageNum}` : `Go to page ${pageNum}`}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </PaginationButton>
            </PaginationItem>
          );
        })}

        {/* Next button */}
        <PaginationItem>
          <PaginationNextButton
            disabled={disabled || !hasNext}
            aria-label={hasNext ? `Go to page ${currentPage + 1}` : 'No next page'}
            onClick={() => onPageChange(currentPage + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
