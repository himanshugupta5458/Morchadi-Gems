"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
  SURFACED_CATEGORIES,
  COLLECTIONS,
  type Category,
  type CollectionFilterSlug,
} from "@/types/product";
import type { CategoryCounts } from "@/lib/shop";
import {
  PRICE_BANDS,
  STATUS_FILTERS,
  buildShopHref,
  hasPriceRange,
  toggleCategory,
  toggleCollection,
  togglePriceBand,
  toggleStatus,
  withPriceRange,
  type PriceBandSlug,
  type PriceRange,
  type ShopQuery,
  type StatusSlug,
} from "@/lib/shop-query";

export interface ShopFilterPanelProps {
  query: ShopQuery;
  categoryCounts: CategoryCounts;
  onNavigate?: () => void;
}

const legendClasses = "text-eyebrow uppercase text-gold-deep";
const optionLabelClasses =
  "flex cursor-pointer items-center gap-3 py-1.5 text-body-sm text-muted transition-colors duration-250 hover:text-ink";
const checkboxClasses = "h-4 w-4 shrink-0 accent-gold-deep";
const fieldsetClasses = "flex flex-col gap-3 border-t border-line pt-8";

/** What a bound reads as in its input: the number, or nothing at all for an unset bound. */
function toBoundField(bound: number | null): string {
  return bound === null ? "" : String(bound);
}

/**
 * A typed bound, or `null` for a blank or unusable one. The same forgiveness the URL parser
 * shows, applied one step earlier so a stray letter clears the bound rather than building a
 * link the parser then has to throw away.
 */
function fromBoundField(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

export function ShopFilterPanel({
  query,
  categoryCounts,
  onNavigate,
}: ShopFilterPanelProps): JSX.Element {
  const router = useRouter();
  const rangeId = useId();

  const [minField, setMinField] = useState(() => toBoundField(query.priceRange.min));
  const [maxField, setMaxField] = useState(() => toBoundField(query.priceRange.max));

  /**
   * The two inputs are the one control here that holds text of its own rather than reading the
   * URL, so they are the one that can fall out of step with it — a chip cleared above, or the
   * back button. Re-seeding them whenever the applied range changes is what keeps the field and
   * the chip saying the same thing.
   */
  useEffect(() => {
    setMinField(toBoundField(query.priceRange.min));
    setMaxField(toBoundField(query.priceRange.max));
  }, [query.priceRange.min, query.priceRange.max]);

  function navigateTo(nextQuery: ShopQuery): void {
    router.push(buildShopHref(nextQuery), { scroll: false });
    onNavigate?.();
  }

  function handleCategoryToggle(slug: Category): void {
    navigateTo(toggleCategory(query, slug));
  }

  function handleCollectionToggle(slug: CollectionFilterSlug): void {
    navigateTo(toggleCollection(query, slug));
  }

  function handleStatusToggle(slug: StatusSlug): void {
    navigateTo(toggleStatus(query, slug));
  }

  function handlePriceBandToggle(slug: PriceBandSlug): void {
    navigateTo(togglePriceBand(query, slug));
  }

  function handlePriceRangeSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const range: PriceRange = {
      min: fromBoundField(minField),
      max: fromBoundField(maxField),
    };
    navigateTo(withPriceRange(query, range));
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className={legendClasses}>Category</legend>
        <ul className="flex flex-col">
          {SURFACED_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <label className={optionLabelClasses}>
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={query.categories.includes(category.slug)}
                  onChange={() => handleCategoryToggle(category.slug)}
                />
                <span>
                  {category.label}{" "}
                  <span className="text-line">({categoryCounts[category.slug]})</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={fieldsetClasses}>
        <legend className={legendClasses}>Collection</legend>
        <ul className="flex flex-col">
          {COLLECTIONS.map((collection) => (
            <li key={collection.slug}>
              <label className={optionLabelClasses}>
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={query.collections.includes(collection.slug)}
                  onChange={() => handleCollectionToggle(collection.slug)}
                />
                {collection.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={fieldsetClasses}>
        <legend className={legendClasses}>Status</legend>
        <ul className="flex flex-col">
          {STATUS_FILTERS.map((option) => (
            <li key={option.slug}>
              <label className={optionLabelClasses}>
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={query.statuses.includes(option.slug)}
                  onChange={() => handleStatusToggle(option.slug)}
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={fieldsetClasses}>
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

        <form onSubmit={handlePriceRangeSubmit} className="flex flex-col gap-2.5 pt-2">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`${rangeId}-min`}>
              Minimum price in rupees
            </label>
            <input
              id={`${rangeId}-min`}
              type="text"
              inputMode="numeric"
              placeholder="Min"
              value={minField}
              onChange={(event) => setMinField(event.target.value)}
              className="w-full min-w-0 border border-line bg-white px-2.5 py-2 text-body-sm text-ink transition-colors duration-250 focus:border-gold-deep"
            />
            <span aria-hidden className="text-body-sm text-muted">
              –
            </span>
            <label className="sr-only" htmlFor={`${rangeId}-max`}>
              Maximum price in rupees
            </label>
            <input
              id={`${rangeId}-max`}
              type="text"
              inputMode="numeric"
              placeholder="Max"
              value={maxField}
              onChange={(event) => setMaxField(event.target.value)}
              className="w-full min-w-0 border border-line bg-white px-2.5 py-2 text-body-sm text-ink transition-colors duration-250 focus:border-gold-deep"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="border border-charcoal px-4 py-2 text-label uppercase tracking-caps text-charcoal transition-colors duration-250 hover:border-maroon hover:bg-maroon hover:text-ivory"
            >
              Apply
            </button>
            {hasPriceRange(query.priceRange) ? (
              <button
                type="button"
                onClick={() => navigateTo(withPriceRange(query, { min: null, max: null }))}
                className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-maroon"
              >
                Clear range
              </button>
            ) : null}
          </div>
        </form>
      </fieldset>
    </div>
  );
}
