import { describe, expect, it, vi } from "vitest";

/**
 * The draft-product regression suite. It runs the whole read side of the catalogue against a
 * synthetic unpublished product injected into `data/products.json`, because the guarantee
 * ADR-052 makes is not "the product page hides drafts" but "no public surface renders one" —
 * and the only way to hold that is to ask every surface at once.
 *
 * The draft is deliberately the loudest record in the file: featured, new, in stock, tagged
 * into a collection, and priced fifty times above the dearest real piece. Every one of those is a hook some surface sorts, counts, bands or aggregates on, so a
 * surface that has forgotten about status fails here rather than passing by luck.
 *
 * Hoisted, because `vi.mock` runs its factory when the mocked module is first imported, which
 * is before this file's own top-level statements execute.
 */
const { DRAFT_ID, DRAFT_NAME, DRAFT_PRICE, DRAFT_CATEGORY } = vi.hoisted(() => ({
  DRAFT_ID: "P900",
  DRAFT_NAME: "Unreleased Draft Ring",
  DRAFT_PRICE: 24999,
  DRAFT_CATEGORY: "rings" as const,
}));

vi.mock("@/data/products.json", async (importOriginal) => {
  const actual = await importOriginal<{ default: Record<string, unknown>[] }>();
  const template = JSON.parse(JSON.stringify(actual.default[0])) as Record<string, unknown>;
  const seo = template.seo as Record<string, unknown>;

  const draft = {
    ...template,
    id: DRAFT_ID,
    name: DRAFT_NAME,
    category: DRAFT_CATEGORY,
    status: "draft",
    collections: ["gifting"],
    pricing: { price: DRAFT_PRICE, mrp: DRAFT_PRICE, cost: 1 },
    stock: { inStock: true },
    flags: { featured: true, isNew: true },
    seo: {
      ...seo,
      primaryKeyword: "unreleased draft ring",
      metaTitle: "Unreleased Draft Ring — not for publication",
      ogTitle: "Unreleased Draft Ring, still in draft",
    },
  };

  return { default: [...actual.default, draft] };
});

import { COLLECTIONS, SURFACED_CATEGORIES } from "@/types/product";
import { buildCollectionHref } from "@/lib/navigation";
import {
  getAllProducts,
  getAllProductsIncludingDrafts,
  getCatalogueIndex,
  getFeaturedProducts,
  getNewArrivals,
  getOrderCaptureCatalogue,
  getOrderOptionCatalogue,
  getOrderPricingCatalogue,
  getProductById,
  getProductsByCategory,
  getRelatedProducts,
  isActiveProduct,
} from "@/lib/products";
import { PER_PAGE, getShopResults } from "@/lib/shop";
import { buildSitemap } from "@/lib/sitemap";
import {
  buildCollectionPageSchemaGraph,
  buildOnlineStoreSchema,
  buildSiteSchemaGraph,
} from "@/lib/structured-data";
import { generateStaticParams } from "@/app/(storefront)/product/[id]/page";

const idsOf = (products: { id: string }[]): string[] => products.map((product) => product.id);

/**
 * The expected count, derived from the raw file rather than from any accessor, so a surface
 * that has silently stopped filtering cannot move the yardstick it is measured against.
 */
const PUBLISHED_COUNT = getAllProductsIncludingDrafts().filter(
  (product) => product.status !== "draft",
).length;

function everyShopPage(
  params: Record<string, string | string[] | undefined> = {},
): { id: string }[] {
  const first = getShopResults(params);
  const collected = [...first.items];

  for (let page = 2; page <= first.totalPages; page += 1) {
    collected.push(...getShopResults({ ...params, page: String(page) }).items);
  }

  return collected;
}

describe("the draft fixture is genuinely in the catalogue file", () => {
  it("is present in the unfiltered catalogue, so every absence below is a filter and not a typo", () => {
    expect(idsOf(getAllProductsIncludingDrafts())).toContain(DRAFT_ID);
  });

  /**
   * Until 2026-08-24 the fixture was the only unpublished record in the file. Phase 2 now lands
   * real migrated drafts in `data/products.json` as `status: "draft"` awaiting the publish step,
   * so "unpublished" is no longer synonymous with "the fixture". What still must hold is that no
   * unpublished record is unaccounted for: each one is either this suite's injected fixture or a
   * migrated pipeline record, which Phase 2 always writes with its `migrationProvenance` link
   * back to the source listing. An unpublished record with neither is a record nobody meant to
   * leave switched off, and it fails here.
   */
  it("accounts for every unpublished record: the fixture, or a migrated pipeline draft", () => {
    const unpublished = getAllProductsIncludingDrafts().filter(
      (product) => !isActiveProduct(product),
    );
    expect(idsOf(unpublished)).toContain(DRAFT_ID);
    for (const product of unpublished) {
      if (product.id === DRAFT_ID) continue;
      expect(
        product.migrationProvenance?.originalId,
        `${product.id} is unpublished but is neither the test fixture nor a migrated pipeline draft`,
      ).toBeTruthy();
    }
  });
});

describe("the catalogue accessors", () => {
  it("keeps the draft out of getAllProducts", () => {
    expect(idsOf(getAllProducts())).not.toContain(DRAFT_ID);
  });

  it("keeps the draft out of its own category listing", () => {
    expect(idsOf(getProductsByCategory(DRAFT_CATEGORY))).not.toContain(DRAFT_ID);
  });

  it("does not resolve the draft by id, so the product page 404s through its existing notFound", () => {
    expect(getProductById(DRAFT_ID)).toBeUndefined();
  });

  it("still resolves a published product by id", () => {
    expect(getProductById(getAllProducts()[0].id)).toBeDefined();
  });

  it("ignores the draft's featured flag on the home best-sellers row", () => {
    expect(idsOf(getFeaturedProducts())).not.toContain(DRAFT_ID);
  });

  it("ignores the draft's isNew flag on the home new-arrivals row", () => {
    expect(idsOf(getNewArrivals())).not.toContain(DRAFT_ID);
  });

  it("keeps the draft out of the related-products rail of a product in its own category", () => {
    const sibling = getAllProducts().find(
      (product) => product.category === DRAFT_CATEGORY && product.id !== DRAFT_ID,
    );
    expect(sibling).toBeDefined();

    const wholeCategory = getRelatedProducts(sibling!, PUBLISHED_COUNT);
    expect(idsOf(wholeCategory)).not.toContain(DRAFT_ID);
    expect(wholeCategory.length).toBeGreaterThan(4);
  });
});

describe("the prerendered route set", () => {
  it("does not give the draft a static param, so with dynamicParams false its URL is a hard 404", () => {
    expect(generateStaticParams().map((param) => param.id)).not.toContain(DRAFT_ID);
  });
});

describe("the shop listing and its facets", () => {
  it("does not show the draft on any page of the unfiltered listing", () => {
    expect(idsOf(everyShopPage())).not.toContain(DRAFT_ID);
  });

  it("does not count the draft in the result total", () => {
    expect(getShopResults({}).total).toBe(PUBLISHED_COUNT);
  });

  it("does not surface the draft under its own category filter", () => {
    expect(idsOf(everyShopPage({ category: DRAFT_CATEGORY }))).not.toContain(DRAFT_ID);
  });

  it("does not surface the draft under any collection facet, tagged or derived", () => {
    for (const collection of COLLECTIONS) {
      expect(idsOf(everyShopPage({ collection: collection.slug }))).not.toContain(DRAFT_ID);
    }
  });

  it("does not surface the draft in the price band its price falls in", () => {
    expect(idsOf(everyShopPage({ price: "premium" }))).not.toContain(DRAFT_ID);
  });

  it("does not let the draft take the first slot under a price sort it would otherwise win", () => {
    expect(idsOf(everyShopPage({ sort: "price-desc" }))).not.toContain(DRAFT_ID);
    expect(idsOf(everyShopPage({ sort: "newest" }))).not.toContain(DRAFT_ID);
  });

  it("still returns a full first page of published products", () => {
    expect(PUBLISHED_COUNT).toBeGreaterThan(PER_PAGE);
    expect(getShopResults({}).items).toHaveLength(PER_PAGE);
  });
});

describe("the sitemap", () => {
  const urls = buildSitemap().map((entry) => entry.url);

  it("publishes no URL for the draft product", () => {
    expect(urls.some((url) => url.endsWith(`/product/${DRAFT_ID}`))).toBe(false);
  });

  it("publishes a URL for every published product and no more", () => {
    const productUrls = urls.filter((url) => url.includes("/product/"));
    expect(productUrls).toHaveLength(PUBLISHED_COUNT);
  });

  /**
   * Until the pilot batch published on 2026-08-24, gifting held nothing but this suite's draft
   * fixture and the sitemap rightly omitted it. Gifting is now genuinely populated, so the
   * property inverts on the same reasoning: the sitemap lists it, and the listing is justified
   * entirely by published products — the draft's membership contributes nothing, which the
   * second assertion proves by counting only what `getAllProducts` (draft-free) returns.
   */
  it("lists gifting because published products populate it, never counting the draft", () => {
    expect(urls.some((url) => url.endsWith(buildCollectionHref("gifting")))).toBe(true);

    const publishedGiftingMembers = getAllProducts().filter((product) =>
      (product.collections ?? []).includes("gifting"),
    );
    expect(publishedGiftingMembers.length).toBeGreaterThan(0);
    expect(idsOf(publishedGiftingMembers)).not.toContain(DRAFT_ID);
  });

  it("still publishes every surfaced category and the static routes", () => {
    for (const category of SURFACED_CATEGORIES) {
      expect(urls.some((url) => url.endsWith(`/shop?category=${category.slug}`))).toBe(true);
    }
  });
});

describe("structured data", () => {
  it("does not name the draft in the shop listing's ItemList", () => {
    const results = getShopResults({});
    const graph = buildCollectionPageSchemaGraph({
      path: "/shop",
      name: "Shop All Jewellery",
      description: "Every piece we make.",
      products: results.items,
      total: results.total,
      rangeStart: results.rangeStart,
    });

    expect(JSON.stringify(graph)).not.toContain(DRAFT_ID);
    expect(JSON.stringify(graph)).not.toContain(DRAFT_NAME);
  });

  it("does not stretch the store's advertised price range to the draft's price", () => {
    expect(buildOnlineStoreSchema().priceRange).not.toContain(
      DRAFT_PRICE.toLocaleString("en-IN"),
    );
  });

  it("emits no draft data anywhere in the site-wide graph", () => {
    const serialised = JSON.stringify(buildSiteSchemaGraph());
    expect(serialised).not.toContain(DRAFT_ID);
    expect(serialised).not.toContain(DRAFT_NAME);
    expect(serialised).not.toContain(DRAFT_PRICE.toLocaleString("en-IN"));
  });
});

describe("the order path", () => {
  it("gives the pricing core no entry for the draft, so it cannot be priced or bought", () => {
    expect(idsOf(getOrderPricingCatalogue())).not.toContain(DRAFT_ID);
  });

  it("gives capture no entry for the draft", () => {
    expect(idsOf(getOrderCaptureCatalogue())).not.toContain(DRAFT_ID);
  });

  it("gives option validation no entry for the draft", () => {
    expect(idsOf(getOrderOptionCatalogue())).not.toContain(DRAFT_ID);
  });

  it("does not ship the draft to the browser in the cart catalogue", () => {
    const catalogueIndex = getCatalogueIndex();
    expect(idsOf(catalogueIndex)).not.toContain(DRAFT_ID);
    expect(JSON.stringify(catalogueIndex)).not.toContain(DRAFT_NAME);
  });
});
