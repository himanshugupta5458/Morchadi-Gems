import Link from "next/link";

export interface AdminOrderPaginationProps {
  page: number;
  pageCount: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  previousHref: string | null;
  nextHref: string | null;
}

const STEP_CLASSES =
  "font-sans text-label uppercase tracking-caps transition-colors duration-250";

/**
 * Previous and next, plus the count that tells an operator whether the list they are looking
 * at is the whole of what matched.
 *
 * No numbered pages. With twenty-five to a page a shop this size is one or two pages deep, and
 * a row of numbers would be chrome for a case that does not arise; the count is what actually
 * answers the question, and the filters are how you get somewhere specific.
 *
 * The unavailable step renders as text rather than as a disabled link, so nothing focusable
 * exists that does nothing when it is activated.
 */
export function AdminOrderPagination({
  page,
  pageCount,
  totalCount,
  rangeStart,
  rangeEnd,
  previousHref,
  nextHref,
}: AdminOrderPaginationProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body-sm text-muted">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
      </p>

      <div className="flex items-center gap-5">
        {previousHref === null ? (
          <span className={`${STEP_CLASSES} text-line`}>Previous</span>
        ) : (
          <Link href={previousHref} className={`${STEP_CLASSES} text-muted hover:text-ink`}>
            Previous
          </Link>
        )}
        {nextHref === null ? (
          <span className={`${STEP_CLASSES} text-line`}>Next</span>
        ) : (
          <Link href={nextHref} className={`${STEP_CLASSES} text-muted hover:text-ink`}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
