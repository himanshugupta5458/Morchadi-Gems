"use client";

import { useCart } from "@/lib/cart-context";
import {
  selectCrossSellCategory,
  selectCrossSellProducts,
  type CrossSellBasketLine,
  type CrossSellShortlists,
} from "@/lib/cross-sell";
import { buildCategoryHref } from "@/lib/navigation";
import { getCategoryLabel } from "@/types/product";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { ViewAllLink } from "@/components/ViewAllLink";

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

/**
 * The "more from this shelf" rail, shared by the cart and the confirmation screen.
 *
 * **A Client Component that renders `ProductGrid`.** Which shelf to suggest from is a question
 * only the browser can answer — the cart lives in `localStorage` and a completed order's items
 * in `sessionStorage`, so no server render has ever seen either — while what is *on* each shelf
 * is a property of `data/products.json` that no request changes. So the categories are resolved
 * here and the candidates arrive as a prop, already narrowed to `ProductCardView` by
 * `getCrossSellShortlists`. Nothing a browser may not hold crosses over, and
 * `lib/catalogue-client-boundary.test.ts` is what keeps that true as the rail grows.
 *
 * The category of each basket line is read off the cart's own catalogue index, which is already
 * in the browser, rather than shipped a second time as a lookup table.
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

  return (
    <section className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading roman={roman} accent={accent} subtitle={subtitle} align="left" as="h2" />
        {category === null ? null : (
          <ViewAllLink
            href={buildCategoryHref(category)}
            label={`All ${getCategoryLabel(category)}`}
          />
        )}
      </div>

      <ProductGrid products={suggestions} />
    </section>
  );
}
