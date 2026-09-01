"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import {
  selectCrossSellCategory,
  selectCrossSellProducts,
  splitCrossSellSuggestions,
  type CrossSellBasketLine,
  type CrossSellShortlists,
} from "@/lib/cross-sell";
import { buildCategoryHref } from "@/lib/navigation";
import { getCategoryLabel } from "@/types/product";
import { CrossSellCard } from "@/components/CrossSellCard";
import { SectionHeading } from "@/components/SectionHeading";
import { ViewAllLink } from "@/components/ViewAllLink";
import { CaretDownIcon } from "@/components/icons";

/** One piece the shopper already has, and what it is worth in this basket. */
export interface CrossSellBasketItem {
  productId: string;
  amount: number;
}

export interface CrossSellRowProps {
  /** Live cart lines on `/cart`; the completed order's items on `/order-confirmation`. */
  basket: readonly CrossSellBasketItem[];
  shortlists: CrossSellShortlists;
  roman: string;
  accent: string;
  subtitle?: string;
}

export function buildRevealLabel(hiddenCount: number): string {
  return `See ${hiddenCount} more from this collection`;
}

/**
 * The "more from this shelf" rail, shared by the cart and the confirmation screen.
 *
 * **A Client Component that renders its own cards.** Which shelf to suggest from is a question
 * only the browser can answer — the cart lives in `localStorage` and a completed order's items
 * in `sessionStorage`, so no server render has ever seen either — while what is *on* each shelf
 * is a property of `data/products.json` that no request changes. So the categories are resolved
 * here and the candidates arrive as a prop, already narrowed to `ProductCardView` by
 * `getCrossSellShortlists`. Nothing a browser may not hold crosses over, and
 * `lib/catalogue-client-boundary.test.ts` is what keeps that true as the rail grows.
 *
 * It renders `CrossSellCard` rather than `ProductGrid`, which is the change
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md) made: a shop card under a
 * basket is a shop page under a basket. Two compact rows are shown and the rest sit behind one
 * toggle — the same two numbers on both screens, from `splitCrossSellSuggestions`, because this
 * is one rail rendered twice and not two rails that happen to look alike.
 *
 * It renders nothing at all — no heading, no empty state — when there is nothing relevant to
 * suggest. A rail of unrelated pieces is worse than the whitespace it was added to fill.
 */
export function CrossSellRow({
  basket,
  shortlists,
  roman,
  accent,
  subtitle,
}: CrossSellRowProps): JSX.Element | null {
  const { catalogue } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryByProductId = new Map(
    catalogue.map((entry) => [entry.id, entry.category]),
  );

  const basketLines: CrossSellBasketLine[] = [];
  for (const item of basket) {
    const category = categoryByProductId.get(item.productId);
    if (category === undefined) continue;
    basketLines.push({ productId: item.productId, category, amount: item.amount });
  }

  const suggestions = selectCrossSellProducts(basketLines, shortlists);
  if (suggestions.length === 0) return null;

  const category = selectCrossSellCategory(basketLines);
  const { shown, hidden } = splitCrossSellSuggestions(suggestions);
  const visible = isExpanded ? [...shown, ...hidden] : shown;

  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading roman={roman} accent={accent} subtitle={subtitle} align="left" as="h2" />
        {category === null ? null : (
          <ViewAllLink
            href={buildCategoryHref(category)}
            label={`All ${getCategoryLabel(category)}`}
          />
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((product) => (
          <li key={product.id}>
            <CrossSellCard product={product} />
          </li>
        ))}
      </ul>

      {hidden.length === 0 || isExpanded ? null : (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="inline-flex items-center gap-1.5 self-start text-label uppercase tracking-caps text-muted transition-colors duration-250 hover:text-ink"
        >
          {buildRevealLabel(hidden.length)}
          <CaretDownIcon className="h-3 w-3" />
        </button>
      )}
    </section>
  );
}
