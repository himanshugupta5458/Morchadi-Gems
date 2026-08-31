import { describe, expect, it } from "vitest";
import { isStockAvailable } from "@/lib/product-badge";
import {
  CROSS_SELL_LIMIT,
  CROSS_SELL_SHORTLIST_DEPTH,
  selectCrossSellCategory,
  selectCrossSellProducts,
  type CrossSellBasketLine,
} from "@/lib/cross-sell";
import { getAllProducts, getCrossSellShortlists } from "@/lib/products";

/**
 * The cross-sell rails on `/cart` and `/order-confirmation` are one implementation, and this is
 * what says so: both screens call `selectCrossSellProducts` over shortlists from
 * `getCrossSellShortlists`, and every case below runs against the real catalogue on disk rather
 * than a fixture, so a category emptying out is a failure here rather than an empty rail in
 * production.
 */

const SHORTLISTS = getCrossSellShortlists();

/** A category with enough in-stock pieces to fill a rail even after the basket is excluded. */
function aWellStockedCategory(): string {
  const found = Object.entries(SHORTLISTS).find(
    ([, products]) => (products ?? []).length >= CROSS_SELL_LIMIT + 1,
  );

  if (found === undefined) {
    throw new Error(
      "no category in data/products.json holds enough in-stock pieces to fill a cross-sell rail",
    );
  }

  return found[0];
}

describe("selectCrossSellCategory", () => {
  it("has no answer for an empty basket", () => {
    expect(selectCrossSellCategory([])).toBeNull();
  });

  it("gives a single-item basket its own category", () => {
    const basket: CrossSellBasketLine[] = [
      { productId: "a", category: "rings", amount: 249 },
    ];

    expect(selectCrossSellCategory(basket)).toBe("rings");
  });

  it("ranks by total value per category, not by how many lines each has", () => {
    const basket: CrossSellBasketLine[] = [
      { productId: "a", category: "rings", amount: 200 },
      { productId: "b", category: "rings", amount: 200 },
      { productId: "c", category: "rings", amount: 200 },
      { productId: "d", category: "necklaces", amount: 1200 },
    ];

    /** Rings win on count, three lines to one. Necklaces win on money, ₹1,200 to ₹600. */
    expect(selectCrossSellCategory(basket)).toBe("necklaces");
  });

  it("also beats the single-most-expensive-item reading when the totals disagree with it", () => {
    const basket: CrossSellBasketLine[] = [
      { productId: "a", category: "bangles", amount: 700 },
      { productId: "b", category: "earrings", amount: 500 },
      { productId: "c", category: "earrings", amount: 500 },
    ];

    /** The costliest single line is a bangle; the shopper has spent more on earrings. */
    expect(selectCrossSellCategory(basket)).toBe("earrings");
  });

  it("breaks a tie on the most valuable single line", () => {
    const basket: CrossSellBasketLine[] = [
      { productId: "a", category: "rings", amount: 300 },
      { productId: "b", category: "rings", amount: 300 },
      { productId: "c", category: "pendants", amount: 600 },
    ];

    expect(selectCrossSellCategory(basket)).toBe("pendants");
  });

  it("is a function of the basket alone, so reordering its lines changes nothing", () => {
    const basket: CrossSellBasketLine[] = [
      { productId: "a", category: "rings", amount: 200 },
      { productId: "b", category: "necklaces", amount: 900 },
      { productId: "c", category: "anklets", amount: 150 },
    ];

    const forwards = selectCrossSellCategory(basket);
    const backwards = selectCrossSellCategory([...basket].reverse());

    expect(forwards).toBe("necklaces");
    expect(backwards).toBe(forwards);
  });
});

describe("the shortlists the server cuts", () => {
  it("holds only in-stock pieces, in the category it is filed under", () => {
    for (const [slug, products] of Object.entries(SHORTLISTS)) {
      for (const product of products ?? []) {
        expect(product.category).toBe(slug);
        expect(isStockAvailable(product.stock)).toBe(true);
      }
    }
  });

  it("cuts each one no deeper than the rail needs, with headroom for the basket", () => {
    for (const products of Object.values(SHORTLISTS)) {
      expect((products ?? []).length).toBeLessThanOrEqual(CROSS_SELL_SHORTLIST_DEPTH);
    }

    expect(CROSS_SELL_SHORTLIST_DEPTH).toBeGreaterThan(CROSS_SELL_LIMIT);
  });

  it("carries no field a browser may not hold", () => {
    const serialised = JSON.stringify(SHORTLISTS);

    expect(serialised).not.toContain("\"cost\"");
    expect(serialised).not.toContain("migrationProvenance");
    expect(serialised).not.toContain("primaryKeyword");
    expect(serialised).not.toContain("minPrepaidAmount");
    expect(serialised).not.toContain("description");
  });
});

describe("selectCrossSellProducts", () => {
  it("suggests from the basket's own category", () => {
    const slug = aWellStockedCategory();
    const [first] = SHORTLISTS[slug as keyof typeof SHORTLISTS] ?? [];

    const suggestions = selectCrossSellProducts(
      [{ productId: first.id, category: first.category, amount: first.pricing.price }],
      SHORTLISTS,
    );

    expect(suggestions.length).toBeGreaterThan(0);
    for (const product of suggestions) expect(product.category).toBe(slug);
  });

  it("never suggests something already in the basket", () => {
    const slug = aWellStockedCategory();
    const shortlist = SHORTLISTS[slug as keyof typeof SHORTLISTS] ?? [];
    const inBasket = shortlist.slice(0, 2);

    const suggestions = selectCrossSellProducts(
      inBasket.map((product) => ({
        productId: product.id,
        category: product.category,
        amount: product.pricing.price,
      })),
      SHORTLISTS,
    );

    const suggestedIds = suggestions.map((product) => product.id);
    for (const product of inBasket) expect(suggestedIds).not.toContain(product.id);
  });

  it("shows at most one full row", () => {
    const slug = aWellStockedCategory();
    const [first] = SHORTLISTS[slug as keyof typeof SHORTLISTS] ?? [];

    expect(
      selectCrossSellProducts(
        [{ productId: first.id, category: first.category, amount: first.pricing.price }],
        SHORTLISTS,
      ).length,
    ).toBeLessThanOrEqual(CROSS_SELL_LIMIT);
  });

  it("says nothing rather than something irrelevant when the shelf is bare", () => {
    expect(selectCrossSellProducts([], SHORTLISTS)).toEqual([]);
    expect(
      selectCrossSellProducts(
        [{ productId: "unknown", category: "rings", amount: 100 }],
        {},
      ),
    ).toEqual([]);
  });

  it("draws from the same catalogue the shop lists", () => {
    const catalogueIds = new Set(getAllProducts().map((product) => product.id));

    for (const products of Object.values(SHORTLISTS)) {
      for (const product of products ?? []) expect(catalogueIds.has(product.id)).toBe(true);
    }
  });
});
