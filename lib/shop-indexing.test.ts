import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/shop/page";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildCanonicalShopHref,
  buildShopHref,
  emptyShopQuery,
  getShopResults,
  parseShopQuery,
  toggleCategory,
  withPage,
  withSort,
  type ShopSearchParams,
} from "@/lib/shop";

const PRODUCTION_ORIGIN = "https://www.morchadigems.com";

const previousAppBaseUrl = process.env.APP_BASE_URL;

beforeEach(() => {
  process.env.APP_BASE_URL = PRODUCTION_ORIGIN;
});

afterEach(() => {
  if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = previousAppBaseUrl;
});

/**
 * `gifting` is a real collection with no product tagged into it, so it is the facet a shopper
 * can genuinely reach and find nothing behind. If a product is ever tagged, this stops being
 * empty and the tests below should be pointed at whatever combination is empty then.
 */
const EMPTY_FACET: ShopSearchParams = { collection: "gifting" };

function metadataFor(params: ShopSearchParams): ReturnType<typeof generateMetadata> {
  return generateMetadata({ searchParams: { ...params } });
}

describe("the canonical url of a listing", () => {
  it("drops a non-default sort, because sorting reorders a set rather than changing it", () => {
    const sorted = withSort(emptyShopQuery(), "price-asc");

    expect(buildShopHref(sorted)).toBe("/shop?sort=price-asc");
    expect(buildCanonicalShopHref(sorted)).toBe("/shop");
  });

  it("drops the sort while keeping every filter that selects different products", () => {
    const query = withPage(
      withSort(toggleCategory(emptyShopQuery(), "rings"), "price-desc"),
      2,
    );

    expect(buildCanonicalShopHref(query)).toBe("/shop?category=rings&page=2");
  });

  it("leaves a default-sorted url exactly as it was", () => {
    for (const params of [{}, { category: "rings" }, { price: "under-999" }]) {
      const query = parseShopQuery(params);
      expect(buildCanonicalShopHref(query)).toBe(buildShopHref(query));
    }
  });

  it("collapses every sort of one filter state onto a single canonical url", () => {
    const canonicals = SORT_OPTIONS.map((option) =>
      buildCanonicalShopHref(parseShopQuery({ category: "rings", sort: option.slug })),
    );

    expect(new Set(canonicals).size).toBe(1);
    expect(canonicals[0]).toBe("/shop?category=rings");
  });

  it("is what the page declares as its canonical, not the url it was reached by", () => {
    const metadata = metadataFor({ category: "rings", sort: "price-asc" });

    expect(metadata.alternates?.canonical).toBe("/shop?category=rings");
    expect(metadata.openGraph?.url).toBe("/shop?category=rings");
  });
});

describe("a facet that matches nothing", () => {
  it("is genuinely empty, so the rest of these tests mean something", () => {
    expect(getShopResults(EMPTY_FACET).total).toBe(0);
  });

  it("is noindexed rather than left as a thin page in the index", () => {
    expect(metadataFor(EMPTY_FACET).robots).toEqual({ index: false, follow: true });
  });

  it("stays followable, so the links out of it are still crawled", () => {
    const { robots } = metadataFor(EMPTY_FACET);

    expect(robots).toHaveProperty("follow", true);
  });

  it("still renders for a shopper, with a title and a description of its own", () => {
    const metadata = metadataFor(EMPTY_FACET);

    expect(metadata.title).toBe("Gifting");
    expect(metadata.description).toContain("gifting");
  });
});

describe("a facet that matches products", () => {
  it("carries no robots directive at all, so it indexes normally", () => {
    for (const params of [{}, { category: "rings" }, { sort: DEFAULT_SORT }]) {
      expect(metadataFor(params).robots).toBeUndefined();
    }
  });

  it("is indexable even on a later page, which is a real slice of the catalogue", () => {
    expect(metadataFor({ page: "2" }).robots).toBeUndefined();
  });
});
