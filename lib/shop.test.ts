import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import { getAllProducts } from "@/lib/products";
import {
  DEFAULT_SORT,
  PER_PAGE,
  PRICE_BANDS,
  SORT_OPTIONS,
  buildPaginationRange,
  buildShopHref,
  emptyShopQuery,
  getPriceBand,
  getShopResults,
  isPriceInBand,
  parseShopQuery,
  toggleCategory,
  togglePriceBand,
  withPage,
  withSort,
  type ShopSearchParams,
  type SortSlug,
} from "@/lib/shop";

const CATALOGUE_SIZE = getAllProducts().length;
const TOTAL_PAGES = Math.ceil(CATALOGUE_SIZE / PER_PAGE);

function collectEveryPage(params: ShopSearchParams): Product[] {
  const firstPage = getShopResults(params);
  const everyItem: Product[] = [];

  for (let page = 1; page <= firstPage.totalPages; page += 1) {
    everyItem.push(...getShopResults({ ...params, page: String(page) }).items);
  }

  return everyItem;
}

function pricesOf(products: Product[]): number[] {
  return products.map((product) => product.price);
}

function idsOf(products: Product[]): string[] {
  return products.map((product) => product.id);
}

describe("getShopResults — defaults", () => {
  it("returns the first page of the whole catalogue when given no params", () => {
    const result = getShopResults({});

    expect(result.total).toBe(CATALOGUE_SIZE);
    expect(result.totalPages).toBe(TOTAL_PAGES);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(PER_PAGE);
    expect(result.query.sort).toBe(DEFAULT_SORT);
    expect(result.appliedFilters).toEqual([]);
  });

  it("reports a 1-based display range", () => {
    expect(getShopResults({})).toMatchObject({ rangeStart: 1, rangeEnd: PER_PAGE });
    expect(getShopResults({ page: "2" })).toMatchObject({
      rangeStart: PER_PAGE + 1,
      rangeEnd: PER_PAGE * 2,
    });
  });

  it("fills the last page with only the remainder", () => {
    const lastPage = getShopResults({ page: String(TOTAL_PAGES) });
    const expectedRemainder = CATALOGUE_SIZE - PER_PAGE * (TOTAL_PAGES - 1);

    expect(lastPage.items).toHaveLength(expectedRemainder);
    expect(lastPage.rangeEnd).toBe(CATALOGUE_SIZE);
  });

  it("paginates without dropping or repeating a product", () => {
    const everyItem = collectEveryPage({});

    expect(everyItem).toHaveLength(CATALOGUE_SIZE);
    expect(new Set(idsOf(everyItem)).size).toBe(CATALOGUE_SIZE);
  });
});

describe("price bands", () => {
  it("treats both bounds as inclusive", () => {
    const under999 = getPriceBand("under-999");
    const mid = getPriceBand("1000-4999");
    const premium = getPriceBand("5000-plus");

    expect(isPriceInBand(999, under999)).toBe(true);
    expect(isPriceInBand(1000, under999)).toBe(false);

    expect(isPriceInBand(999, mid)).toBe(false);
    expect(isPriceInBand(1000, mid)).toBe(true);
    expect(isPriceInBand(4999, mid)).toBe(true);
    expect(isPriceInBand(5000, mid)).toBe(false);

    expect(isPriceInBand(4999, premium)).toBe(false);
    expect(isPriceInBand(5000, premium)).toBe(true);
  });

  it("is unbounded above in the premium band", () => {
    expect(isPriceInBand(Number.MAX_SAFE_INTEGER, getPriceBand("5000-plus"))).toBe(true);
  });

  it("keeps every returned product inside the requested band", () => {
    for (const band of PRICE_BANDS) {
      const everyItem = collectEveryPage({ price: band.slug });

      expect(everyItem.length).toBeGreaterThan(0);
      for (const product of everyItem) {
        expect(isPriceInBand(product.price, band)).toBe(true);
      }
    }
  });

  it("partitions the catalogue — the three bands are disjoint and exhaustive", () => {
    const totals = PRICE_BANDS.map((band) => getShopResults({ price: band.slug }).total);
    expect(totals.reduce((sum, total) => sum + total, 0)).toBe(CATALOGUE_SIZE);
  });

  it("ORs multiple bands together", () => {
    const combined = getShopResults({ price: "under-999,5000-plus" }).total;
    const under = getShopResults({ price: "under-999" }).total;
    const premium = getShopResults({ price: "5000-plus" }).total;

    expect(combined).toBe(under + premium);
  });
});

describe("sorting", () => {
  it("orders price-asc non-decreasing across every page", () => {
    const prices = pricesOf(collectEveryPage({ sort: "price-asc" }));
    expect(prices).toEqual([...prices].sort((left, right) => left - right));
  });

  it("orders price-desc non-increasing across every page", () => {
    const prices = pricesOf(collectEveryPage({ sort: "price-desc" }));
    expect(prices).toEqual([...prices].sort((left, right) => right - left));
  });

  it("orders rating-desc non-increasing across every page", () => {
    const ratings = collectEveryPage({ sort: "rating-desc" }).map(
      (product) => product.rating,
    );
    expect(ratings).toEqual([...ratings].sort((left, right) => right - left));
  });

  it("puts new arrivals first under the default sort", () => {
    const everyItem = collectEveryPage({ sort: "newest" });
    const newCount = everyItem.filter((product) => product.isNew).length;

    expect(newCount).toBeGreaterThan(0);
    expect(everyItem.slice(0, newCount).every((product) => product.isNew)).toBe(true);
    expect(everyItem.slice(newCount).some((product) => product.isNew)).toBe(false);
  });

  it("breaks price ties on id, so tied products keep a stable order", () => {
    const everyItem = collectEveryPage({ sort: "price-asc" });
    const tiedPrice = pricesOf(everyItem).find(
      (price, _index, prices) => prices.filter((other) => other === price).length > 1,
    );

    expect(tiedPrice).toBeDefined();
    const tied = everyItem.filter((product) => product.price === tiedPrice);

    expect(tied.length).toBeGreaterThan(1);
    expect(idsOf(tied)).toEqual([...idsOf(tied)].sort());
  });

  it("breaks rating ties on reviewCount, then id", () => {
    const everyItem = collectEveryPage({ sort: "rating-desc" });

    for (let index = 1; index < everyItem.length; index += 1) {
      const previous = everyItem[index - 1];
      const current = everyItem[index];
      if (previous.rating !== current.rating) continue;

      if (previous.reviewCount === current.reviewCount) {
        expect(previous.id.localeCompare(current.id)).toBeLessThan(0);
      } else {
        expect(previous.reviewCount).toBeGreaterThan(current.reviewCount);
      }
    }
  });

  it("returns the same products under every sort, only reordered", () => {
    const baseline = idsOf(collectEveryPage({})).sort();

    for (const option of SORT_OPTIONS) {
      expect(idsOf(collectEveryPage({ sort: option.slug })).sort()).toEqual(baseline);
    }
  });
});

describe("filter combinations", () => {
  it("ANDs category with price band", () => {
    const result = getShopResults({ category: "necklaces", price: "5000-plus" });
    const everyItem = collectEveryPage({ category: "necklaces", price: "5000-plus" });

    expect(result.total).toBeGreaterThan(0);
    for (const product of everyItem) {
      expect(product.category).toBe("necklaces");
      expect(product.price).toBeGreaterThanOrEqual(5000);
    }
  });

  it("ORs multiple categories", () => {
    const combined = getShopResults({ category: "necklaces,earrings" }).total;
    const necklaces = getShopResults({ category: "necklaces" }).total;
    const earrings = getShopResults({ category: "earrings" }).total;

    expect(combined).toBe(necklaces + earrings);
  });

  it("accepts repeated params as well as the comma-separated form", () => {
    const repeated = getShopResults({ category: ["necklaces", "earrings"] }).total;
    const commaSeparated = getShopResults({ category: "necklaces,earrings" }).total;

    expect(repeated).toBe(commaSeparated);
  });

  it("returns an empty result set without crashing when nothing matches", () => {
    const result = getShopResults({ category: "anklets", price: "5000-plus" });

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
    expect(result.rangeStart).toBe(0);
    expect(result.rangeEnd).toBe(0);
  });

  it("reports applied filters with display labels", () => {
    const result = getShopResults({ category: "nose-pins", price: "under-999" });

    expect(result.appliedFilters).toEqual([
      { kind: "category", slug: "nose-pins", label: "Nose Pins" },
      { kind: "price", slug: "under-999", label: "Under ₹999" },
    ]);
  });
});

describe("invalid input is ignored, never fatal", () => {
  it("drops an unknown category", () => {
    expect(getShopResults({ category: "tiaras" }).total).toBe(CATALOGUE_SIZE);
    expect(getShopResults({ category: "tiaras" }).appliedFilters).toEqual([]);
  });

  it("keeps the valid half of a mixed category list", () => {
    const result = getShopResults({ category: "tiaras,rings" });

    expect(result.query.categories).toEqual(["rings"]);
    expect(result.total).toBe(getShopResults({ category: "rings" }).total);
  });

  it("drops an unknown price band", () => {
    expect(getShopResults({ price: "free" }).total).toBe(CATALOGUE_SIZE);
  });

  it("falls back to the default sort for an unknown sort", () => {
    expect(getShopResults({ sort: "cheapest" }).query.sort).toBe(DEFAULT_SORT);
    expect(idsOf(getShopResults({ sort: "cheapest" }).items)).toEqual(
      idsOf(getShopResults({}).items),
    );
  });

  it("is forgiving about case and whitespace", () => {
    const result = getShopResults({ category: " Necklaces , EARRINGS " });
    expect(result.query.categories).toEqual(["necklaces", "earrings"]);
  });

  it("ignores an empty-string param", () => {
    expect(getShopResults({ category: "", price: "", sort: "" }).total).toBe(
      CATALOGUE_SIZE,
    );
  });
});

describe("page clamping", () => {
  const cases: { label: string; page: string; expected: number }[] = [
    { label: "page=0", page: "0", expected: 1 },
    { label: "page=-1", page: "-1", expected: 1 },
    { label: "non-numeric", page: "abc", expected: 1 },
    { label: "empty string", page: "", expected: 1 },
    { label: "fractional", page: "2.7", expected: 2 },
    { label: "beyond the last page", page: "9999", expected: TOTAL_PAGES },
  ];

  for (const testCase of cases) {
    it(`clamps ${testCase.label} to page ${testCase.expected}`, () => {
      const result = getShopResults({ page: testCase.page });
      expect(result.page).toBe(testCase.expected);
      expect(result.items.length).toBeGreaterThan(0);
    });
  }

  it("clamps to page 1 when the filtered set is empty", () => {
    const result = getShopResults({
      category: "anklets",
      price: "5000-plus",
      page: "9999",
    });
    expect(result.page).toBe(1);
    expect(result.items).toEqual([]);
  });

  it("echoes the clamped page back on the query", () => {
    expect(getShopResults({ page: "9999" }).query.page).toBe(TOTAL_PAGES);
  });
});

describe("purity", () => {
  it("does not mutate the underlying catalogue order", () => {
    const before = idsOf(getAllProducts());
    getShopResults({ sort: "price-desc" });
    getShopResults({ sort: "rating-desc", category: "rings" });

    expect(idsOf(getAllProducts())).toEqual(before);
  });

  it("returns identical results for identical params", () => {
    const params: ShopSearchParams = { category: "rings", sort: "price-asc", page: "2" };
    expect(getShopResults(params)).toEqual(getShopResults(params));
  });
});

describe("parseShopQuery", () => {
  it("normalises selection order to the constant tables, not the URL order", () => {
    expect(parseShopQuery({ category: "rings,earrings" }).categories).toEqual([
      "earrings",
      "rings",
    ]);
    expect(parseShopQuery({ price: "5000-plus,under-999" }).priceBands).toEqual([
      "under-999",
      "5000-plus",
    ]);
  });

  it("de-duplicates repeated values", () => {
    expect(parseShopQuery({ category: "rings,rings" }).categories).toEqual(["rings"]);
  });
});

describe("buildShopHref", () => {
  it("omits every default", () => {
    expect(buildShopHref(emptyShopQuery())).toBe("/shop");
  });

  it("emits params in a canonical order", () => {
    const query = {
      categories: ["earrings", "rings"],
      priceBands: ["under-999"],
      sort: "price-asc",
      page: 3,
    } as const;

    expect(buildShopHref({ ...query, categories: [...query.categories], priceBands: [...query.priceBands] })).toBe(
      "/shop?category=earrings,rings&price=under-999&sort=price-asc&page=3",
    );
  });

  it("round-trips through parseShopQuery", () => {
    const query = parseShopQuery({
      category: "rings,earrings",
      price: "1000-4999",
      sort: "price-desc",
      page: "4",
    });

    expect(parseShopQuery(hrefToParams(buildShopHref(query)))).toEqual(query);
  });
});

function hrefToParams(href: string): ShopSearchParams {
  const search = new URLSearchParams(href.split("?")[1] ?? "");
  return {
    category: search.get("category") ?? undefined,
    price: search.get("price") ?? undefined,
    sort: search.get("sort") ?? undefined,
    page: search.get("page") ?? undefined,
  };
}

describe("query mutators reset pagination", () => {
  const startingQuery = parseShopQuery({ category: "rings", sort: "price-asc", page: "5" });

  it("resets to page 1 when a category is toggled", () => {
    expect(toggleCategory(startingQuery, "earrings").page).toBe(1);
  });

  it("resets to page 1 when a price band is toggled", () => {
    expect(togglePriceBand(startingQuery, "under-999").page).toBe(1);
  });

  it("resets to page 1 when the sort changes", () => {
    expect(withSort(startingQuery, "rating-desc" as SortSlug).page).toBe(1);
  });

  it("keeps the page when only the page changes", () => {
    const paged = withPage(startingQuery, 3);
    expect(paged.page).toBe(3);
    expect(paged.categories).toEqual(startingQuery.categories);
    expect(paged.sort).toBe(startingQuery.sort);
  });

  it("toggling an active category removes it", () => {
    expect(toggleCategory(startingQuery, "rings").categories).toEqual([]);
  });

  it("preserves the other facet when one is toggled", () => {
    const withBand = togglePriceBand(startingQuery, "under-999");
    expect(withBand.categories).toEqual(["rings"]);
    expect(withBand.sort).toBe("price-asc");
  });
});

describe("buildPaginationRange", () => {
  it("lists every page when there are few enough", () => {
    expect(buildPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPaginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("elides the middle when there are many", () => {
    expect(buildPaginationRange(1, 20)).toEqual([1, 2, "ellipsis", 20]);
    expect(buildPaginationRange(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
    expect(buildPaginationRange(20, 20)).toEqual([1, "ellipsis", 19, 20]);
  });

  it("always includes the current page", () => {
    for (let page = 1; page <= 20; page += 1) {
      expect(buildPaginationRange(page, 20)).toContain(page);
    }
  });

  it("never emits two ellipses in a row or a duplicate page", () => {
    for (let page = 1; page <= 20; page += 1) {
      const slots = buildPaginationRange(page, 20);
      const pages = slots.filter((slot): slot is number => slot !== "ellipsis");

      expect(new Set(pages).size).toBe(pages.length);
      for (let index = 1; index < slots.length; index += 1) {
        expect(slots[index] === "ellipsis" && slots[index - 1] === "ellipsis").toBe(false);
      }
    }
  });

  it("handles a single page", () => {
    expect(buildPaginationRange(1, 1)).toEqual([1]);
  });
});
