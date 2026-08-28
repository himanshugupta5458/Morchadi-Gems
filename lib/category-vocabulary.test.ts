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
  selectSurfacedCategories,
  type CategoryOption,
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
 * Reads the category list a plain script hard-codes, so the five enumerations can be compared
 * without importing a file that runs on import (`validate-products.mjs` validates the catalogue
 * and calls `process.exit` at module scope).
 */
function declarationBodyIn(scriptPath: string, constantName: string): string {
  const source = readFileSync(join(REPO_ROOT, scriptPath), "utf8");
  const declaration = new RegExp(`const ${constantName} = \\[([^\\]]*)\\]`).exec(source);
  if (declaration === null) {
    throw new Error(`${scriptPath} declares no ${constantName} array`);
  }
  return declaration[1];
}

/** The script with its prose stripped, so a claim about the code is checked against code. */
function executableSourceOf(scriptPath: string): string {
  return readFileSync(join(REPO_ROOT, scriptPath), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join("\n");
}

function slugsDeclaredIn(scriptPath: string, constantName: string): string[] {
  return sorted(
    [...declarationBodyIn(scriptPath, constantName).matchAll(/"([a-z-]+)"/g)].map(
      (match) => match[1],
    ),
  );
}

/**
 * The `{ slug, status }` pairs a plain script hard-codes, so the surfacing flag can be compared
 * across the boundary as well as the vocabulary. Before ADR-056's prompt,
 * `scripts/validate-products.mjs` held bare slugs and derived its browsable subset by excluding
 * `gift-hampers` **by name**, so nothing here could have caught the two lists disagreeing about a
 * status — there was no status to disagree about.
 */
function categoriesDeclaredIn(scriptPath: string, constantName: string): CategoryOption[] {
  return [
    ...declarationBodyIn(scriptPath, constantName).matchAll(
      /slug:\s*"([a-z-]+)",\s*status:\s*"(surfaced|pending)"/g,
    ),
  ]
    .map((match) => ({ slug: match[1], label: match[1], status: match[2] }) as CategoryOption)
    .sort((left, right) => left.slug.localeCompare(right.slug));
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

/**
 * The surfacing rule tested as a rule, over categories that do not exist. Asserting only that
 * `gift-hampers` is the pending one would pass on the name-based exclusion this replaced, which is
 * exactly how audit finding I-5 survived a green gate.
 */
describe("selectSurfacedCategories, over arbitrary categories", () => {
  const RINGS: CategoryOption = { slug: "rings", label: "Rings", status: "surfaced" };
  const WATCHES: CategoryOption = { slug: "watches", label: "Watches", status: "surfaced" };

  it("keeps the surfaced ones and drops the pending ones", () => {
    const flipped: CategoryOption[] = [{ ...RINGS, status: "pending" }, WATCHES];

    expect(selectSurfacedCategories(flipped).map((category) => category.slug)).toEqual(["watches"]);
  });

  it("follows a status flip in both directions, whatever the slug is called", () => {
    const pendingWatches: CategoryOption[] = [RINGS, { ...WATCHES, status: "pending" }];
    expect(selectSurfacedCategories(pendingWatches).map((category) => category.slug)).toEqual([
      "rings",
    ]);

    const bothSurfaced: CategoryOption[] = [RINGS, WATCHES];
    expect(selectSurfacedCategories(bothSurfaced).map((category) => category.slug)).toEqual([
      "rings",
      "watches",
    ]);
  });

  it("returns nothing when every category is pending, rather than falling back to all of them", () => {
    const allPending: CategoryOption[] = [
      { ...RINGS, status: "pending" },
      { ...WATCHES, status: "pending" },
    ];

    expect(selectSurfacedCategories(allPending)).toEqual([]);
  });

  it("is what SURFACED_CATEGORIES is built from, so the two can never disagree", () => {
    expect(selectSurfacedCategories(CATEGORIES)).toEqual([...SURFACED_CATEGORIES]);
    expect(sorted(SURFACED_CATEGORY_SLUGS)).toEqual(
      sorted(
        CATEGORIES.filter((category) => category.status === "surfaced").map(
          (category) => category.slug,
        ),
      ),
    );
  });
});

describe("the five enumerations that must not drift apart", () => {
  it("types/product.ts and scripts/validate-products.mjs agree", () => {
    expect(
      sorted(
        categoriesDeclaredIn("scripts/validate-products.mjs", "CATEGORIES").map(
          (category) => category.slug,
        ),
      ),
    ).toEqual(THE_ELEVEN);
  });

  it("they agree on each category's STATUS too, not only on the slugs", () => {
    const declared = categoriesDeclaredIn("scripts/validate-products.mjs", "CATEGORIES");
    const expected = [...CATEGORIES]
      .map((category) => ({ slug: category.slug, status: category.status }))
      .sort((left, right) => left.slug.localeCompare(right.slug));

    expect(declared.map(({ slug, status }) => ({ slug, status }))).toEqual(expected);
  });

  /**
   * The regression guard for audit finding I-5. The validator used to answer "is this category
   * browsable" with `slug !== "gift-hampers"` — a question about a name, when ADR-055 had already
   * created a field to answer it. A source assertion rather than a behavioural one because
   * `validate-products.mjs` validates the catalogue and calls `process.exit` at module scope, so
   * a test cannot import it and read the derived value.
   */
  it("validate-products.mjs derives surfacing from status, never from a slug name", () => {
    const code = executableSourceOf("scripts/validate-products.mjs");

    expect(code).toContain('category.status === "surfaced"');
    expect(code).not.toContain('slug !== "gift-hampers"');
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

describe("surfacing — gift-hampers reached shoppers with its first published products", () => {
  it("surfaces all eleven", () => {
    expect(SURFACED_CATEGORY_SLUGS).toHaveLength(11);
    expect(sorted(SURFACED_CATEGORY_SLUGS)).toContain("gift-hampers");
  });

  it("marks gift-hampers surfaced, not pending", () => {
    const giftHampers = CATEGORIES.find((category) => category.slug === "gift-hampers");

    expect(giftHampers?.status).toBe("surfaced");
    expect(isSurfacedCategory("gift-hampers")).toBe(true);
    expect(isCategory("gift-hampers")).toBe(true);
  });

  it("appears in the category nav menu", () => {
    expect(CATEGORY_MENU.items.map((item) => item.key)).toContain("gift-hampers");
    expect(CATEGORY_MENU.items).toHaveLength(11);
  });

  it("appears in the sitemap, now that its listing has something to crawl", () => {
    const urls = buildSitemap().map((entry) => entry.url);

    expect(urls.some((url) => url.includes("category=gift-hampers"))).toBe(true);
    expect(urls.some((url) => url.includes("category=rings"))).toBe(true);
  });

  it("honours ?category=gift-hampers rather than falling back to the whole shop", () => {
    expect(parseShopQuery({ category: "gift-hampers" }).categories).toEqual(["gift-hampers"]);
    expect(parseShopQuery({ category: "rings" }).categories).toEqual(["rings"]);
  });

  it("has published products behind it — the invariant validate-products enforces for a surfaced category", () => {
    const published = getAllProducts()
      .filter((product) => product.category === "gift-hampers")
      .map((product) => product.id)
      .sort();

    expect(published).toEqual([
      "P363",
      "P367",
      "P368",
      "P532",
      "P533",
      "P534",
      "P535",
      "P536",
      "P537",
      "P538",
      "P545",
      "P592",
      "P593",
      "P594",
      "P595",
      "P596",
      "P597",
      "P598",
      "P600",
      "P624",
      "P625",
      "P626",
      "P627",
    ]);
  });

  it("every surfaced category does have published products", () => {
    const catalogue = getAllProducts();

    for (const slug of SURFACED_CATEGORY_SLUGS) {
      expect(catalogue.some((product) => product.category === slug), slug).toBe(true);
    }
  });

  it("had its tile image ready, so flipping the flag needed no asset work", () => {
    expect(readFileSync(join(REPO_ROOT, "public/categories/gift-hampers.webp")).length).toBeGreaterThan(0);
  });
});
