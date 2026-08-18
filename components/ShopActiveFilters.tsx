import Link from "next/link";
import {
  SHOP_PATH,
  buildShopHref,
  toggleCategory,
  togglePriceBand,
  type ShopQuery,
} from "@/lib/shop-query";
import type { AppliedFilter } from "@/lib/shop";
import { CloseIcon } from "@/components/icons";

export interface ShopActiveFiltersProps {
  query: ShopQuery;
  filters: AppliedFilter[];
}

function buildRemovalHref(query: ShopQuery, filter: AppliedFilter): string {
  return filter.kind === "category"
    ? buildShopHref(toggleCategory(query, filter.slug))
    : buildShopHref(togglePriceBand(query, filter.slug));
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
          key={`${filter.kind}:${filter.slug}`}
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
