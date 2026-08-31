import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  COLLECTION_SLUGS,
  SURFACED_CATEGORY_SLUGS,
  type Product,
} from "@/types/product";
import { selectProductBadge } from "@/lib/product-badge";
import { getAllProducts } from "@/lib/products";
import {
  DEFAULT_SORT,
  PER_PAGE,
  PRICE_BANDS,
  SORT_OPTIONS,
  STATUS_FILTERS,
  buildPaginationRange,
  buildShopHref,
  countActiveFilters,
  emptyShopQuery,
  getPriceBand,
  getShopResults,
  isPriceInBand,
  isProductInCollection,
  isSortSlug,
  matchesShopQuery,
  parseShopQuery,
  toggleCategory,
  toggleCollection,
  togglePriceBand,
  withPage,
  withSort,
  type ShopQuery,
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
  return products.map((product) => product.pricing.price);
}

function idsOf(products: Product[]): string[] {
  return products.map((product) => product.id);
}

/**
 * Collection membership is being tested, and no product in the shipped catalogue carries a
 * tag yet — the products arrive in the next prompt. Fixtures let the pure matcher be driven
 * directly rather than waiting on data.
 */
function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: "fx-001",
    name: "Fixture Piece",
    category: "rings",
    status: "active",
    pricing: { price: 1499, mrp: 1999, cost: 899, minPrepaidAmount: 0 },
    media: { images: [] },
    specs: { material: "Brass" },
    description: "A fixture.",
    seo: {
      primaryKeyword: "fixture piece",
      secondaryKeywords: [],
      metaTitle: "Fixture Piece",
      metaDescription: "A fixture.",
      imageAlt: "A fixture.",
      ogTitle: "Fixture Piece",
      ogDescription: "A fixture.",
      ogImage: "",
    },
    stock: { inStock: true, quantity: 10 },
    flags: { featured: false, isNew: false, badge: null },
    ...overrides,
  };
}

function queryOf(params: ShopSearchParams): ShopQuery {
  return parseShopQuery(params);
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
    const under99 = getPriceBand("under-99");
    const above999 = getPriceBand("above-999");

    expect(isPriceInBand(99, under99)).toBe(true);
    expect(isPriceInBand(100, under99)).toBe(false);

    expect(isPriceInBand(999, above999)).toBe(false);
    expect(isPriceInBand(1000, above999)).toBe(true);
  });

  it("is unbounded above in the top band", () => {
    expect(isPriceInBand(Number.MAX_SAFE_INTEGER, getPriceBand("above-999"))).toBe(true);
  });

  it("keeps every returned product inside the requested band", () => {
    for (const band of PRICE_BANDS) {
      for (const product of collectEveryPage({ price: band.slug })) {
        expect(isPriceInBand(product.pricing.price, band)).toBe(true);
      }
    }
  });

  it("nests the four ceilings, each containing the one below it", () => {
    const ceilings = ["under-99", "under-299", "under-499", "under-999"] as const;
    const totals = ceilings.map((slug) => getShopResults({ price: slug }).total);

    expect(totals[0]).toBeGreaterThan(0);
    for (let index = 1; index < totals.length; index += 1) {
      expect(totals[index]).toBeGreaterThanOrEqual(totals[index - 1]);
    }
  });

  it("covers every price between the widest ceiling and the floor above it", () => {
    const under999 = getShopResults({ price: "under-999" }).total;
    const above999 = getShopResults({ price: "above-999" }).total;

    expect(under999 + above999).toBe(CATALOGUE_SIZE);
  });

  it("ORs multiple bands together, which for nested bands is the wider one", () => {
    const combined = getShopResults({ price: "under-99,above-999" }).total;
    const under = getShopResults({ price: "under-99" }).total;
    const above = getShopResults({ price: "above-999" }).total;

    expect(combined).toBe(under + above);
    expect(getShopResults({ price: "under-99,under-999" }).total).toBe(
      getShopResults({ price: "under-999" }).total,
    );
  });
});

describe("the custom price range", () => {
  it("applies a min and a max together", () => {
    const everyItem = collectEveryPage({ min: "200", max: "300" });

    expect(everyItem.length).toBeGreaterThan(0);
    for (const product of everyItem) {
      expect(product.pricing.price).toBeGreaterThanOrEqual(200);
      expect(product.pricing.price).toBeLessThanOrEqual(300);
    }
  });

  it("applies either bound on its own", () => {
    for (const product of collectEveryPage({ min: "500" })) {
      expect(product.pricing.price).toBeGreaterThanOrEqual(500);
    }
    for (const product of collectEveryPage({ max: "60" })) {
      expect(product.pricing.price).toBeLessThanOrEqual(60);
    }
  });

  it("ANDs with a ticked band rather than widening it", () => {
    const banded = getShopResults({ price: "under-99" }).total;
    const narrowed = getShopResults({ price: "under-99", min: "90" }).total;

    expect(narrowed).toBeLessThan(banded);
    expect(getShopResults({ price: "under-99", min: "5000" }).total).toBe(0);
  });

  it("ignores a bound that is not a number, and one below zero", () => {
    expect(getShopResults({ min: "abc" }).total).toBe(CATALOGUE_SIZE);
    expect(getShopResults({ max: "-5" }).total).toBe(CATALOGUE_SIZE);
  });

  it("drops an inverted range whole rather than rendering an impossible one", () => {
    const result = getShopResults({ min: "900", max: "100" });

    expect(result.total).toBe(CATALOGUE_SIZE);
    expect(result.query.priceRange).toEqual({ min: null, max: null });
    expect(result.appliedFilters).toEqual([]);
  });

  it("reports the range as one removable chip", () => {
    const { appliedFilters } = getShopResults({ min: "200", max: "300" });

    expect(appliedFilters).toEqual([{ kind: "price-range", label: "₹200 – ₹300" }]);
  });

  it("counts as one active filter however many bounds are set", () => {
    expect(countActiveFilters(queryOf({ min: "200" }))).toBe(1);
    expect(countActiveFilters(queryOf({ min: "200", max: "300" }))).toBe(1);
  });
});

describe("the status facet", () => {
  it("offers exactly the badges a card can render", () => {
    expect(STATUS_FILTERS.map((option) => option.slug)).toEqual([
      "sold-out",
      "low-stock",
      "trending",
      "bestseller",
      "new",
    ]);
  });

  it("lists exactly the products whose card shows that badge", () => {
    for (const option of STATUS_FILTERS) {
      for (const product of collectEveryPage({ status: option.slug })) {
        expect(selectProductBadge(product.stock, product.flags)?.kind).toBe(option.slug);
      }
    }
  });

  it("finds the sold-out products in the real catalogue", () => {
    const soldOut = collectEveryPage({ status: "sold-out" });

    expect(soldOut.length).toBe(
      getAllProducts().filter((product) => !product.stock.inStock).length,
    );
    expect(soldOut.length).toBeGreaterThan(0);
  });

  it("files a low-stock product under low stock even when it carries a manual badge", () => {
    const query = queryOf({ status: "trending" });
    const lowAndTrending = productFixture({
      stock: { inStock: true, quantity: 1 },
      flags: { featured: false, isNew: false, badge: "trending" },
    });

    expect(matchesShopQuery(lowAndTrending, query)).toBe(false);
    expect(matchesShopQuery(lowAndTrending, queryOf({ status: "low-stock" }))).toBe(true);
  });

  it("matches nothing for a product showing no badge at all", () => {
    const unbadged = productFixture({
      stock: { inStock: true, quantity: 10 },
      flags: { featured: false, isNew: false, badge: null },
    });

    for (const option of STATUS_FILTERS) {
      expect(matchesShopQuery(unbadged, queryOf({ status: option.slug }))).toBe(false);
    }
    expect(matchesShopQuery(unbadged, queryOf({}))).toBe(true);
  });

  it("ORs the selected statuses together", () => {
    const soldOut = getShopResults({ status: "sold-out" }).total;
    const isNew = getShopResults({ status: "new" }).total;

    expect(getShopResults({ status: "sold-out,new" }).total).toBe(soldOut + isNew);
  });

  it("drops an unknown status instead of matching nothing", () => {
    expect(getShopResults({ status: "backordered" }).total).toBe(CATALOGUE_SIZE);
  });

  it("reports an applied status filter with its display label", () => {
    expect(getShopResults({ status: "low-stock" }).appliedFilters).toEqual([
      { kind: "status", slug: "low-stock", label: "Only a few left" },
    ]);
  });
});

describe("category counts", () => {
  it("counts every surfaced category against the unfiltered catalogue", () => {
    const { categoryCounts } = getShopResults({});

    for (const slug of SURFACED_CATEGORY_SLUGS) {
      expect(categoryCounts[slug]).toBe(
        getAllProducts().filter((product) => product.category === slug).length,
      );
    }
  });

  it("sums to the catalogue when nothing is filtered", () => {
    const { categoryCounts } = getShopResults({});
    const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

    expect(total).toBe(CATALOGUE_SIZE);
  });

  it("narrows under another facet, so a count promises what ticking the box gives", () => {
    const { categoryCounts } = getShopResults({ price: "under-99" });

    for (const slug of SURFACED_CATEGORY_SLUGS) {
      expect(categoryCounts[slug]).toBe(
        getShopResults({ price: "under-99", category: slug }).total,
      );
    }
  });

  it("is unchanged by the category facet itself, so no count reads zero", () => {
    const unfiltered = getShopResults({}).categoryCounts;

    expect(getShopResults({ category: "rings" }).categoryCounts).toEqual(unfiltered);
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

  it("offers exactly four sorts, and no rating sort", () => {
    expect(SORT_OPTIONS.map((option) => option.slug)).toEqual([
      "price-asc",
      "price-desc",
      "name-asc",
      "name-desc",
    ]);
    expect(SORT_OPTIONS.map((option) => option.label)).toEqual([
      "Price: Low to High",
      "Price: High to Low",
      "A to Z",
      "Z to A",
    ]);
    expect(isSortSlug("rating-desc")).toBe(false);
  });

  it("no longer offers a newest sort", () => {
    expect(SORT_OPTIONS.map((option) => option.slug)).not.toContain("newest");
    expect(isSortSlug("newest")).toBe(false);
    expect(getShopResults({ sort: "newest" }).query.sort).toBe(DEFAULT_SORT);
  });

  it("falls back to the default sort when an unknown sort is asked for", () => {
    expect(getShopResults({ sort: "rating-desc" }).query.sort).toBe(DEFAULT_SORT);
  });

  it("defaults to A to Z", () => {
    expect(DEFAULT_SORT).toBe("name-asc");

    const names = collectEveryPage({}).map((product) => product.name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
  });

  it("orders name-desc as the exact reverse ordering of name-asc", () => {
    const names = collectEveryPage({ sort: "name-desc" }).map((product) => product.name);
    expect(names).toEqual([...names].sort((left, right) => right.localeCompare(left)));
  });

  it("breaks price ties on id, so tied products keep a stable order", () => {
    const everyItem = collectEveryPage({ sort: "price-asc" });
    const tiedPrice = pricesOf(everyItem).find(
      (price, _index, prices) => prices.filter((other) => other === price).length > 1,
    );

    expect(tiedPrice).toBeDefined();
    const tied = everyItem.filter((product) => product.pricing.price === tiedPrice);

    expect(tied.length).toBeGreaterThan(1);
    expect(idsOf(tied)).toEqual([...idsOf(tied)].sort());
  });

  it("breaks name ties on id, so products sharing a name keep a stable order", () => {
    const everyItem = collectEveryPage({ sort: "name-asc" });

    for (let index = 1; index < everyItem.length; index += 1) {
      const previous = everyItem[index - 1];
      const current = everyItem[index];
      if (previous.name !== current.name) continue;
      expect(previous.id.localeCompare(current.id)).toBeLessThan(0);
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
    const result = getShopResults({ category: "necklaces", price: "under-999" });
    const everyItem = collectEveryPage({ category: "necklaces", price: "under-999" });

    expect(result.total).toBeGreaterThan(0);
    for (const product of everyItem) {
      expect(product.category).toBe("necklaces");
      expect(product.pricing.price).toBeLessThanOrEqual(999);
    }
  });

  it("ANDs down to nothing when the two facets do not overlap", () => {
    const necklaces = getShopResults({ category: "necklaces" }).total;

    expect(necklaces).toBeGreaterThan(0);
    expect(getShopResults({ category: "necklaces", price: "above-999" }).total).toBe(0);
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
    const result = getShopResults({ category: "anklets", price: "above-999" });

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
      price: "above-999",
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
    getShopResults({ sort: "price-asc", category: "rings" });

    expect(idsOf(getAllProducts())).toEqual(before);
  });

  it("returns identical results for identical params", () => {
    const params: ShopSearchParams = { category: "rings", sort: "price-asc", page: "2" };
    expect(getShopResults(params)).toEqual(getShopResults(params));
  });
});

describe("collections", () => {
  const gift = productFixture({ id: "fx-gift", collections: ["gifting"] });
  const both = productFixture({
    id: "fx-both",
    collections: ["gifting", "anti-tarnish"],
  });
  const untagged = productFixture({ id: "fx-plain" });

  it("matches a product carrying the tag", () => {
    expect(matchesShopQuery(gift, queryOf({ collection: "gifting" }))).toBe(true);
  });

  it("does not match a product carrying no tags at all", () => {
    expect(matchesShopQuery(untagged, queryOf({ collection: "gifting" }))).toBe(false);
    expect(untagged.collections).toBeUndefined();
  });

  it("does not match a product tagged into a different collection", () => {
    expect(matchesShopQuery(gift, queryOf({ collection: "anti-tarnish" }))).toBe(false);
  });

  it("matches a product that is in several collections at once, from either", () => {
    expect(matchesShopQuery(both, queryOf({ collection: "gifting" }))).toBe(true);
    expect(matchesShopQuery(both, queryOf({ collection: "anti-tarnish" }))).toBe(true);
  });

  it("ORs the selected collections together", () => {
    const query = queryOf({ collection: "gifting,anti-tarnish" });

    expect(matchesShopQuery(gift, query)).toBe(true);
    expect(matchesShopQuery(both, query)).toBe(true);
    expect(matchesShopQuery(untagged, query)).toBe(false);
  });

  it("reads best-sellers off the featured flag, not a tag", () => {
    const featured = productFixture({
      id: "fx-featured",
      flags: { featured: true, isNew: false, badge: null },
    });

    expect(isProductInCollection(featured, "best-sellers")).toBe(true);
    expect(isProductInCollection(untagged, "best-sellers")).toBe(false);
    expect(featured.collections).toBeUndefined();
  });

  it("reads new-arrivals off the isNew flag, not a tag", () => {
    const fresh = productFixture({
      id: "fx-new",
      flags: { featured: false, isNew: true, badge: null },
    });

    expect(isProductInCollection(fresh, "new-arrivals")).toBe(true);
    expect(isProductInCollection(untagged, "new-arrivals")).toBe(false);
  });

  it("no longer accepts a price band as a collection", () => {
    expect(COLLECTION_SLUGS).not.toContain("under-999");
    expect(queryOf({ collection: "under-999" }).collections).toEqual([]);
  });

  it("ANDs collection with category", () => {
    const query = queryOf({ collection: "gifting", category: "rings" });
    const giftedRing = productFixture({
      id: "fx-ring",
      category: "rings",
      collections: ["gifting"],
    });
    const giftedEarring = productFixture({
      id: "fx-earring",
      category: "earrings",
      collections: ["gifting"],
    });
    const plainRing = productFixture({ id: "fx-plain-ring", category: "rings" });

    expect(matchesShopQuery(giftedRing, query)).toBe(true);
    expect(matchesShopQuery(giftedEarring, query)).toBe(false);
    expect(matchesShopQuery(plainRing, query)).toBe(false);
  });

  it("ANDs collection with price band", () => {
    const query = queryOf({ collection: "gifting", price: "under-499" });

    expect(
      matchesShopQuery(
        productFixture({
          pricing: { price: 499, mrp: 799, cost: 299, minPrepaidAmount: 0 },
          collections: ["gifting"],
        }),
        query,
      ),
    ).toBe(true);
    expect(
      matchesShopQuery(
        productFixture({
          pricing: { price: 4999, mrp: 5999, cost: 2999, minPrepaidAmount: 0 },
          collections: ["gifting"],
        }),
        query,
      ),
    ).toBe(false);
  });

  it("drops an unknown collection instead of matching nothing", () => {
    const query = queryOf({ collection: "wedding-season" });

    expect(query.collections).toEqual([]);
    expect(matchesShopQuery(untagged, query)).toBe(true);
  });

  it("keeps the valid half of a mixed collection list", () => {
    expect(queryOf({ collection: "wedding-season,gifting" }).collections).toEqual([
      "gifting",
    ]);
  });

  it("normalises selection order to COLLECTIONS, not the URL order", () => {
    expect(
      queryOf({ collection: "new-arrivals,gifting,best-sellers" }).collections,
    ).toEqual(["gifting", "best-sellers", "new-arrivals"]);
  });

  it("filters the real catalogue through the derived collections", () => {
    const bestSellers = getShopResults({ collection: "best-sellers" });
    const newArrivals = getShopResults({ collection: "new-arrivals" });

    expect(bestSellers.total).toBe(
      getAllProducts().filter((product) => product.flags.featured).length,
    );
    expect(newArrivals.total).toBe(
      getAllProducts().filter((product) => product.flags.isNew).length,
    );
  });

  it("reports an applied collection filter with its display label", () => {
    const { appliedFilters } = getShopResults({ collection: "anti-tarnish" });

    expect(appliedFilters).toEqual([
      { kind: "collection", slug: "anti-tarnish", label: "Anti-Tarnish" },
    ]);
  });

  it("resets to page 1 when a collection is toggled, keeping the other facets", () => {
    const startingQuery = parseShopQuery({ category: "rings", page: "4" });
    const toggled = toggleCollection(startingQuery, "gifting");

    expect(toggled.page).toBe(1);
    expect(toggled.collections).toEqual(["gifting"]);
    expect(toggled.categories).toEqual(["rings"]);
    expect(toggleCollection(toggled, "gifting").collections).toEqual([]);
  });

  it("counts collections among the active filters", () => {
    expect(
      countActiveFilters(
        parseShopQuery({ category: "rings", collection: "gifting,best-sellers" }),
      ),
    ).toBe(3);
  });

  it("every collection in COLLECTIONS is a slug the parser accepts", () => {
    for (const collection of COLLECTIONS) {
      expect(queryOf({ collection: collection.slug }).collections).toEqual([
        collection.slug,
      ]);
    }
  });
});

describe("parseShopQuery", () => {
  it("normalises selection order to the constant tables, not the URL order", () => {
    expect(parseShopQuery({ category: "rings,earrings" }).categories).toEqual([
      "earrings",
      "rings",
    ]);
    expect(parseShopQuery({ price: "above-999,under-99" }).priceBands).toEqual([
      "under-99",
      "above-999",
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
    const query: ShopQuery = {
      search: "star",
      categories: ["earrings", "rings"],
      collections: ["gifting"],
      statuses: ["low-stock"],
      priceBands: ["under-999"],
      priceRange: { min: 200, max: 300 },
      sort: "price-asc",
      page: 3,
    };

    expect(buildShopHref(query)).toBe(
      "/shop?q=star&category=earrings,rings&collection=gifting&status=low-stock&price=under-999&min=200&max=300&sort=price-asc&page=3",
    );
  });

  it("round-trips through parseShopQuery", () => {
    const query = parseShopQuery({
      category: "rings,earrings",
      collection: "anti-tarnish,gifting",
      status: "new,trending",
      price: "under-299",
      min: "150",
      max: "400",
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
    collection: search.get("collection") ?? undefined,
    status: search.get("status") ?? undefined,
    price: search.get("price") ?? undefined,
    min: search.get("min") ?? undefined,
    max: search.get("max") ?? undefined,
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
    expect(withSort(startingQuery, "price-desc" as SortSlug).page).toBe(1);
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
