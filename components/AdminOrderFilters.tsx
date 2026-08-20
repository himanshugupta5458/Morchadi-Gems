import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import {
  ADMIN_ORDER_SORTS,
  MAX_ADMIN_ORDER_SEARCH_LENGTH,
  type AdminOrderQuery,
  type AdminOrderSort,
} from "@/lib/admin-orders";
import { buttonClasses } from "@/lib/button-styles";
import { getOrderStatusLabel } from "@/lib/order-status";

const SORT_LABELS: Record<AdminOrderSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "total-high": "Total, high to low",
  "total-low": "Total, low to high",
};

const FIELD_CLASSES =
  "w-full border border-line bg-white px-3 py-2.5 font-sans text-body-sm text-ink transition-colors duration-250 focus:border-gold";

const FIELD_LABEL_CLASSES = "text-eyebrow uppercase tracking-caps-wide text-muted";

export interface AdminOrderFiltersProps {
  action: string;
  query: AdminOrderQuery;
  statuses: readonly OrderStatus[];
  clearHref: string | null;
}

/**
 * The filter bar: a plain `<form method="get">`.
 *
 * Submitting it navigates, which is exactly what filtering this list means — the URL is the
 * state, and the server re-renders against it. That is why there is no `"use client"` here and
 * no `onChange` anywhere: a solo-operator tool that filters without JavaScript is a tool that
 * still works on a phone with a bad connection, and it costs nothing to build that way.
 *
 * The current view rides along in a hidden field so filtering inside the Resolved tab does not
 * throw you back to Active. `page` is deliberately *not* carried: a new filter starts at page
 * one, and the browser dropping it is the behaviour we want rather than an omission.
 */
export function AdminOrderFilters({
  action,
  query,
  statuses,
  clearHref,
}: AdminOrderFiltersProps): JSX.Element {
  return (
    <form method="get" action={action} className="flex flex-col gap-4">
      <input type="hidden" name="view" value={query.view} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5 lg:col-span-2">
          <span className={FIELD_LABEL_CLASSES}>Search</span>
          <input
            type="search"
            name="search"
            defaultValue={query.search}
            maxLength={MAX_ADMIN_ORDER_SEARCH_LENGTH}
            placeholder="Order number, phone or name"
            className={FIELD_CLASSES}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>Status</span>
          <select name="status" defaultValue={query.status ?? ""} className={FIELD_CLASSES}>
            <option value="">All in this view</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {getOrderStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>Placed from</span>
          <input type="date" name="from" defaultValue={query.from} className={FIELD_CLASSES} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>Placed to</span>
          <input type="date" name="to" defaultValue={query.to} className={FIELD_CLASSES} />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex w-full flex-col gap-1.5 sm:max-w-[16rem]">
          <span className={FIELD_LABEL_CLASSES}>Sort</span>
          <select name="sort" defaultValue={query.sort} className={FIELD_CLASSES}>
            {ADMIN_ORDER_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-5">
          {clearHref === null ? null : (
            <Link
              href={clearHref}
              className="font-sans text-label uppercase tracking-caps text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
            >
              Clear filters
            </Link>
          )}
          <button type="submit" className={buttonClasses({ size: "sm" })}>
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
