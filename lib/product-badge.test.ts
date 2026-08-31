import { describe, expect, it } from "vitest";
import type { ProductBadge, ProductFlags, ProductStock } from "@/types/product";
import { PRODUCT_BADGES } from "@/types/product";
import {
  LOW_STOCK_THRESHOLD,
  isStockAvailable,
  selectProductBadge,
} from "@/lib/product-badge";
import { getAllProducts } from "@/lib/products";

function stockOf(inStock: boolean, quantity: number): ProductStock {
  return { inStock, quantity };
}

function flagsOf(badge: ProductBadge | null, isNew = false): ProductFlags {
  return { featured: false, isNew, badge };
}

describe("isStockAvailable", () => {
  it("needs both the flag and a count above zero", () => {
    expect(isStockAvailable(stockOf(true, 5))).toBe(true);
    expect(isStockAvailable(stockOf(true, 0))).toBe(false);
    expect(isStockAvailable(stockOf(false, 5))).toBe(false);
    expect(isStockAvailable(stockOf(false, 0))).toBe(false);
  });
});

describe("the badge cascade", () => {
  it("shows nothing when nothing is set", () => {
    expect(selectProductBadge(stockOf(true, 10), flagsOf(null))).toBeNull();
  });

  it.each(PRODUCT_BADGES)("shows the manual %s badge on its own", (badge) => {
    expect(selectProductBadge(stockOf(true, 10), flagsOf(badge))).toMatchObject({
      kind: badge,
    });
  });

  it("labels each manual badge as the owner would write it", () => {
    const labelOf = (badge: ProductBadge): string | undefined =>
      selectProductBadge(stockOf(true, 10), flagsOf(badge))?.label;

    expect(labelOf("trending")).toBe("Trending");
    expect(labelOf("bestseller")).toBe("Best Seller");
    expect(labelOf("new")).toBe("New");
  });

  it("shows New for a record carrying isNew and no badge, as it always did", () => {
    expect(selectProductBadge(stockOf(true, 10), flagsOf(null, true))).toMatchObject({
      kind: "new",
      label: "New",
    });
  });

  it("lets a manual badge outrank isNew, so the owner can override New", () => {
    expect(
      selectProductBadge(stockOf(true, 10), flagsOf("bestseller", true)),
    ).toMatchObject({ kind: "bestseller" });
  });

  it("counts down with the real quantity at or below the threshold", () => {
    for (let quantity = 1; quantity <= LOW_STOCK_THRESHOLD; quantity += 1) {
      expect(selectProductBadge(stockOf(true, quantity), flagsOf(null))).toEqual({
        kind: "low-stock",
        label: `Only ${quantity} left`,
      });
    }
  });

  it("stops counting down one above the threshold", () => {
    expect(
      selectProductBadge(stockOf(true, LOW_STOCK_THRESHOLD + 1), flagsOf(null)),
    ).toBeNull();
  });

  it.each(PRODUCT_BADGES)("lets low stock outrank the manual %s badge", (badge) => {
    expect(selectProductBadge(stockOf(true, 2), flagsOf(badge, true))).toEqual({
      kind: "low-stock",
      label: "Only 2 left",
    });
  });

  it.each(PRODUCT_BADGES)("lets Sold Out outrank the manual %s badge", (badge) => {
    expect(selectProductBadge(stockOf(false, 10), flagsOf(badge, true))).toEqual({
      kind: "sold-out",
      label: "Sold Out",
    });
  });

  it("says Sold Out for a zero count even while the in-stock flag is set", () => {
    expect(selectProductBadge(stockOf(true, 0), flagsOf("trending", true))).toEqual({
      kind: "sold-out",
      label: "Sold Out",
    });
  });

  it("lets Sold Out outrank low stock, since zero is not a count worth showing", () => {
    expect(selectProductBadge(stockOf(false, 1), flagsOf(null))).toMatchObject({
      kind: "sold-out",
    });
  });

  /**
   * The whole matrix rather than the interesting corners, because the cascade's value is that
   * exactly one badge renders for every combination and that is a claim about all of them.
   */
  it("returns at most one badge for every combination of the four inputs", () => {
    const badgeChoices: (ProductBadge | null)[] = [null, ...PRODUCT_BADGES];

    for (const inStock of [true, false]) {
      for (const quantity of [0, 1, 2, 3, 10]) {
        for (const badge of badgeChoices) {
          for (const isNew of [true, false]) {
            const result = selectProductBadge(
              stockOf(inStock, quantity),
              flagsOf(badge, isNew),
            );

            if (!inStock || quantity === 0) {
              expect(result?.kind).toBe("sold-out");
              continue;
            }
            if (quantity <= LOW_STOCK_THRESHOLD) {
              expect(result?.kind).toBe("low-stock");
              continue;
            }
            if (badge !== null) {
              expect(result?.kind).toBe(badge);
              continue;
            }
            expect(result?.kind).toBe(isNew ? "new" : undefined);
          }
        }
      }
    }
  });
});

describe("the real catalogue under the cascade", () => {
  it("gives every sold-out record the Sold Out badge and nothing else", () => {
    const soldOut = getAllProducts().filter((product) => !product.stock.inStock);

    expect(soldOut.length).toBeGreaterThan(0);
    for (const product of soldOut) {
      expect(selectProductBadge(product.stock, product.flags)?.kind).toBe("sold-out");
    }
  });

  it("puts no false low-stock urgency on the backfilled counts", () => {
    const lowStock = getAllProducts().filter(
      (product) =>
        selectProductBadge(product.stock, product.flags)?.kind === "low-stock",
    );

    expect(lowStock).toEqual([]);
  });

  it("still shows New wherever isNew is set, which is what the field migration promised", () => {
    for (const product of getAllProducts()) {
      if (!product.flags.isNew) continue;
      if (!product.stock.inStock) continue;
      expect(selectProductBadge(product.stock, product.flags)?.kind).toBe("new");
    }
  });
});
