import Link from "next/link";
import { buildPaginationRange } from "@/lib/shop-query";

export interface PaginationProps {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}

const slotClasses =
  "inline-flex h-10 min-w-10 items-center justify-center border px-3 text-body-sm transition-colors duration-250";
const inactiveSlotClasses = `${slotClasses} border-line text-muted hover:border-charcoal hover:text-ink`;
const activeSlotClasses = `${slotClasses} border-charcoal bg-charcoal text-ivory`;

export function Pagination({
  page,
  totalPages,
  hrefForPage,
}: PaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null;

  const slots = buildPaginationRange(page, totalPages);

  return (
    <nav aria-label="Pagination" className="flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <Link
              href={hrefForPage(page - 1)}
              scroll={false}
              rel="prev"
              className={inactiveSlotClasses}
            >
              Previous
            </Link>
          </li>
        ) : null}

        {slots.map((slot, index) =>
          slot === "ellipsis" ? (
            <li
              key={`ellipsis-${index}`}
              aria-hidden
              className="px-1 text-body-sm text-muted"
            >
              …
            </li>
          ) : (
            <li key={slot}>
              <Link
                href={hrefForPage(slot)}
                scroll={false}
                aria-current={slot === page ? "page" : undefined}
                aria-label={`Page ${slot}`}
                className={slot === page ? activeSlotClasses : inactiveSlotClasses}
              >
                {slot}
              </Link>
            </li>
          ),
        )}

        {page < totalPages ? (
          <li>
            <Link
              href={hrefForPage(page + 1)}
              scroll={false}
              rel="next"
              className={inactiveSlotClasses}
            >
              Next
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
