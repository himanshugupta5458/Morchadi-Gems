import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import { getAllProducts } from "@/lib/products";
import {
  MIN_SEARCH_TERM_LENGTH,
  SEARCH_SUGGESTION_LIMIT,
  isSearchableTerm,
  matchesSearchTerm,
  searchProducts,
  toSearchTokens,
} from "@/lib/product-search";
import {
  buildShopHref,
  emptyShopQuery,
  getShopResults,
  hasSearchTerm,
  parseShopQuery,
  withSearch,
  withoutSearch,
} from "@/lib/shop";

/**
 * Four fixtures rather than the real catalogue, so the ranking can be asserted exactly. The
 * catalogue is used further down for the two claims that are about the catalogue itself.
 */
function fixture(id: string, name: string, category: Product["category"]): Product {
  return {
    id,
    name,
    category,
    status: "active",
    pricing: { price: 299, mrp: 499, cost: 120, minPrepaidAmount: 0 },
    media: { images: [`/products/${id}.webp`] },
    specs: {},
    description: "",
    seo: {
      primaryKeyword: id,
      secondaryKeywords: [],
      metaTitle: name,
      metaDescription: name,
      imageAlt: name,
      ogTitle: name,
      ogDescription: name,
      ogImage: `/products/${id}.webp`,
    },
    stock: { inStock: true, quantity: 5 },
    flags: { featured: false, isNew: false, badge: null },
  };
}

const STAR_RING = fixture("P1", "Star Solitaire Ring", "rings");
const MIDNIGHT_RING = fixture("P2", "Midnight Star Band", "rings");
const STARLIGHT_ANKLET = fixture("P3", "Starlight Anklet", "anklets");
const PLAIN_WATCH = fixture("P4", "Rose Dial Watch", "watches");

const FIXTURES = [PLAIN_WATCH, MIDNIGHT_RING, STARLIGHT_ANKLET, STAR_RING];

describe("what counts as something worth searching for", () => {
  it("ignores a term shorter than the minimum", () => {
    expect(isSearchableTerm("r")).toBe(false);
    expect(isSearchableTerm("ri")).toBe(true);
    expect(MIN_SEARCH_TERM_LENGTH).toBe(2);
  });

  it("ignores surrounding whitespace when deciding", () => {
    expect(isSearchableTerm("   r   ")).toBe(false);
    expect(isSearchableTerm("  ring ")).toBe(true);
  });

  it("splits a phrase into one requirement per word", () => {
    expect(toSearchTokens("  Star   RING ")).toEqual(["star", "ring"]);
    expect(toSearchTokens("   ")).toEqual([]);
  });
});

describe("searchProducts", () => {
  it("finds nothing for a term below the minimum, rather than everything", () => {
    expect(searchProducts(FIXTURES, "r")).toEqual({ hits: [], total: 0 });
  });

  it("matches on the product name, whatever the case", () => {
    const { hits } = searchProducts(FIXTURES, "STARLIGHT");

    expect(hits.map((hit) => hit.id)).toEqual([STARLIGHT_ANKLET.id]);
  });

  it("matches on the category's display label, not only on the name", () => {
    const { hits } = searchProducts(FIXTURES, "watch");

    expect(hits.map((hit) => hit.id)).toEqual([PLAIN_WATCH.id]);
  });

  /**
   * AND across words. "star anklet" must not return every piece matching either word, which is
   * what an OR would do and what would make a two-word search useless.
   */
  it("requires every word, so a second word narrows rather than widens", () => {
    const eitherWord = searchProducts(FIXTURES, "star");

    const bothWords = searchProducts(FIXTURES, "star anklet");

    expect(eitherWord.total).toBe(3);
    expect(bothWords.total).toBe(1);
    expect(bothWords.hits[0].id).toBe(STARLIGHT_ANKLET.id);
  });

  /**
   * The second word may be satisfied by the category rather than by the name, which is what
   * makes "star ring" find a piece called "Midnight Star Band" filed under Rings.
   */
  it("lets either half of the haystack satisfy a word", () => {
    const { hits } = searchProducts(FIXTURES, "star ring");

    expect(hits.map((hit) => hit.id)).toEqual([STAR_RING.id, MIDNIGHT_RING.id]);
  });

  it("ranks a name that starts with the term above one that merely contains it", () => {
    const { hits } = searchProducts(FIXTURES, "star");

    expect(hits.map((hit) => hit.id)).toEqual([
      STAR_RING.id,
      STARLIGHT_ANKLET.id,
      MIDNIGHT_RING.id,
    ]);
  });

  it("ranks a word starting with the term above a match inside a word", () => {
    const { hits } = searchProducts([MIDNIGHT_RING, STARLIGHT_ANKLET], "star");

    expect(hits.map((hit) => hit.id)).toEqual([STARLIGHT_ANKLET.id, MIDNIGHT_RING.id]);
  });

  it("carries the six fields a suggestion row renders and nothing else", () => {
    const [hit] = searchProducts(FIXTURES, "solitaire").hits;

    expect(Object.keys(hit).sort()).toEqual([
      "categoryLabel",
      "id",
      "image",
      "mrp",
      "name",
      "price",
    ]);
    expect(hit.categoryLabel).toBe("Rings");
  });

  it("counts every match while returning only as many as the dropdown holds", () => {
    const many = Array.from({ length: 20 }, (_unused, index) =>
      fixture(`P${index + 10}`, `Star Piece ${index}`, "rings"),
    );

    const { hits, total } = searchProducts(many, "star", SEARCH_SUGGESTION_LIMIT);

    expect(total).toBe(20);
    expect(hits).toHaveLength(SEARCH_SUGGESTION_LIMIT);
  });

  it("treats a regex metacharacter as text rather than as a pattern", () => {
    expect(() => searchProducts(FIXTURES, "ring (")).not.toThrow();
    expect(searchProducts(FIXTURES, "ring (").total).toBe(0);
  });
});

describe("matchesSearchTerm, which is what /shop?q= filters with", () => {
  it("keeps everything when no term was typed", () => {
    expect(FIXTURES.every((product) => matchesSearchTerm(product, ""))).toBe(true);
  });

  /**
   * The property that makes "see all results" honest: the listing behind the link is drawn from
   * the same predicate the suggestions were ranked over, so nothing in the dropdown is missing
   * from the page it points at.
   */
  it("agrees with the dropdown about which products match", () => {
    const catalogue = getAllProducts();
    const term = "anklet";

    const suggested = searchProducts(catalogue, term, Number.POSITIVE_INFINITY);
    const listed = catalogue.filter((product) => matchesSearchTerm(product, term));

    expect(suggested.total).toBe(listed.length);
    expect(suggested.hits.map((hit) => hit.id).sort()).toEqual(
      listed.map((product) => product.id).sort(),
    );
  });
});

describe("the shop listing's ?q= facet", () => {
  it("reads the term off the url and normalises the spacing", () => {
    expect(parseShopQuery({ q: "  star   ring " }).search).toBe("star ring");
    expect(parseShopQuery({}).search).toBe("");
  });

  it("caps how much typed text the page will echo back", () => {
    const overlong = "a".repeat(200);

    expect(parseShopQuery({ q: overlong }).search).toHaveLength(64);
  });

  it("carries the term in the url and drops it with the chip", () => {
    const searched = withSearch(emptyShopQuery(), "star");

    expect(buildShopHref(searched)).toBe("/shop?q=star");
    expect(hasSearchTerm(searched)).toBe(true);
    expect(buildShopHref(withoutSearch(searched))).toBe("/shop");
  });

  it("encodes a term that would otherwise break the query string", () => {
    expect(buildShopHref(withSearch(emptyShopQuery(), "rose & gold"))).toBe(
      "/shop?q=rose%20%26%20gold",
    );
  });

  it("narrows the listing rather than replacing it, so filters still apply", () => {
    const searchedOnly = getShopResults({ q: "ring" });
    const searchedAndFiltered = getShopResults({ q: "ring", category: "rings" });

    expect(searchedOnly.total).toBeGreaterThan(0);
    expect(searchedAndFiltered.total).toBeLessThanOrEqual(searchedOnly.total);
    expect(
      searchedAndFiltered.items.every((product) => product.category === "rings"),
    ).toBe(true);
  });

  it("offers the term as a chip that can be cleared on its own", () => {
    const { appliedFilters } = getShopResults({ q: "ring", category: "rings" });

    expect(appliedFilters[0]).toEqual({ kind: "search", label: "“ring”" });
    expect(appliedFilters.some((filter) => filter.kind === "category")).toBe(true);
  });

  it("resets to the first page when the term changes", () => {
    const onPageThree = { ...emptyShopQuery(), page: 3 };

    expect(withSearch(onPageThree, "star").page).toBe(1);
  });
});
