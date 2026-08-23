import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  CATEGORY_SLUGS,
  SURFACED_CATEGORIES,
  SURFACED_CATEGORY_SLUGS,
  getCategoryLabel,
  isCategory,
  isSurfacedCategory,
} from "@/types/product";
import { CATEGORY_MENU } from "@/lib/navigation";
import { MIGRATION_CATEGORY_SLUGS } from "@/scripts/prepare-migration-batch.mjs";
import { validateDraftA, validatePublishReadiness } from "@/scripts/validate-draft-a.mjs";
import { getAllProducts } from "@/lib/products";
import { buildSitemap } from "@/lib/sitemap";
import { parseShopQuery } from "@/lib/shop-query";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

const THE_ELEVEN = [
  "anklets",
  "bangles",
  "bracelets",
  "earrings",
  "gift-hampers",
  "hair-accessories",
  "necklaces",
  "nose-pins",
  "pendants",
  "rings",
  "watches",
];

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

/**
 * Reads the category list a plain script hard-codes, so the four enumerations can be compared
 * without importing a file that runs on import (`validate-products.mjs` validates the catalogue
 * and calls `process.exit` at module scope).
 */
function slugsDeclaredIn(scriptPath: string, constantName: string): string[] {
  const source = readFileSync(join(REPO_ROOT, scriptPath), "utf8");
  const declaration = new RegExp(`const ${constantName} = \\[([^\\]]*)\\]`).exec(source);
  if (declaration === null) {
    throw new Error(`${scriptPath} declares no ${constantName} array`);
  }
  return sorted([...declaration[1].matchAll(/"([a-z-]+)"/g)].map((match) => match[1]));
}

describe("the category vocabulary", () => {
  it("is eleven slugs, gift-hampers included", () => {
    expect(sorted(CATEGORY_SLUGS)).toEqual(THE_ELEVEN);
  });

  it("accepts gift-hampers as a category a product record may carry", () => {
    expect(isCategory("gift-hampers")).toBe(true);
  });

  it("gives gift-hampers a display label rather than falling back to the slug", () => {
    expect(getCategoryLabel("gift-hampers")).toBe("Gift Hampers");
  });

  it("still refuses a slug that is in no list", () => {
    expect(isCategory("toe-rings")).toBe(false);
  });

  it("gives every category exactly one status", () => {
    for (const category of CATEGORIES) {
      expect(["surfaced", "pending"]).toContain(category.status);
    }
  });
});

describe("the four enumerations that must not drift apart", () => {
  it("types/product.ts and scripts/validate-products.mjs agree", () => {
    expect(slugsDeclaredIn("scripts/validate-products.mjs", "CATEGORY_SLUGS")).toEqual(THE_ELEVEN);
  });

  it("types/product.ts and scripts/validate-draft-a.mjs agree", () => {
    expect(slugsDeclaredIn("scripts/validate-draft-a.mjs", "CATEGORY_SLUGS")).toEqual(THE_ELEVEN);
  });

  it("types/product.ts and scripts/prepare-migration-batch.mjs agree", () => {
    expect(sorted(MIGRATION_CATEGORY_SLUGS)).toEqual(THE_ELEVEN);
  });

  it("the placeholder generator can draw a tile for every one of them", () => {
    expect(slugsDeclaredIn("scripts/generate-placeholders.mjs", "CATEGORIES")).toEqual(THE_ELEVEN);
  });
});

describe("a gift-hampers product passes the record-level validators", () => {
  const draft = () => ({
    productId: "P900",
    sourceType: "migrated",
    category: "gift-hampers",
    subcategory: null,
    variants: [],
    attributes: [
      {
        label: "Contents",
        value: "assorted confectionery",
        displayTerm: null,
        stoneSource: null,
        source: { origin: "migrated-text", quotedPhrase: "assorted confectionery" },
        confirmed: false,
      },
    ],
    images: { general: [], variantImages: {} },
    pricing: { price: null, mrp: null, cost: null, referencePrice: "₹999 (old site)" },
    personalized: false,
    suggestedCollections: ["gifting"],
    sourceNotes: {
      rawContent: "A gift hamper of assorted confectionery packed in a reusable box.",
      referenceTitle: "Festive Gift Hamper",
    },
    flaggedContent: [],
    notes: [],
    status: "draft",
    generatedBy: null,
  });

  it("passes validateDraftA cleanly — no errors, no category warning", () => {
    const result = validateDraftA(draft());

    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.warnings ?? [])).not.toContain("category");
  });

  it("passes validatePublishReadiness once it has a price and an image", () => {
    const reviewed = {
      ...draft(),
      attributes: draft().attributes.map((attribute) => ({ ...attribute, confirmed: true })),
      images: {
        general: [
          { path: "/products/P900.webp", confirmed: true, sourceFile: null, role: "main" },
        ],
        variantImages: {},
      },
      pricing: { price: 999, mrp: 1299, cost: 600, referencePrice: "₹999 (old site)" },
    };

    expect(validatePublishReadiness(reviewed).errors).toEqual([]);
  });

  it("is queued by Stage 0 with no warning attached, now that nothing downstream rejects it", () => {
    expect(MIGRATION_CATEGORY_SLUGS).toContain("gift-hampers");
  });
});

describe("surfacing — a valid category a shopper cannot yet reach", () => {
  it("surfaces ten of the eleven", () => {
    expect(SURFACED_CATEGORY_SLUGS).toHaveLength(10);
    expect(sorted(SURFACED_CATEGORY_SLUGS)).not.toContain("gift-hampers");
  });

  it("marks gift-hampers pending, not surfaced", () => {
    const giftHampers = CATEGORIES.find((category) => category.slug === "gift-hampers");

    expect(giftHampers?.status).toBe("pending");
    expect(isSurfacedCategory("gift-hampers")).toBe(false);
    expect(isCategory("gift-hampers")).toBe(true);
  });

  it("keeps it out of the category nav menu", () => {
    expect(CATEGORY_MENU.items.map((item) => item.key)).not.toContain("gift-hampers");
    expect(CATEGORY_MENU.items).toHaveLength(10);
  });

  it("keeps it out of the sitemap, so nothing crawls an empty listing", () => {
    const urls = buildSitemap().map((entry) => entry.url);

    expect(urls.some((url) => url.includes("category=gift-hampers"))).toBe(false);
    expect(urls.some((url) => url.includes("category=rings"))).toBe(true);
  });

  it("ignores a hand-typed ?category=gift-hampers rather than rendering an empty shop", () => {
    expect(parseShopQuery({ category: "gift-hampers" }).categories).toEqual([]);
    expect(parseShopQuery({ category: "rings" }).categories).toEqual(["rings"]);
  });

  it("has no published products behind it — the invariant validate-products enforces", () => {
    const published = getAllProducts().filter((product) => product.category === "gift-hampers");

    expect(published).toEqual([]);
  });

  it("every surfaced category does have published products", () => {
    const catalogue = getAllProducts();

    for (const slug of SURFACED_CATEGORY_SLUGS) {
      expect(catalogue.some((product) => product.category === slug), slug).toBe(true);
    }
  });

  it("has its tile image ready, so flipping the flag needs no asset work", () => {
    expect(SURFACED_CATEGORIES.length).toBeLessThan(CATEGORIES.length);
    expect(readFileSync(join(REPO_ROOT, "public/categories/gift-hampers.webp")).length).toBeGreaterThan(0);
  });
});
