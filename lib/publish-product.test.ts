import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  activateProduct,
  publishProduct,
  serialiseCatalogue,
} from "@/scripts/publish-product.mjs";

/**
 * Every case below runs against a synthetic repository under the OS temp directory — its own
 * `data/products.json` and its own `content-pipeline/`. Nothing here reads or writes the real
 * catalogue: publishing is a one-way file move, and a test that could perform it on the shipped
 * data is a test that will eventually perform it.
 */
let root = "";

const SEO = {
  primaryKeyword: "gold-plated bow ring",
  secondaryKeywords: ["adjustable ring for women"],
  metaTitle: "Gold-Plated Bow Ring on an Adjustable Band",
  metaDescription: "A gold-plated bow ring on an adjustable band, set with clear cubic zirconia.",
  imageAlt: "Gold-tone adjustable band ring topped with a small cubic zirconia bow",
  ogTitle: "Adjustable Bow Ring in Gold Tone",
  ogDescription: "A gold-plated band topped with a little cubic zirconia bow.",
  ogImage: "/products/P900.webp",
};

function product(id: string, status: string, primaryKeyword = SEO.primaryKeyword) {
  return {
    id,
    name: "Cubic Zirconia Bow Ring",
    category: "rings",
    status,
    pricing: { price: 210, mrp: 299, cost: 126 },
    media: { images: [`/products/${id}.webp`] },
    specs: { material: "Gold-plated brass", stone: "Cubic zirconia" },
    description: "A gold-tone band carrying a small cubic zirconia bow, open at the back.",
    seo: { ...SEO, primaryKeyword, ogImage: `/products/${id}.webp` },
    stock: { inStock: true },
    flags: { featured: false, isNew: true },
  };
}

function readyDraft(id: string) {
  return {
    productId: id,
    sourceType: "migrated",
    category: "rings",
    subcategory: null,
    variants: [],
    attributes: [
      {
        label: "Material",
        value: "gold-plated brass",
        displayTerm: null,
        stoneSource: null,
        source: { origin: "migrated-text", quotedPhrase: "gold-plated brass" },
        confirmed: true,
      },
    ],
    images: {
      general: [
        { path: `/products/${id}.webp`, confirmed: true, sourceFile: null, role: "main" },
      ],
      variantImages: {},
    },
    pricing: { price: 210, mrp: 299, cost: 126, referencePrice: "₹499 (old site)" },
    personalized: false,
    suggestedCollections: [],
    sourceNotes: { rawContent: null, referenceTitle: "CZ Bow Ring" },
    flaggedContent: [],
    notes: [],
    status: "draft",
    generatedBy: null,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function seedRepository(catalogue: unknown[], drafts: Record<string, unknown>): void {
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "content-pipeline", "drafts"), { recursive: true });
  mkdirSync(join(root, "content-pipeline", "completed"), { recursive: true });

  writeJson(join(root, "data", "products.json"), catalogue);
  for (const [id, draft] of Object.entries(drafts)) {
    writeJson(join(root, "content-pipeline", "drafts", `${id}.json`), draft);
  }
}

function draftFile(id: string): string {
  return join(root, "content-pipeline", "drafts", `${id}.json`);
}

function completedFile(id: string): string {
  return join(root, "content-pipeline", "completed", `${id}.json`);
}

function statusOf(id: string): string | undefined {
  const catalogue = readJson(join(root, "data", "products.json")) as { id: string; status: string }[];
  return catalogue.find((entry) => entry.id === id)?.status;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "morchadi-publish-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("activateProduct", () => {
  it("flips draft to active and leaves the input array untouched", () => {
    const catalogue = [product("P001", "active", "gold-plated initial ring"), product("P900", "draft")];
    const result = activateProduct(catalogue, "P900");

    expect(result.error).toBeNull();
    expect(result.catalogue).not.toBeNull();
    expect((result.catalogue as typeof catalogue)[1].status).toBe("active");
    expect(catalogue[1].status).toBe("draft");
  });

  it("changes nothing but the status", () => {
    const before = product("P900", "draft");
    const { catalogue } = activateProduct([before], "P900");

    expect(catalogue).not.toBeNull();
    expect((catalogue as (typeof before)[])[0]).toEqual({ ...before, status: "active" });
  });

  it("refuses an id that is not in the catalogue", () => {
    const result = activateProduct([product("P900", "draft")], "P901");
    expect(result.catalogue).toBeNull();
    expect(result.error).toContain("not in data/products.json");
  });

  it("refuses a product that is already active", () => {
    const result = activateProduct([product("P900", "active")], "P900");
    expect(result.catalogue).toBeNull();
    expect(result.error).toContain("already active");
  });
});

describe("publishProduct", () => {
  it("flips the status and moves the draft to completed", () => {
    seedRepository([product("P900", "draft")], { P900: readyDraft("P900") });

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.published).toBe(true);
    expect(result.errors).toEqual([]);
    expect(statusOf("P900")).toBe("active");
    expect(existsSync(draftFile("P900"))).toBe(false);
    expect(existsSync(completedFile("P900"))).toBe(true);
    expect(readJson(completedFile("P900"))).toEqual(readyDraft("P900"));
  });

  it("leaves every other product exactly as it was", () => {
    const others = [product("P001", "active", "gold-plated initial ring"), product("P002", "draft", "glass locket necklace")];
    seedRepository([...others, product("P900", "draft")], { P900: readyDraft("P900") });

    publishProduct("P900", { repoRoot: root });
    const catalogue = readJson(join(root, "data", "products.json")) as unknown[];

    expect(catalogue).toHaveLength(3);
    expect(catalogue[0]).toEqual(others[0]);
    expect(catalogue[1]).toEqual(others[1]);
  });

  it("writes the catalogue back in the repository's own formatting", () => {
    const catalogue = [product("P900", "draft")];
    seedRepository(catalogue, { P900: readyDraft("P900") });

    publishProduct("P900", { repoRoot: root });
    const written = readFileSync(join(root, "data", "products.json"), "utf8");

    expect(written).toBe(serialiseCatalogue([{ ...catalogue[0], status: "active" }]));
  });

  it("regenerates the keyword map, which the newly published product now appears in", () => {
    seedRepository([product("P900", "draft")], { P900: readyDraft("P900") });

    publishProduct("P900", { repoRoot: root });
    const map = readJson(join(root, "data", "keyword-map.json")) as {
      productCount: number;
      primary: Record<string, string[]>;
      secondary: Record<string, string[]>;
    };

    expect(map.productCount).toBe(1);
    expect(map.primary["gold-plated bow ring"]).toEqual(["P900"]);
    expect(map.secondary["adjustable ring for women"]).toEqual(["P900"]);
  });

  it("refuses a draft whose publish-readiness check no longer passes, changing nothing", () => {
    const unconfirmed = readyDraft("P900");
    unconfirmed.attributes[0].confirmed = false;
    seedRepository([product("P900", "draft")], { P900: unconfirmed });

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.published).toBe(false);
    expect(result.errors.join(" ")).toContain("confirmed");
    expect(statusOf("P900")).toBe("draft");
    expect(existsSync(draftFile("P900"))).toBe(true);
    expect(existsSync(join(root, "data", "keyword-map.json"))).toBe(false);
  });

  it("refuses a draft whose price was removed after the record was built", () => {
    const unpriced = readyDraft("P900");
    unpriced.pricing.price = null as unknown as number;
    seedRepository([product("P900", "draft")], { P900: unpriced });

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.published).toBe(false);
    expect(statusOf("P900")).toBe("draft");
  });

  it("refuses when the draft file is missing, rather than publishing an unsourced record", () => {
    seedRepository([product("P900", "draft")], {});

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.published).toBe(false);
    expect(result.errors[0]).toContain("does not exist");
    expect(statusOf("P900")).toBe("draft");
  });

  it("refuses a second publish of the same product", () => {
    seedRepository([product("P900", "draft")], { P900: readyDraft("P900") });

    expect(publishProduct("P900", { repoRoot: root }).published).toBe(true);
    const second = publishProduct("P900", { repoRoot: root });

    expect(second.published).toBe(false);
    expect(existsSync(completedFile("P900"))).toBe(true);
  });

  it("refuses when publishing would give one primary keyword two owners", () => {
    seedRepository(
      [product("P001", "active"), product("P900", "draft")],
      { P900: readyDraft("P900") },
    );

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.published).toBe(false);
    expect(result.errors[0]).toContain("two owners");
    expect(statusOf("P900")).toBe("draft");
    expect(existsSync(draftFile("P900"))).toBe(true);
  });

  it("leaves the similarity report behind and says so", () => {
    seedRepository([product("P900", "draft")], { P900: readyDraft("P900") });
    writeJson(join(root, "content-pipeline", "drafts", "P900-similarity.json"), { threshold: null });

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.published).toBe(true);
    expect(result.warnings.join(" ")).toContain("P900-similarity.json");
    expect(existsSync(join(root, "content-pipeline", "drafts", "P900-similarity.json"))).toBe(true);
  });

  it("names the row the owner has to write by hand", () => {
    seedRepository([product("P900", "draft")], { P900: readyDraft("P900") });

    const result = publishProduct("P900", { repoRoot: root });

    expect(result.name).toBe("Cubic Zirconia Bow Ring");
    expect(result.category).toBe("rings");
    expect(result.movedTo).toBe("content-pipeline/completed/P900.json");
  });
});
