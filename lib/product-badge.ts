import type { ProductBadge, ProductFlags, ProductStock } from "@/types/product";

/**
 * At or below this count the card stops merchandising and starts counting down. Two rather
 * than five because the number is shown: "Only 5 left" on a shelf the owner restocks weekly
 * is a nudge nobody believes, and a claim nobody believes costs more than it earns.
 */
export const LOW_STOCK_THRESHOLD = 2;

/**
 * Every badge a card can render, in the order they outrank each other. The first three are
 * facts about the shelf and the last three are the owner's merchandising; that split is the
 * whole reason availability wins — a "Trending" ribbon on a piece nobody can buy is the one
 * badge that costs a sale rather than making one.
 */
export type ProductBadgeKind =
  | "sold-out"
  | "low-stock"
  | "trending"
  | "bestseller"
  | "new";

export interface ProductBadgeView {
  kind: ProductBadgeKind;
  label: string;
}

/**
 * Whether a piece can be bought at all: the owner is still selling it *and* there is one on
 * the shelf.
 *
 * Both halves, always, and this is the only function that combines them. `stock.inStock` is
 * the owner withdrawing a piece by hand and `stock.quantity` is the count; either reaching
 * its sold-out value is enough. Reading `inStock` alone somewhere would put a "Sold Out"
 * badge above a working Add to cart button, which is the failure this function exists to make
 * unreachable. See [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
export function isStockAvailable(stock: ProductStock): boolean {
  return stock.inStock && stock.quantity > 0;
}

const MERCHANDISING_LABELS: Record<ProductBadge, string> = {
  trending: "Trending",
  bestseller: "Best Seller",
  new: "New",
};

/**
 * The one badge a product shows, or none.
 *
 * A strict priority cascade rather than a list, because two badges on one card is two claims
 * competing for the same corner and the shopper reads whichever is louder. The order is
 * availability, then scarcity, then merchandising:
 *
 * 1. **Sold Out** — nothing can be bought, so nothing else about the piece matters yet.
 * 2. **Only N left** — the real count, not a bucket. It outranks merchandising because it is
 *    the only badge that is about to stop being true.
 * 3. **The owner's own badge** — `flags.badge`, or `flags.isNew` for the New case, which is
 *    what keeps every New badge that renders today rendering after the field was added.
 * 4. Nothing.
 *
 * Pure, and it takes the two groups rather than a `Product`, so the shop's status facet and
 * the card ask the same function the same question. See ADR-067.
 */
export function selectProductBadge(
  stock: ProductStock,
  flags: ProductFlags,
): ProductBadgeView | null {
  if (!isStockAvailable(stock)) return { kind: "sold-out", label: "Sold Out" };

  if (stock.quantity <= LOW_STOCK_THRESHOLD) {
    return { kind: "low-stock", label: `Only ${stock.quantity} left` };
  }

  if (flags.badge !== null) {
    return { kind: flags.badge, label: MERCHANDISING_LABELS[flags.badge] };
  }

  if (flags.isNew) return { kind: "new", label: MERCHANDISING_LABELS.new };

  return null;
}
