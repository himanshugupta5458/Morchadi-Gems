import Link from "next/link";
import {
  SHOP_PATH,
  buildShopHref,
  toggleCategory,
  toggleCollection,
  togglePriceBand,
  toggleStatus,
  withoutPriceRange,
  withoutSearch,
  type ShopQuery,
} from "@/lib/shop-query";
import type { AppliedFilter } from "@/lib/shop";
import { CloseIcon } from "@/components/icons";

export interface ShopActiveFiltersProps {
  query: ShopQuery;
  filters: AppliedFilter[];
}

/**
 * Where a chip's × points: the same query with that one selection undone, and nothing else
 * touched. The custom range clears both of its bounds together, because it was one control and
 * one chip and half a range is not a filter anybody asked for.
 */
function buildRemovalHref(query: ShopQuery, filter: AppliedFilter): string {
  switch (filter.kind) {
    case "search":
      return buildShopHref(withoutSearch(query));
    case "category":
      return buildShopHref(toggleCategory(query, filter.slug));
    case "collection":
      return buildShopHref(toggleCollection(query, filter.slug));
    case "status":
      return buildShopHref(toggleStatus(query, filter.slug));
    case "price":
      return buildShopHref(togglePriceBand(query, filter.slug));
    case "price-range":
      return buildShopHref(withoutPriceRange(query));
  }
}

function filterKey(filter: AppliedFilter): string {
  return filter.kind === "price-range" || filter.kind === "search"
    ? filter.kind
    : `${filter.kind}:${filter.slug}`;
}

export function ShopActiveFilters({
  query,
  filters,
}: ShopActiveFiltersProps): JSX.Element | null {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-eyebrow uppercase text-muted">Filtered by</span>

      {filters.map((filter) => (
        <Link
          key={filterKey(filter)}
          href={buildRemovalHref(query, filter)}
          scroll={false}
          className="group inline-flex items-center gap-2 border border-line bg-ivory py-1.5 pl-3 pr-2.5 text-body-sm text-ink transition-colors duration-250 hover:border-charcoal"
        >
          {filter.label}
          <CloseIcon className="h-3.5 w-3.5 text-muted transition-colors duration-250 group-hover:text-maroon" />
          <span className="sr-only">Remove filter</span>
        </Link>
      ))}

      <Link
        href={SHOP_PATH}
        scroll={false}
        className="ml-1 text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-maroon"
      >
        Clear all
      </Link>
    </div>
  );
}
