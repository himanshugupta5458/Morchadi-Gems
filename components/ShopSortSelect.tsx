"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import {
  SORT_OPTIONS,
  buildShopHref,
  isSortSlug,
  withSort,
  type ShopQuery,
} from "@/lib/shop-query";

export interface ShopSortSelectProps {
  query: ShopQuery;
}

const SELECT_ID = "shop-sort";

export function ShopSortSelect({ query }: ShopSortSelectProps): JSX.Element {
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const chosen = event.target.value;
    if (!isSortSlug(chosen)) return;
    router.push(buildShopHref(withSort(query, chosen)), { scroll: false });
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={SELECT_ID} className="text-eyebrow uppercase text-muted">
        Sort
      </label>
      <select
        id={SELECT_ID}
        value={query.sort}
        onChange={handleChange}
        className="border border-line bg-white px-3 py-2 text-body-sm text-ink transition-colors duration-250 hover:border-charcoal"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
