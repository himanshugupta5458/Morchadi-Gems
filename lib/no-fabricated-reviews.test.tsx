/** @vitest-environment jsdom */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "@/app/product/[id]/page";
import { getAllProducts, getCatalogueIndex, getProductById } from "@/lib/products";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { PRODUCT_OPEN_GRAPH_TYPE } from "@/lib/metadata";
import { buildProductBreadcrumb } from "@/lib/breadcrumbs";
import { buildProductSchemaGraph, buildSiteSchemaGraph } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const previousAppBaseUrl = process.env.APP_BASE_URL;

beforeEach(() => {
  process.env.APP_BASE_URL = "https://www.morchadigems.com";
});

afterEach(() => {
  cleanup();
  if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = previousAppBaseUrl;
});

/**
 * Every file a browser is served markup from. Scanned as text rather than rendered, because
 * the point is that no route and no component can quietly reintroduce a star or a review
 * body — including ones no test renders. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 */
function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return entry.name.endsWith(".tsx") || entry.name.endsWith(".ts") ? [path] : [];
  });
}

const RENDERED_SOURCE_FILES = [
  ...collectSourceFiles("app"),
  ...collectSourceFiles("components"),
];

const REMOVED_MODULES = [
  "StarRating",
  "ProductReviews",
  "TestimonialBand",
  "TestimonialCard",
  "TestimonialCarousel",
  "Monogram",
  "getTestimonials",
];

describe("the catalogue after the fabricated reviews were removed", () => {
  it("carries no rating and no review field on any of the 49 records", () => {
    const rawCatalogue = readFileSync("data/products.json", "utf8");

    expect(rawCatalogue).not.toContain('"rating"');
    expect(rawCatalogue).not.toContain('"reviews"');
    for (const product of getAllProducts()) {
      expect(product, product.id).not.toHaveProperty("rating");
      expect(product, product.id).not.toHaveProperty("reviews");
    }
  });

  it("has no testimonial data file left to render", () => {
    expect(() => readFileSync("data/testimonials.json", "utf8")).toThrow();
  });
});

describe("the markup a shopper and a crawler are served", () => {
  it("imports none of the modules that rendered fabricated reviews", () => {
    for (const file of RENDERED_SOURCE_FILES) {
      const source = readFileSync(file, "utf8");
      for (const removed of REMOVED_MODULES) {
        expect(source, `${file} still references ${removed}`).not.toContain(removed);
      }
    }
  });

  it("puts no star rating on a product card", () => {
    const [product] = getAllProducts();
    const { container } = render(
      <CartProvider catalogue={getCatalogueIndex()}>
        <ToastProvider>
          <ProductCard product={product} />
        </ToastProvider>
      </CartProvider>,
    );

    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).not.toMatch(/review/i);
    expect(container.textContent).toContain(product.name);
  });
});

describe("the emitted JSON-LD", () => {
  function serialisedGraphOf(script: Element): string {
    return script.innerHTML;
  }

  it("carries no aggregateRating and no review on any product page", () => {
    for (const product of getAllProducts()) {
      const { container } = render(
        <JsonLd
          id={`product-schema-${product.id}`}
          graph={buildProductSchemaGraph(product, buildProductBreadcrumb(product))}
        />,
      );
      const script = container.querySelector("script");
      if (script === null) throw new Error("No JSON-LD script was rendered");

      const emitted = serialisedGraphOf(script);
      expect(emitted, product.id).not.toContain("aggregateRating");
      expect(emitted, product.id).not.toContain("AggregateRating");
      expect(emitted, product.id).not.toContain("Review");
      expect(emitted, product.id).not.toContain("Rating");
      cleanup();
    }
  });

  it("carries no review vocabulary in the site-wide graph either", () => {
    const { container } = render(
      <JsonLd id="site-schema" graph={buildSiteSchemaGraph()} />,
    );
    const script = container.querySelector("script");
    if (script === null) throw new Error("No JSON-LD script was rendered");

    const emitted = serialisedGraphOf(script);
    expect(emitted).not.toContain("aggregateRating");
    expect(emitted).not.toContain("Review");
    expect(emitted).not.toContain("Rating");
  });
});

describe("the Open Graph type of a product page", () => {
  it("says product rather than website", () => {
    const [product] = getAllProducts();
    const metadata = generateMetadata({ params: { id: product.id } });

    expect(metadata.other).toEqual({ "og:type": "product" });
    expect(PRODUCT_OPEN_GRAPH_TYPE).toBe("product");
  });

  it("declares that type once, not alongside a competing website type", () => {
    const [product] = getAllProducts();
    const metadata = generateMetadata({ params: { id: product.id } });

    expect(metadata.openGraph).not.toHaveProperty("type");
  });

  it("keeps the rest of the Open Graph block, which a page must restate in full", () => {
    const product = getProductById("P001");
    if (product === undefined) throw new Error("Fixture product P001 is missing");
    const metadata = generateMetadata({ params: { id: product.id } });

    expect(metadata.openGraph?.siteName).toBe("Morchadi Gems");
    expect(metadata.openGraph?.url).toBe("/product/P001");
    expect(metadata.openGraph?.images).toHaveLength(1);
  });
});
