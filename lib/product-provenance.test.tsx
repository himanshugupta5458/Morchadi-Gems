/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getCatalogueIndex, toCatalogueEntry } from "@/lib/products";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { ProductCard } from "@/components/ProductCard";
import type { Product, ProductMigrationProvenance } from "@/types/product";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

const PROVENANCE: ProductMigrationProvenance = {
  originalId: "1002",
  originalSku: "MG-ODOO-1002",
  originalUrl: "https://old-shop.example/product/bow-ring-1002",
  originalCategories: ["Jewellery", "Rings", "Adjustable"],
};

/**
 * Every string in the provenance block, as one list. A test that only checked for the key
 * `migrationProvenance` would pass while the old shop's URL sat in the markup under some other
 * name, so the values are what is searched for as well as the field names.
 */
const PROVENANCE_STRINGS = [
  "migrationProvenance",
  PROVENANCE.originalId,
  PROVENANCE.originalSku,
  PROVENANCE.originalUrl,
  ...PROVENANCE.originalCategories,
] as string[];

function migratedProduct(): Product {
  return {
    id: "P901",
    name: "Cubic Zirconia Bow Ring",
    category: "rings",
    subcategory: "solitaire stackers",
    status: "active",
    pricing: { price: 210, mrp: 299, cost: 126, minPrepaidAmount: 0 },
    media: { images: ["/products/P901.webp"] },
    specs: { material: "Gold-plated brass", type: "Adjustable open band" },
    description: "A gold-tone band carrying a small cubic zirconia bow, open at the back.",
    seo: {
      primaryKeyword: "gold-plated bow ring",
      secondaryKeywords: [],
      metaTitle: "Gold-Plated Bow Ring on an Adjustable Band",
      metaDescription: "A gold-plated bow ring on an adjustable band, set with cubic zirconia.",
      imageAlt: "Gold-tone adjustable band ring topped with a cubic zirconia bow",
      ogTitle: "Adjustable Bow Ring in Gold Tone",
      ogDescription: "A gold-plated band topped with a little cubic zirconia bow.",
      ogImage: "/products/P901.webp",
    },
    stock: { inStock: true, quantity: 10 },
    flags: { featured: false, isNew: true, badge: null },
    migrationProvenance: PROVENANCE,
  };
}

function renderCard() {
  return render(
    <CartProvider catalogue={getCatalogueIndex()}>
      <ToastProvider>
        <ProductCard product={migratedProduct()} />
      </ToastProvider>
    </CartProvider>,
  );
}

describe("a product carrying migration provenance", () => {
  it("renders as any other product does", () => {
    const { container } = renderCard();

    expect(container.textContent).toContain("Cubic Zirconia Bow Ring");
    expect(container.textContent).toContain("210");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe(
      migratedProduct().seo.imageAlt,
    );
  });

  it("renders none of its provenance, and none of its subcategory, into the markup", () => {
    const { container } = renderCard();
    const markup = container.innerHTML;

    for (const value of PROVENANCE_STRINGS) expect(markup).not.toContain(value);
    expect(markup).not.toContain("solitaire stackers");
  });
});

/**
 * `toCatalogueEntry` is the only catalogue shape that crosses into a client bundle, and its
 * whitelist is what keeps `pricing.cost` out of a browser. ADR-056 put two more fields behind
 * the same whitelist, so these are the assertions that say so — and the reason the whitelist is
 * checked by its *whole* key set rather than by two `not.toHaveProperty` lines is that a field
 * added to `Product` tomorrow should have to be named here before it can reach a browser.
 */
describe("the client-facing catalogue entry", () => {
  const CATALOGUE_ENTRY_KEYS = [
    "category",
    "id",
    "image",
    "inStock",
    "mrp",
    "name",
    "options",
    "price",
    "variantImages",
  ];

  it("carries only the fields a cart line needs", () => {
    const entry = toCatalogueEntry(migratedProduct());

    expect(Object.keys(entry).every((key) => CATALOGUE_ENTRY_KEYS.includes(key))).toBe(true);
  });

  it("drops migrationProvenance and subcategory, by name and by value", () => {
    const serialised = JSON.stringify(toCatalogueEntry(migratedProduct()));

    for (const value of PROVENANCE_STRINGS) expect(serialised).not.toContain(value);
    expect(serialised).not.toContain("subcategory");
    expect(serialised).not.toContain("solitaire stackers");
  });

  it("drops them from the real catalogue index too, alongside cost", () => {
    const serialised = JSON.stringify(getCatalogueIndex());

    expect(serialised).not.toContain("migrationProvenance");
    expect(serialised).not.toContain("subcategory");
    expect(serialised).not.toContain("cost");
  });
});

/**
 * The source-level half of the seal. The other half is empirical and cannot run here: a real
 * `next build` followed by a grep of `.next/static` and the prerendered HTML, recorded in
 * `docs/testing/RESULT-2026-08-23-image-confirmation-provenance-and-draft-similarity.md`. This
 * check is the one that runs on every commit, and it fails the moment a Client Component names
 * the field — which is the only way the build grep could ever start finding it.
 */
describe("no Client Component may name the provenance block", () => {
  const CLIENT_FILES = [
    "components/AddToCartButton.tsx",
    "components/CartLineItem.tsx",
    "components/CartSummary.tsx",
    "components/CartView.tsx",
    "components/ProductPurchaseActions.tsx",
    "components/ProductPurchasePanel.tsx",
    "lib/cart-context.tsx",
    "lib/product-selection.tsx",
  ];

  it.each(CLIENT_FILES)("%s does not mention migrationProvenance", (relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");

    expect(source).toContain('"use client"');
    expect(source).not.toContain("migrationProvenance");
  });
});
