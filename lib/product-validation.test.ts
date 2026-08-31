import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createProductRuleContext,
  validateCatalogueFloors,
  validateCatalogueSeoUniqueness,
  validateProductRecord,
} from "@/scripts/product-record-rules.mjs";
import { validateCatalogue, validateCatalogueForEdit } from "@/lib/product-validation";
import type { Product } from "@/types/product";

/**
 * These rules are the gate's rules. The point of every case below is not that some validator
 * rejects a bad record — it is that *this* validator is the one `npm run validate:products`
 * runs, so an edit the admin panel accepts is an edit the build accepts. See
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */

const REPOSITORY_ROOT = process.cwd();
const catalogue = JSON.parse(
  readFileSync(join(REPOSITORY_ROOT, "data", "products.json"), "utf8"),
) as Product[];

function contextOverRealFiles(): ReturnType<typeof createProductRuleContext> {
  return createProductRuleContext({ existsUnderPublic: () => true });
}

function failuresFor(product: unknown): string[] {
  const context = contextOverRealFiles();
  validateProductRecord(product, "P001", context);
  return context.failures;
}

function edited(changes: (product: Product) => Product): Product[] {
  return catalogue.map((product, index) => (index === 0 ? changes(product) : product));
}

describe("the shipped catalogue passes the rules the admin panel enforces", () => {
  it("has no failures", () => {
    expect(validateCatalogue(catalogue).failures).toEqual([]);
  });

  it("is reported as valid overall", () => {
    expect(validateCatalogue(catalogue).ok).toBe(true);
  });
});

describe("record-level rules", () => {
  const [sample] = catalogue;

  it("accepts a record exactly as the catalogue stores it", () => {
    expect(failuresFor(sample)).toEqual([]);
  });

  it("refuses a price that is not a positive whole number of rupees", () => {
    for (const price of [0, -10, 210.5, "210"]) {
      const failures = failuresFor({ ...sample, pricing: { ...sample.pricing, price } });
      expect(failures.join(" ")).toContain("pricing.price must be a positive whole number");
    }
  });

  it("accepts a minPrepaidAmount of zero and refuses a fractional one", () => {
    expect(
      failuresFor({ ...sample, pricing: { ...sample.pricing, minPrepaidAmount: 0 } }),
    ).toEqual([]);

    expect(
      failuresFor({
        ...sample,
        pricing: { ...sample.pricing, minPrepaidAmount: 10.5 },
      }).join(" "),
    ).toContain("pricing.minPrepaidAmount must be a whole number");
  });

  it("refuses an mrp below the price", () => {
    expect(
      failuresFor({
        ...sample,
        pricing: { ...sample.pricing, mrp: sample.pricing.price - 1 },
      }).join(" "),
    ).toContain("is below pricing.price");
  });

  it("refuses a karat claim wherever a shopper would read it", () => {
    expect(failuresFor({ ...sample, name: "18K Gold Ring" }).join(" ")).toContain(
      "makes a precious-metal claim",
    );
    expect(
      failuresFor({ ...sample, specs: { ...sample.specs, note: "sterling silver" } }).join(" "),
    ).toContain("makes a precious-metal claim");
  });

  it("refuses a bare precious metal in a material-family spec", () => {
    expect(
      failuresFor({ ...sample, specs: { ...sample.specs, material: "Rose gold" } }).join(" "),
    ).toContain("a precious metal named with no plating, tone, finish or coating qualifier");
  });

  it("accepts the same metal once it is qualified", () => {
    expect(
      failuresFor({ ...sample, specs: { ...sample.specs, material: "Rose gold-plated brass" } }),
    ).toEqual([]);
  });

  it("holds meta copy to the lengths a search result renders", () => {
    expect(
      failuresFor({ ...sample, seo: { ...sample.seo, metaTitle: "Too short" } }).join(" "),
    ).toContain("seo.metaTitle is 9 characters");
  });

  it("refuses an unknown key on the record", () => {
    expect(failuresFor({ ...sample, discountPercent: 20 }).join(" ")).toContain("unknown keys");
  });

  it("refuses a rating or a review this store never collected", () => {
    expect(failuresFor({ ...sample, rating: 4.5 }).join(" ")).toContain("rating must not be");
    expect(failuresFor({ ...sample, reviews: [] }).join(" ")).toContain("reviews must not be");
  });

  it("refuses a stock quantity that is not a whole count", () => {
    for (const quantity of [-1, 2.5, "10", null, undefined]) {
      expect(
        failuresFor({ ...sample, stock: { ...sample.stock, quantity } }).join(" "),
        String(quantity),
      ).toContain("stock.quantity must be a whole number of pieces, zero or more");
    }
  });

  it("accepts a stock quantity of zero, which is how sold out is written down", () => {
    expect(failuresFor({ ...sample, stock: { inStock: false, quantity: 0 } })).toEqual([]);
  });

  it("refuses a badge outside the vocabulary, and a missing one", () => {
    for (const badge of ["featured", "sale", "", undefined]) {
      expect(
        failuresFor({ ...sample, flags: { ...sample.flags, badge } }).join(" "),
        String(badge),
      ).toContain("flags.badge must be null or one of trending, bestseller, new");
    }
  });

  it("accepts each badge the owner may choose, and null for none", () => {
    for (const badge of [null, "trending", "bestseller", "new"]) {
      expect(failuresFor({ ...sample, flags: { ...sample.flags, badge } })).toEqual([]);
    }
  });

  it("refuses a status outside the vocabulary", () => {
    expect(failuresFor({ ...sample, status: "archived" }).join(" ")).toContain(
      "status must be one of draft, active",
    );
  });

  it("refuses a variant image keyed to an option the product does not offer", () => {
    const failures = failuresFor({
      ...sample,
      media: { ...sample.media, variantImages: { "Colour:Puce": `/products/${sample.id}-x.webp` } },
    });

    expect(failures.join(" ")).toContain("which this product does not have");
  });
});

describe("catalogue-level rules a single record cannot see", () => {
  it("catches two products claiming one primary keyword", () => {
    const context = contextOverRealFiles();
    const clashing = edited((product) => ({
      ...product,
      seo: { ...product.seo, primaryKeyword: catalogue[1].seo.primaryKeyword },
    }));

    validateCatalogueSeoUniqueness(clashing, context);

    expect(context.failures.join(" ")).toContain("shares its seo.primaryKeyword");
  });

  it("catches two products claiming one meta title", () => {
    const context = contextOverRealFiles();
    const clashing = edited((product) => ({
      ...product,
      seo: { ...product.seo, metaTitle: catalogue[1].seo.metaTitle },
    }));

    validateCatalogueSeoUniqueness(clashing, context);

    expect(context.failures.join(" ")).toContain("shares its seo.metaTitle");
  });

  it("catches a duplicate id", () => {
    const context = contextOverRealFiles();
    validateProductRecord(catalogue[0], catalogue[0].id, context);
    validateProductRecord(catalogue[0], catalogue[0].id, context);

    expect(context.failures.join(" ")).toContain("duplicate id");
  });

  it("catches a merchandising row emptied by unfeaturing everything", () => {
    const context = contextOverRealFiles();

    for (const product of catalogue) {
      validateProductRecord(
        { ...product, flags: { ...product.flags, featured: false } },
        product.id,
        context,
      );
    }
    validateCatalogueFloors(context);

    expect(context.failures.join(" ")).toContain(
      "expected at least 4 featured products to fill the home best-sellers row",
    );
  });
});

describe("validateCatalogueForEdit attributes failures to the edit that caused them", () => {
  it("separates the edited record's failures from the rest", () => {
    const broken = edited((product) => ({
      ...product,
      pricing: { ...product.pricing, price: 0 },
    }));

    const result = validateCatalogueForEdit(broken, catalogue[0].id, []);

    expect(result.ok).toBe(false);
    expect(result.productFailures.join(" ")).toContain("pricing.price");
    expect(result.catalogueFailures).toEqual([]);
  });

  it("reports a broken floor even though it names no product id", () => {
    const unfeatured = catalogue.map((product) => ({
      ...product,
      flags: { ...product.flags, featured: false },
    }));

    const result = validateCatalogueForEdit(unfeatured, catalogue[0].id, []);

    expect(result.ok).toBe(false);
    expect(result.catalogueFailures.join(" ")).toContain("featured products");
  });

  /**
   * The baseline is what stops a catalogue that is already failing for an unrelated reason from
   * making every product uneditable until somebody else fixes it.
   */
  it("ignores a failure the catalogue already had before the edit", () => {
    const alreadyBroken = catalogue.map((product, index) =>
      index === 5 ? { ...product, pricing: { ...product.pricing, price: 0 } } : product,
    );
    const baseline = validateCatalogue(alreadyBroken).failures;

    expect(baseline.length).toBeGreaterThan(0);

    const withUnrelatedEdit = alreadyBroken.map((product, index) =>
      index === 0 ? { ...product, name: `${product.name} II` } : product,
    );

    expect(validateCatalogueForEdit(withUnrelatedEdit, catalogue[0].id, baseline).ok).toBe(true);
  });
});

/**
 * The structural guarantee behind all of the above: the gate does not carry a second copy of
 * these rules that could drift from the one the panel calls.
 */
describe("the gate and the panel share one implementation", () => {
  const gateSource = readFileSync(
    join(REPOSITORY_ROOT, "scripts", "validate-products.mjs"),
    "utf8",
  );

  it("has the gate import the shared rules module", () => {
    expect(gateSource).toContain('from "./product-record-rules.mjs"');
  });

  it("leaves the gate with no validate function of its own", () => {
    expect(gateSource).not.toMatch(/^function validate/m);
  });

  it("has the panel's wrapper import the same module", () => {
    const wrapperSource = readFileSync(
      join(REPOSITORY_ROOT, "lib", "product-validation.ts"),
      "utf8",
    );

    expect(wrapperSource).toContain('from "@/scripts/product-record-rules.mjs"');
  });
});
