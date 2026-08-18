import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_SLUGS,
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

const EXPECTED_CATEGORY_COUNT = 10;
const EXPECTED_COLLECTION_COUNT = 4;

describe("the category tier", () => {
  it("holds ten categories with unique slugs and labels", () => {
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
   * `gifting` is deliberately untagged as of ADR-021 — nothing in the owner's range is sold
   * as a gift set, and inventing the tag to fill the facet would be the one thing a tag is
   * not for. Its nav link and facet checkbox therefore resolve to an empty listing until a
   * gift set is stocked. This pins that as a known state rather than letting it pass as an
   * oversight.
   */
  it("populates anti-tarnish and leaves gifting deliberately empty", () => {
    const membersOf = (tag: CollectionSlug): Product[] =>
      getAllProducts().filter((product) => (product.collections ?? []).includes(tag));

    expect(membersOf("anti-tarnish").length).toBeGreaterThan(0);
    expect(membersOf("gifting")).toEqual([]);
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

  it("lists all ten categories, each linking to its shop filter", () => {
    expect(CATEGORY_MENU.items).toHaveLength(EXPECTED_CATEGORY_COUNT);
    expect(CATEGORY_MENU.items.map((item) => item.href)).toEqual(
      CATEGORY_SLUGS.map(buildCategoryHref),
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
