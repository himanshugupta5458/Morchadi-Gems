import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_SLUGS,
  SURFACED_CATEGORY_SLUGS,
  COLLECTIONS,
  COLLECTION_SLUGS,
  COLLECTION_TAGS,
  getCategoryLabel,
  getCollection,
  getCollectionLabel,
  isCategory,
  isCollectionFilterSlug,
  isCollectionTag,
  type CollectionSlug,
  type Product,
} from "@/types/product";
import { getAllProducts } from "@/lib/products";
import {
  CATEGORY_MENU,
  COLLECTION_MENU,
  NAV_MENUS,
  buildCategoryHref,
  buildCategoryImageSrc,
  buildCollectionHref,
} from "@/lib/navigation";

/**
 * Eleven slugs a product record may carry; ten of them reachable by a shopper. The two numbers
 * differ because `gift-hampers` was agreed before its products exist — see
 * [ADR-055](../docs/decisions/ADR-055-category-vocabulary-and-surfacing.md) and
 * `lib/category-vocabulary.test.ts`, which owns that split in full.
 */
const EXPECTED_CATEGORY_COUNT = 11;
const EXPECTED_SURFACED_CATEGORY_COUNT = 10;
const EXPECTED_COLLECTION_COUNT = 4;

describe("the category tier", () => {
  it("holds eleven categories with unique slugs and labels", () => {
    expect(CATEGORIES).toHaveLength(EXPECTED_CATEGORY_COUNT);
    expect(new Set(CATEGORY_SLUGS).size).toBe(EXPECTED_CATEGORY_COUNT);
    expect(new Set(CATEGORIES.map((category) => category.label)).size).toBe(
      EXPECTED_CATEGORY_COUNT,
    );
  });

  it("carries the two new categories with their labels", () => {
    expect(getCategoryLabel("watches")).toBe("Watches");
    expect(getCategoryLabel("hair-accessories")).toBe("Hair Accessories");
  });

  it("accepts all ten slugs through the guard and rejects anything else", () => {
    for (const slug of CATEGORY_SLUGS) expect(isCategory(slug)).toBe(true);
    expect(isCategory("nath")).toBe(false);
    expect(isCategory("")).toBe(false);
  });

  it("gives every product exactly one known category", () => {
    for (const product of getAllProducts()) {
      expect(isCategory(product.category)).toBe(true);
    }
  });
});

describe("the collection tier", () => {
  it("holds four collections, two of them hand-tagged", () => {
    expect(COLLECTIONS).toHaveLength(EXPECTED_COLLECTION_COUNT);
    expect(COLLECTION_TAGS).toEqual(["gifting", "anti-tarnish"]);
  });

  it("populates each collection from exactly one named source", () => {
    expect(
      COLLECTIONS.map((collection) => [collection.slug, collection.source.kind]),
    ).toEqual([
      ["gifting", "tag"],
      ["anti-tarnish", "tag"],
      ["best-sellers", "featured-flag"],
      ["new-arrivals", "new-flag"],
    ]);
  });

  it("separates the tag guard from the tier guard", () => {
    expect(isCollectionTag("gifting")).toBe(true);
    expect(isCollectionTag("best-sellers")).toBe(false);
    expect(isCollectionFilterSlug("best-sellers")).toBe(true);
    expect(isCollectionFilterSlug("wedding-season")).toBe(false);
  });

  it("labels every collection and raises on an unknown one", () => {
    expect(getCollectionLabel("anti-tarnish")).toBe("Anti-Tarnish");
    expect(getCollection("new-arrivals").label).toBe("New Arrivals");
    expect(() => getCollection("wedding-season" as never)).toThrow();
  });

  it("carries only known tags on the products that are tagged", () => {
    for (const product of getAllProducts()) {
      const tags = product.collections ?? [];

      for (const tag of tags) expect(isCollectionTag(tag)).toBe(true);
      expect(new Set(tags).size).toBe(tags.length);
    }
  });

  /**
   * `gifting` was deliberately untagged from ADR-021 until 2026-08-24 — nothing in the
   * hand-written range was sold as giftable, and inventing the tag to fill the facet would be
   * the one thing a tag is not for. The Draft A pilot batch (P106–P122) ended that state
   * honestly: their owner-reviewed drafts carried `suggestedCollections: ["gifting"]` off the
   * source listing's own "gifting" occasion, and the tag published with them. Both hand-tagged
   * collections now resolve to populated listings, and every gifting member so far is a
   * migrated record — a hand-written product tagged gifting would be a new owner decision, not
   * a regression, but it should not appear by accident.
   */
  it("populates both hand-tagged collections, gifting since the pilot batch published", () => {
    const membersOf = (tag: CollectionSlug): Product[] =>
      getAllProducts().filter((product) => (product.collections ?? []).includes(tag));

    expect(membersOf("anti-tarnish").length).toBeGreaterThan(0);
    expect(membersOf("gifting").length).toBeGreaterThan(0);
    expect(
      membersOf("gifting").every((product) => product.migrationProvenance !== undefined),
    ).toBe(true);
    expect(COLLECTION_TAGS).toContain("gifting");
  });
});

describe("the two nav dropdowns", () => {
  it("is exactly two menus, categories then collections", () => {
    expect(NAV_MENUS.map((menu) => menu.label)).toEqual([
      "Shop by Category",
      "Collections",
    ]);
  });

  it("lists every surfaced category, each linking to its shop filter", () => {
    expect(CATEGORY_MENU.items).toHaveLength(EXPECTED_SURFACED_CATEGORY_COUNT);
    expect(CATEGORY_MENU.items.map((item) => item.href)).toEqual(
      SURFACED_CATEGORY_SLUGS.map(buildCategoryHref),
    );
    expect(buildCategoryHref("watches")).toBe("/shop?category=watches");
  });

  it("lists all four collections, each linking to its shop filter", () => {
    expect(COLLECTION_MENU.items).toHaveLength(EXPECTED_COLLECTION_COUNT);
    expect(COLLECTION_MENU.items.map((item) => item.href)).toEqual(
      COLLECTION_SLUGS.map(buildCollectionHref),
    );
    expect(buildCollectionHref("anti-tarnish")).toBe("/shop?collection=anti-tarnish");
  });

  it("keeps every nav href on a single param the shop can parse back", () => {
    for (const menu of NAV_MENUS) {
      for (const item of menu.items) {
        expect(item.href.startsWith("/shop?")).toBe(true);
        expect(item.href.split("&")).toHaveLength(1);
      }
    }
  });

  it("derives a category image path per ADR-006, including the new two", () => {
    expect(buildCategoryImageSrc("watches")).toBe("/categories/watches.webp");
    expect(buildCategoryImageSrc("hair-accessories")).toBe(
      "/categories/hair-accessories.webp",
    );
  });
});
