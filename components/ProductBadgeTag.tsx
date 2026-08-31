import type { ProductFlags, ProductStock } from "@/types/product";
import { selectProductBadge, type ProductBadgeKind } from "@/lib/product-badge";

export interface ProductBadgeTagProps {
  stock: ProductStock;
  flags: ProductFlags;
}

/**
 * One treatment per badge, and the split is the cascade's own: the shelf badges are filled and
 * the merchandising badges are outlined, so a shopper scanning a grid can tell "you cannot have
 * this" from "we like this one" before reading either word.
 */
const badgeClasses: Record<ProductBadgeKind, string> = {
  "sold-out": "bg-charcoal text-ivory",
  "low-stock": "bg-sale text-white",
  trending: "bg-white text-maroon ring-1 ring-line",
  bestseller: "bg-white text-maroon ring-1 ring-line",
  new: "bg-white text-maroon ring-1 ring-line",
};

/**
 * The single badge a card shows, positioned by its caller. Renders nothing when the cascade
 * chooses nothing, so no listing has to guard the call. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
export function ProductBadgeTag({ stock, flags }: ProductBadgeTagProps): JSX.Element | null {
  const badge = selectProductBadge(stock, flags);
  if (badge === null) return null;

  return (
    <span
      className={`inline-block whitespace-nowrap px-2.5 py-1 text-eyebrow uppercase ${badgeClasses[badge.kind]}`}
    >
      {badge.label}
    </span>
  );
}
