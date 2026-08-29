import Link from "next/link";
import {
  ADMIN_PRODUCT_CATEGORY_OPTIONS,
  ADMIN_PRODUCT_FLAGS,
  ADMIN_PRODUCT_FLAG_LABELS,
  ADMIN_PRODUCT_PRICE_BAND_OPTIONS,
  ADMIN_PRODUCT_SORTS,
  ADMIN_PRODUCT_SORT_LABELS,
  MAX_ADMIN_PRODUCT_SEARCH_LENGTH,
  type AdminProductQuery,
} from "@/lib/admin-products";
import { buttonClasses } from "@/lib/button-styles";

const FIELD_CLASSES =
  "w-full border border-line bg-white px-3 py-2.5 font-sans text-body-sm text-ink transition-colors duration-250 focus:border-gold";

const FIELD_LABEL_CLASSES = "text-eyebrow uppercase tracking-caps-wide text-muted";

export interface AdminProductFiltersProps {
  action: string;
  query: AdminProductQuery;
  clearHref: string | null;
}

/**
 * The filter bar: a plain `<form method="get">`, exactly as `AdminOrderFilters` is.
 *
 * Submitting it navigates, which is what filtering this list means — the URL is the state and the
 * server re-renders against it. No `"use client"` and no `onChange`: a tool that filters without
 * JavaScript still works on a phone with a bad connection, and it costs nothing to build that way.
 *
 * The current view rides along in a hidden field so filtering inside Out of stock does not throw
 * you back to All. `page` is deliberately not carried — a new filter starts at page one, and the
 * browser dropping it is the behaviour we want rather than an omission.
 */
export function AdminProductFilters({
  action,
  query,
  clearHref,
}: AdminProductFiltersProps): JSX.Element {
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
            maxLength={MAX_ADMIN_PRODUCT_SEARCH_LENGTH}
            placeholder="Product code or name"
            className={FIELD_CLASSES}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>Category</span>
          <select name="category" defaultValue={query.category ?? ""} className={FIELD_CLASSES}>
            <option value="">Every category</option>
            {ADMIN_PRODUCT_CATEGORY_OPTIONS.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>Price</span>
          <select name="price" defaultValue={query.priceBand ?? ""} className={FIELD_CLASSES}>
            <option value="">Any price</option>
            {ADMIN_PRODUCT_PRICE_BAND_OPTIONS.map((band) => (
              <option key={band.slug} value={band.slug}>
                {band.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>Flag</span>
          <select name="flag" defaultValue={query.flag ?? ""} className={FIELD_CLASSES}>
            <option value="">Any flag</option>
            {ADMIN_PRODUCT_FLAGS.map((flag) => (
              <option key={flag} value={flag}>
                {ADMIN_PRODUCT_FLAG_LABELS[flag]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex w-full flex-col gap-1.5 sm:max-w-[16rem]">
          <span className={FIELD_LABEL_CLASSES}>Sort</span>
          <select name="sort" defaultValue={query.sort} className={FIELD_CLASSES}>
            {ADMIN_PRODUCT_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {ADMIN_PRODUCT_SORT_LABELS[sort]}
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
