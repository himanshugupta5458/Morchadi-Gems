import type { Category, ProductCardView } from "@/types/product";
import { isStockAvailable } from "@/lib/product-badge";

/**
 * How many suggestions a cross-sell rail shows. Four, because the grid is four abreast from
 * `lg` and two abreast on a phone — so the rail is exactly one row at every width, and never
 * the ragged half-row a fifth card would make.
 */
export const CROSS_SELL_LIMIT = 4;

/**
 * How deep a per-category shortlist is cut on the server.
 *
 * Two more than the rail shows, because the pieces already in the basket are excluded from it
 * in the browser and the basket is usually drawn from the very category being suggested. Two
 * is the headroom that keeps a full row of four for a two-line cart, which is the shape of
 * almost every cart this shop takes.
 */
export const CROSS_SELL_SHORTLIST_DEPTH = CROSS_SELL_LIMIT + 2;

/**
 * One line of the basket a rail is reasoning about — which piece, and what that piece is worth
 * in this basket. Both the cart and the confirmation screen build it: the first from live cart
 * lines, the second from the completed order's stored items.
 */
export interface CrossSellBasketLine {
  productId: string;
  category: Category;
  /** `unit price × quantity`. Display-derived and used only to rank categories. */
  amount: number;
}

/** The server's shortlists, one per category that has anything to suggest. */
export type CrossSellShortlists = Partial<Record<Category, ProductCardView[]>>;

/**
 * Which shelf a basket is most about, or **null** for a basket with nothing on it.
 *
 * **The rule is total value per category, not the single most valuable piece and not the most
 * frequent category.** A basket of one ₹1,200 necklace and three ₹200 rings is a ring basket by
 * count and a necklace basket by top item, and neither reading is obviously right — but the
 * shopper has spent ₹1,200 on necklaces and ₹600 on rings, and money spent is the closest thing
 * to a statement of what they came for. It also degenerates correctly: a single-category basket
 * gives that category under every rule, and a single-item basket gives its own.
 *
 * Ties are broken on the most valuable single line, and then on the order the basket lists its
 * lines, so the answer is a function of the basket alone and never of `Map` iteration luck.
 */
export function selectCrossSellCategory(
  basket: readonly CrossSellBasketLine[],
): Category | null {
  if (basket.length === 0) return null;

  const totalByCategory = new Map<Category, number>();
  const bestLineByCategory = new Map<Category, number>();

  for (const line of basket) {
    totalByCategory.set(line.category, (totalByCategory.get(line.category) ?? 0) + line.amount);
    bestLineByCategory.set(
      line.category,
      Math.max(bestLineByCategory.get(line.category) ?? 0, line.amount),
    );
  }

  let chosen: Category | null = null;

  for (const line of basket) {
    if (chosen === null) {
      chosen = line.category;
      continue;
    }
    if (line.category === chosen) continue;

    const challengerTotal = totalByCategory.get(line.category) ?? 0;
    const chosenTotal = totalByCategory.get(chosen) ?? 0;
    if (challengerTotal > chosenTotal) {
      chosen = line.category;
      continue;
    }
    if (challengerTotal < chosenTotal) continue;

    const challengerBest = bestLineByCategory.get(line.category) ?? 0;
    const chosenBest = bestLineByCategory.get(chosen) ?? 0;
    if (challengerBest > chosenBest) chosen = line.category;
  }

  return chosen;
}

/**
 * The pieces a rail actually shows: the shortlist for the basket's category, minus anything
 * already in the basket, minus anything sold out, capped at `CROSS_SELL_LIMIT`.
 *
 * Sold-out pieces are dropped rather than rendered with their "Sold out" button, which is the
 * one place this differs from the shop's own grid. A shelf a shopper chose to browse may
 * honestly show what is out of stock; a suggestion is a recommendation, and recommending
 * something nobody can buy is a wasted row.
 *
 * Returns an empty array rather than a fallback from another category. A rail with nothing
 * relevant to say says nothing — the caller renders no section at all — because a "you may also
 * like" row of unrelated pieces is worse than the whitespace it fills.
 */
export function selectCrossSellProducts(
  basket: readonly CrossSellBasketLine[],
  shortlists: CrossSellShortlists,
  limit: number = CROSS_SELL_LIMIT,
): ProductCardView[] {
  const category = selectCrossSellCategory(basket);
  if (category === null) return [];

  const basketProductIds = new Set(basket.map((line) => line.productId));

  return (shortlists[category] ?? [])
    .filter((product) => !basketProductIds.has(product.id))
    .filter((product) => isStockAvailable(product.stock))
    .slice(0, limit);
}
