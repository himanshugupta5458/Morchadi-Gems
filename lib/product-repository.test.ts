import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  JsonFileProductRepository,
  applyProductEdit,
  computeProductVersion,
  serialiseCatalogue,
  type ProductEdit,
} from "@/lib/product-repository";
import type { Product } from "@/types/product";

/**
 * Every case runs against a copy of the real catalogue under the OS temp directory, never
 * against `data/products.json` itself. The copy is deliberate rather than a synthetic fixture:
 * the rules this repository enforces include the catalogue-level floors — four featured pieces,
 * four new arrivals, every surfaced category populated — and a three-product fixture fails all of
 * them for reasons that have nothing to do with the edit under test.
 *
 * `validateCatalogue` resolves image paths against the *process* working directory, which is the
 * real repository, so the photographs a record names are genuinely on disk.
 */
const REPOSITORY_ROOT = process.cwd();
const REAL_CATALOGUE_PATH = join(REPOSITORY_ROOT, "data", "products.json");
const REAL_KEYWORD_MAP_PATH = join(REPOSITORY_ROOT, "data", "keyword-map.json");

let root = "";

function cataloguePath(): string {
  return join(root, "data", "products.json");
}

function readCatalogueFromDisk(): Product[] {
  return JSON.parse(readFileSync(cataloguePath(), "utf8")) as Product[];
}

function repository(overrides: { writesEnabled?: () => boolean } = {}): JsonFileProductRepository {
  return new JsonFileProductRepository({
    rootDirectory: root,
    writesEnabled: overrides.writesEnabled ?? (() => true),
  });
}

/** The edit that changes nothing — the baseline every case below varies one field of. */
function editFrom(product: Product): ProductEdit {
  return {
    name: product.name,
    category: product.category,
    subcategory: product.subcategory ?? null,
    description: product.description,
    status: product.status,
    flags: { ...product.flags },
    stock: { ...product.stock },
    options: product.options === undefined ? [] : [...product.options],
    variantImages: { ...(product.media.variantImages ?? {}) },
    pricing: { ...product.pricing },
    specs: { ...product.specs },
    seo: { ...product.seo },
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "morchadi-product-repository-"));
  mkdirSync(join(root, "data"), { recursive: true });
  copyFileSync(REAL_CATALOGUE_PATH, cataloguePath());
  copyFileSync(REAL_KEYWORD_MAP_PATH, join(root, "data", "keyword-map.json"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("JsonFileProductRepository reads", () => {
  it("lists every record in the file, drafts included", async () => {
    const products = await repository().listProducts();
    expect(products).toHaveLength(readCatalogueFromDisk().length);
  });

  it("returns one product by id, and null for an id the catalogue does not hold", async () => {
    const [first] = readCatalogueFromDisk();

    await expect(repository().getProduct(first.id)).resolves.toMatchObject({ id: first.id });
    await expect(repository().getProduct("P000")).resolves.toBeNull();
  });

  it("reads the file rather than a cached copy, so a change made behind it is visible", async () => {
    const catalogue = readCatalogueFromDisk();
    const store = repository();

    await store.listProducts();

    catalogue[0].name = "Renamed Behind The Repository";
    const { writeFileSync } = await import("node:fs");
    writeFileSync(cataloguePath(), serialiseCatalogue(catalogue), "utf8");

    await expect(store.getProduct(catalogue[0].id)).resolves.toMatchObject({
      name: "Renamed Behind The Repository",
    });
  });
});

describe("JsonFileProductRepository.updateProduct", () => {
  it("saves a valid edit and reflects it on the next read", async () => {
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.pricing = { ...edit.pricing, price: current.pricing.price + 5 };

    const outcome = await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome.kind).toBe("UPDATED");
    await expect(repository().getProduct(current.id)).resolves.toMatchObject({
      pricing: expect.objectContaining({ price: current.pricing.price + 5 }),
    });
  });

  it("leaves every other record byte-identical", async () => {
    const before = readFileSync(cataloguePath(), "utf8");
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.stock = { inStock: !current.stock.inStock };

    await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    const beforeLines = before.split("\n");
    const afterLines = readFileSync(cataloguePath(), "utf8").split("\n");
    const differingLines = beforeLines.filter((line, index) => line !== afterLines[index]);

    expect(beforeLines).toHaveLength(afterLines.length);
    expect(differingLines).toHaveLength(1);
    expect(differingLines[0]).toContain("inStock");
  });

  it("rebuilds the keyword map in the same operation, so the gate cannot go stale", async () => {
    const catalogue = readCatalogueFromDisk();
    const current = catalogue[0];
    const edit = editFrom(current);
    edit.seo = { ...edit.seo, primaryKeyword: "a keyword no other product claims here" };

    const outcome = await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome.kind).toBe("UPDATED");

    const keywordMap = JSON.parse(
      readFileSync(join(root, "data", "keyword-map.json"), "utf8"),
    ) as { primary: Record<string, string[]> };

    expect(keywordMap.primary["a keyword no other product claims here"]).toEqual([current.id]);
    expect(keywordMap.primary[current.seo.primaryKeyword]).toBeUndefined();
  });

  it("reports an edit that changes nothing as UNCHANGED without rewriting the file", async () => {
    const before = readFileSync(cataloguePath(), "utf8");
    const [current] = readCatalogueFromDisk();

    const outcome = await repository().updateProduct({
      id: current.id,
      edit: editFrom(current),
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome.kind).toBe("UNCHANGED");
    expect(readFileSync(cataloguePath(), "utf8")).toBe(before);
  });

  it("answers NOT_FOUND for an id the catalogue does not hold", async () => {
    const [current] = readCatalogueFromDisk();

    const outcome = await repository().updateProduct({
      id: "P000",
      edit: editFrom(current),
      expectedVersion: "whatever",
    });

    expect(outcome.kind).toBe("NOT_FOUND");
  });

  it("leaves no temporary file behind", async () => {
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.name = `${current.name} II`;

    await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(readdirSync(join(root, "data")).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});

describe("JsonFileProductRepository refuses a write rather than corrupting the catalogue", () => {
  it("rejects an edit that breaks a record-level rule, and writes nothing", async () => {
    const before = readFileSync(cataloguePath(), "utf8");
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.pricing = { ...edit.pricing, price: 0 };

    const outcome = await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome).toMatchObject({ kind: "REJECTED", error: "VALIDATION_FAILED" });
    expect(outcome.kind === "REJECTED" && outcome.failures.join(" ")).toContain(
      "pricing.price must be a positive whole number",
    );
    expect(readFileSync(cataloguePath(), "utf8")).toBe(before);
  });

  it("rejects a precious-metal claim the catalogue cannot support", async () => {
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.name = "22K Solid Gold Ring";

    const outcome = await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome).toMatchObject({ kind: "REJECTED", error: "VALIDATION_FAILED" });
    expect(outcome.kind === "REJECTED" && outcome.failures.join(" ")).toContain(
      "makes a precious-metal claim",
    );
  });

  /**
   * The collision no single record can see, and the reason `updateProduct` validates the whole
   * catalogue rather than the record it was handed.
   */
  it("rejects a primary keyword another product already owns", async () => {
    const catalogue = readCatalogueFromDisk();
    const [current, neighbour] = catalogue;
    const edit = editFrom(current);
    edit.seo = { ...edit.seo, primaryKeyword: neighbour.seo.primaryKeyword };

    const outcome = await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome).toMatchObject({ kind: "REJECTED", error: "VALIDATION_FAILED" });
    expect(outcome.kind === "REJECTED" && outcome.failures.join(" ")).toContain(
      "seo.primaryKeyword",
    );
  });

  /**
   * A catalogue-level floor, broken by an edit to one record. The failure names no product id at
   * all, which is why `ok` cannot be decided from the id-prefixed failures alone.
   */
  it("rejects an edit that would empty a surfaced category's listing", async () => {
    const catalogue = readCatalogueFromDisk();
    const onlyAnkletCategory = catalogue.filter((product) => product.category === "anklets");
    const store = repository();

    let lastOutcome: Awaited<ReturnType<typeof store.updateProduct>> | null = null;

    for (const product of onlyAnkletCategory) {
      const fresh = await store.getProduct(product.id);
      if (fresh === null) continue;
      const edit = editFrom(fresh);
      edit.status = "draft";
      lastOutcome = await store.updateProduct({
        id: fresh.id,
        edit,
        expectedVersion: computeProductVersion(fresh),
      });
    }

    expect(lastOutcome).toMatchObject({ kind: "REJECTED", error: "VALIDATION_FAILED" });
    expect(lastOutcome?.kind === "REJECTED" && lastOutcome.failures.join(" ")).toContain(
      'category "anklets" is surfaced but has no published products',
    );
  });

  /**
   * A pre-existing advisory belongs to whoever wrote it, not to whoever next edits the record.
   * Four descriptions in the catalogue are outside the house word range and the gate prints them
   * as advisories; none of them may block an unrelated price change.
   */
  it("does not refuse an edit for a rule the catalogue was already breaking", async () => {
    const catalogue = readCatalogueFromDisk();
    const shortDescription = catalogue.find(
      (product) => product.description.trim().split(/\s+/).length < 150,
    );

    expect(shortDescription).toBeDefined();
    if (shortDescription === undefined) return;

    const edit = editFrom(shortDescription);
    edit.pricing = { ...edit.pricing, cost: shortDescription.pricing.cost + 1 };

    const outcome = await repository().updateProduct({
      id: shortDescription.id,
      edit,
      expectedVersion: computeProductVersion(shortDescription),
    });

    expect(outcome.kind).toBe("UPDATED");
  });
});

describe("JsonFileProductRepository concurrency", () => {
  it("refuses a save whose record moved on disk after the form was rendered", async () => {
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.name = `${current.name} II`;

    const outcome = await repository().updateProduct({
      id: current.id,
      edit,
      expectedVersion: "0000000000000000",
    });

    expect(outcome).toMatchObject({ kind: "REJECTED", error: "CONCURRENT_CHANGE" });
  });

  it("does not clobber a second edit made between the render and the save", async () => {
    const store = repository();
    const [original] = readCatalogueFromDisk();
    const staleVersion = computeProductVersion(original);

    const firstEdit = editFrom(original);
    firstEdit.pricing = { ...firstEdit.pricing, cost: original.pricing.cost + 1 };
    const first = await store.updateProduct({
      id: original.id,
      edit: firstEdit,
      expectedVersion: staleVersion,
    });
    expect(first.kind).toBe("UPDATED");

    const secondEdit = editFrom(original);
    secondEdit.name = `${original.name} II`;
    const second = await store.updateProduct({
      id: original.id,
      edit: secondEdit,
      expectedVersion: staleVersion,
    });

    expect(second).toMatchObject({ kind: "REJECTED", error: "CONCURRENT_CHANGE" });

    const saved = await store.getProduct(original.id);
    expect(saved?.pricing.cost).toBe(original.pricing.cost + 1);
    expect(saved?.name).toBe(original.name);
  });

  it("gives two different products two different versions", async () => {
    const [first, second] = readCatalogueFromDisk();
    expect(computeProductVersion(first)).not.toBe(computeProductVersion(second));
  });
});

describe("JsonFileProductRepository when catalogue writes are disabled", () => {
  it("refuses the write and says why, rather than reporting a save that did nothing", async () => {
    const before = readFileSync(cataloguePath(), "utf8");
    const [current] = readCatalogueFromDisk();
    const edit = editFrom(current);
    edit.name = `${current.name} II`;

    const outcome = await repository({ writesEnabled: () => false }).updateProduct({
      id: current.id,
      edit,
      expectedVersion: computeProductVersion(current),
    });

    expect(outcome).toMatchObject({ kind: "REJECTED", error: "WRITES_DISABLED" });
    expect(outcome.kind === "REJECTED" && outcome.message).toContain("commit and a redeploy");
    expect(readFileSync(cataloguePath(), "utf8")).toBe(before);
  });
});

describe("applyProductEdit", () => {
  it("carries through the fields this surface may not change", async () => {
    const catalogue = readCatalogueFromDisk();
    const migrated = catalogue.find((product) => product.migrationProvenance !== undefined);

    expect(migrated).toBeDefined();
    if (migrated === undefined) return;

    const edit = editFrom(migrated);
    edit.name = "Something Else Entirely";

    const updated = applyProductEdit(migrated, edit);

    expect(updated.id).toBe(migrated.id);
    expect(updated.media.images).toEqual(migrated.media.images);
    expect(updated.migrationProvenance).toEqual(migrated.migrationProvenance);
    expect(updated.collections).toEqual(migrated.collections);
  });

  it("omits an optional key rather than writing it empty", async () => {
    const catalogue = readCatalogueFromDisk();
    const optioned = catalogue.find((product) => product.options !== undefined);

    expect(optioned).toBeDefined();
    if (optioned === undefined) return;

    const edit = editFrom(optioned);
    edit.options = [];
    edit.variantImages = {};
    edit.subcategory = "   ";

    const updated = applyProductEdit(optioned, edit);

    expect(Object.keys(updated)).not.toContain("options");
    expect(Object.keys(updated)).not.toContain("subcategory");
    expect(Object.keys(updated.media)).not.toContain("variantImages");
  });

  it("writes keys in the order the catalogue already uses", async () => {
    const catalogue = readCatalogueFromDisk();
    const sample = catalogue.find((product) => product.migrationProvenance !== undefined);

    expect(sample).toBeDefined();
    if (sample === undefined) return;

    expect(Object.keys(applyProductEdit(sample, editFrom(sample)))).toEqual(Object.keys(sample));
  });
});
