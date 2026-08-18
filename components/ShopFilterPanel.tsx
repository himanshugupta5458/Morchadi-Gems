"use client";

import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/types/product";
import {
  PRICE_BANDS,
  buildShopHref,
  toggleCategory,
  togglePriceBand,
  type PriceBandSlug,
  type ShopQuery,
} from "@/lib/shop-query";

export interface ShopFilterPanelProps {
  query: ShopQuery;
  onNavigate?: () => void;
}

const legendClasses = "text-eyebrow uppercase text-gold-deep";
const optionLabelClasses =
  "flex cursor-pointer items-center gap-3 py-1.5 text-body-sm text-muted transition-colors duration-250 hover:text-ink";
const checkboxClasses = "h-4 w-4 shrink-0 accent-gold-deep";

export function ShopFilterPanel({
  query,
  onNavigate,
}: ShopFilterPanelProps): JSX.Element {
  const router = useRouter();

  function navigateTo(nextQuery: ShopQuery): void {
    router.push(buildShopHref(nextQuery), { scroll: false });
    onNavigate?.();
  }

  function handleCategoryToggle(slug: Category): void {
    navigateTo(toggleCategory(query, slug));
  }

  function handlePriceBandToggle(slug: PriceBandSlug): void {
    navigateTo(togglePriceBand(query, slug));
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className={legendClasses}>Category</legend>
        <ul className="flex flex-col">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <label className={optionLabelClasses}>
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={query.categories.includes(category.slug)}
                  onChange={() => handleCategoryToggle(category.slug)}
                />
                {category.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-8">
        <legend className={legendClasses}>Price</legend>
        <ul className="flex flex-col">
          {PRICE_BANDS.map((band) => (
            <li key={band.slug}>
              <label className={optionLabelClasses}>
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={query.priceBands.includes(band.slug)}
                  onChange={() => handlePriceBandToggle(band.slug)}
                />
                {band.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}
