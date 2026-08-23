import { describe, expect, it } from "vitest";
import {
  PRODUCT_OPTION_TYPES,
  isCategory,
  isCollectionTag,
  isProductOptionType,
  type Product,
} from "@/types/product";
import { getAllProducts, getPrimaryImage, toCatalogueEntry } from "@/lib/products";
import { variantImageKey } from "@/lib/variant-images";

const catalogue = getAllProducts();

/**
 * Derived from the file rather than hardcoded. The count itself is asserted in exactly one
 * place, `EXPECTED_PRODUCT_COUNT` in `scripts/validate-products.mjs`; repeating it here only
 * meant a new product failed the gate in eight files at once. What this suite is for is the
 * per-product invariants below, each of which has to hold for however many pieces the owner
 * currently stocks. See the ADR-053 addendum.
 */
const CATALOGUE_SIZE = catalogue.length;

function optionedProducts(): Product[] {
  return catalogue.filter((product) => product.options !== undefined);
}

describe("the migrated catalogue", () => {
  it("holds only the owner's real pieces, each under a distinct P-code and no invented one", () => {
    expect(CATALOGUE_SIZE).toBeGreaterThan(0);
    for (const product of catalogue) expect(product.id).toMatch(/^P\d{3}$/);
    expect(new Set(catalogue.map((product) => product.id)).size).toBe(CATALOGUE_SIZE);
  });

  it("groups every product's money under pricing, as whole rupees", () => {
    for (const product of catalogue) {
      expect(Number.isInteger(product.pricing.price), product.id).toBe(true);
      expect(Number.isInteger(product.pricing.mrp), product.id).toBe(true);
      expect(product.pricing.price, product.id).toBeGreaterThan(0);
      expect(product.pricing.mrp, product.id).toBeGreaterThanOrEqual(product.pricing.price);
    }
  });

  it("groups every product's pictures under media, keyed to its id", () => {
    for (const product of catalogue) {
      expect(product.media.images[0], product.id).toBe(`/products/${product.id}.webp`);
      for (const image of product.media.images.slice(1)) {
        expect(image, product.id).toMatch(
          new RegExp(`^/products/${product.id}-.+\\.webp$`),
        );
      }
    }
  });

  it("gives every product an open specs object with at least one entry", () => {
    for (const product of catalogue) {
      const entries = Object.entries(product.specs);
      expect(entries.length, product.id).toBeGreaterThan(0);
      for (const [key, value] of entries) {
        expect(key, product.id).toBe(key.toLowerCase());
        expect(typeof value, `${product.id}.${key}`).toBe("string");
        expect(value.length, `${product.id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("groups availability under stock and flags", () => {
    for (const product of catalogue) {
      expect(typeof product.stock.inStock, product.id).toBe("boolean");
      expect(typeof product.flags.featured, product.id).toBe("boolean");
      expect(typeof product.flags.isNew, product.id).toBe("boolean");
    }
  });

  it("carries no rating and no review on any record", () => {
    for (const product of catalogue) {
      expect(product, product.id).not.toHaveProperty("rating");
      expect(product, product.id).not.toHaveProperty("reviews");
    }
  });

  it("keeps every category and collection slug known", () => {
    for (const product of catalogue) {
      expect(isCategory(product.category), product.id).toBe(true);
      for (const slug of product.collections ?? []) {
        expect(isCollectionTag(slug), product.id).toBe(true);
      }
    }
  });

  it("carries a description rather than the old shortDescription", () => {
    for (const product of catalogue) {
      expect(product.description.length, product.id).toBeGreaterThan(0);
      expect(product, product.id).not.toHaveProperty("shortDescription");
      expect(product, product.id).not.toHaveProperty("details");
      expect(product, product.id).not.toHaveProperty("price");
      expect(product, product.id).not.toHaveProperty("images");
    }
  });
});

describe("the option groups", () => {
  it("names a control type the app can render, with a default it offers", () => {
    for (const product of optionedProducts()) {
      for (const option of product.options ?? []) {
        expect(isProductOptionType(option.type), `${product.id}: ${option.name}`).toBe(
          true,
        );
        expect(option.values.length, `${product.id}: ${option.name}`).toBeGreaterThan(0);
        expect(option.values, `${product.id}: ${option.name}`).toContain(option.default);
      }
    }
  });

  it("uses each control type where the catalogue says it should", () => {
    const typeByProduct = new Map(
      optionedProducts().map((product) => [
        product.id,
        (product.options ?? []).map((option) => `${option.name}:${option.type}`),
      ]),
    );

    expect(typeByProduct.get("P001")).toEqual(["Letter:dropdown"]);
    expect(typeByProduct.get("P005")).toEqual(["Letter:dropdown"]);
    expect(typeByProduct.get("P006")).toEqual(["Shape:chips"]);
    expect(typeByProduct.get("P010")).toEqual(["Colour:swatch"]);
    expect(typeByProduct.get("P048")).toEqual(["Colour:swatch"]);
  });

  it("declares four control types, so every one has somewhere to be used", () => {
    expect(PRODUCT_OPTION_TYPES).toEqual(["dropdown", "swatch", "pills", "chips"]);
  });
});

describe("the per-variant images", () => {
  it("keys every mapping to an option value the product actually offers", () => {
    for (const product of catalogue) {
      for (const key of Object.keys(product.media.variantImages ?? {})) {
        const group = (product.options ?? []).find((option) =>
          key.startsWith(`${option.name}:`),
        );

        expect(group, `${product.id}: ${key}`).toBeDefined();
        const offered = (group?.values ?? []).map((value) =>
          variantImageKey(group?.name ?? "", value),
        );
        expect(offered, `${product.id}: ${key}`).toContain(key);
      }
    }
  });

  it("gives P010 a golden photograph and leaves silver on the product's own", () => {
    const watchRing = catalogue.find((product) => product.id === "P010");

    expect(watchRing?.media.variantImages).toEqual({
      "Colour:Golden": "/products/P010-golden.webp",
    });
    expect(getPrimaryImage(watchRing as Product)).toBe("/products/P010.webp");
  });

  it("leaves the products with one configuration mapping nothing at all", () => {
    const mapped = catalogue.filter(
      (product) => product.media.variantImages !== undefined,
    );

    expect(mapped.map((product) => product.id)).toEqual(["P010"]);
  });
});

describe("the multi-image products", () => {
  it("gives exactly one product a second view, so the strip has something to strip", () => {
    const multiImage = catalogue.filter((product) => product.media.images.length > 1);

    expect(multiImage.map((product) => product.id)).toEqual(["P002"]);
    expect(multiImage[0].media.images).toEqual([
      "/products/P002.webp",
      "/products/P002-2.webp",
    ]);
  });

  it("leaves every other product on a single image", () => {
    const multiImage = catalogue.filter((product) => product.media.images.length > 1);
    const singleImage = catalogue.filter(
      (product) => product.media.images.length === 1,
    );

    expect(singleImage).toHaveLength(CATALOGUE_SIZE - multiImage.length);
  });
});

describe("toCatalogueEntry", () => {
  it("flattens the grouped record into what a cart line needs", () => {
    const ring = catalogue.find((product) => product.id === "P001") as Product;
    const entry = toCatalogueEntry(ring);

    expect(entry).toMatchObject({
      id: "P001",
      name: ring.name,
      price: ring.pricing.price,
      mrp: ring.pricing.mrp,
      image: "/products/P001.webp",
      inStock: ring.stock.inStock,
    });
    expect(entry.options?.[0].type).toBe("dropdown");
  });

  it("carries the variant mapping only for the product that has one", () => {
    const withVariants = toCatalogueEntry(
      catalogue.find((product) => product.id === "P010") as Product,
    );
    const withoutVariants = toCatalogueEntry(
      catalogue.find((product) => product.id === "P001") as Product,
    );

    expect(withVariants.variantImages).toEqual({
      "Colour:Golden": "/products/P010-golden.webp",
    });
    expect(withoutVariants).not.toHaveProperty("variantImages");
  });

  it("carries no description, specs or reviews across the server boundary", () => {
    for (const product of catalogue) {
      const entry = toCatalogueEntry(product);

      expect(entry).not.toHaveProperty("description");
      expect(entry).not.toHaveProperty("specs");
      expect(entry).not.toHaveProperty("reviews");
      expect(entry).not.toHaveProperty("rating");
    }
  });
});
