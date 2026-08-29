import Link from "next/link";
import { buildPaginationRange } from "@/lib/shop-query";

export interface AdminProductPaginationProps {
  page: number;
  pageCount: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  hrefForPage: (page: number) => string;
}

const STEP_CLASSES =
  "font-sans text-label uppercase tracking-caps transition-colors duration-250";

const SLOT_CLASSES =
  "inline-flex h-8 min-w-8 items-center justify-center border px-2 font-sans text-body-sm transition-colors duration-250";

/**
 * The count, the steps, and numbered pages.
 *
 * `AdminOrderPagination` deliberately has no numbered pages, and says why: at twenty-five to a
 * page an order list is one or two pages deep, so a row of numbers would be chrome for a case
 * that does not arise. The catalogue is the case that does arise — 449 products is eighteen
 * pages — so the reasoning that removed the numbers there is the reasoning that puts them here.
 * `buildPaginationRange` is `lib/shop-query.ts`'s, unchanged: first, last, the current page's
 * neighbours, and ellipses for the runs between.
 *
 * An unavailable step renders as text rather than as a disabled link, so nothing focusable exists
 * that does nothing when it is activated.
 */
export function AdminProductPagination({
  page,
  pageCount,
  totalCount,
  rangeStart,
  rangeEnd,
  hrefForPage,
}: AdminProductPaginationProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body-sm text-muted">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
      </p>

      <nav aria-label="Product pages" className="flex flex-wrap items-center gap-3">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={`${STEP_CLASSES} text-muted hover:text-ink`}>
            Previous
          </Link>
        ) : (
          <span className={`${STEP_CLASSES} text-line`}>Previous</span>
        )}

        {pageCount > 1
          ? buildPaginationRange(page, pageCount).map((slot, index) =>
              slot === "ellipsis" ? (
                <span key={`ellipsis-${index}`} aria-hidden className="text-body-sm text-muted">
                  …
                </span>
              ) : (
                <Link
                  key={slot}
                  href={hrefForPage(slot)}
                  aria-current={slot === page ? "page" : undefined}
                  aria-label={`Page ${slot}`}
                  className={
                    slot === page
                      ? `${SLOT_CLASSES} border-charcoal bg-charcoal text-ivory`
                      : `${SLOT_CLASSES} border-line text-muted hover:border-charcoal hover:text-ink`
                  }
                >
                  {slot}
                </Link>
              ),
            )
          : null}

        {page < pageCount ? (
          <Link href={hrefForPage(page + 1)} className={`${STEP_CLASSES} text-muted hover:text-ink`}>
            Next
          </Link>
        ) : (
          <span className={`${STEP_CLASSES} text-line`}>Next</span>
        )}
      </nav>
    </div>
  );
}
