export type PaginationRangeItem = number | 'ellipsis';

/**
 * Compute a compact list of page numbers (with ellipses) to render for a pagination control.
 *
 * Always anchors the first and last page, shows `siblingCount` pages on either side of
 * `currentPage`, and collapses any gaps into a single 'ellipsis' marker.
 *
 * Shared by SSRPagination and CSRPagination so both variants render identical ranges.
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): PaginationRangeItem[] {
  const pages: PaginationRangeItem[] = [];

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  const leftSibling = Math.max(2, currentPage - siblingCount);
  const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

  // Add left ellipsis if needed
  if (leftSibling > 2) {
    pages.push('ellipsis');
  }

  // Add pages around current
  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i !== 1 && i !== totalPages) {
      pages.push(i);
    }
  }

  // Add right ellipsis if needed
  if (rightSibling < totalPages - 1) {
    pages.push('ellipsis');
  }

  // Always show last page (if more than 1 page)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
