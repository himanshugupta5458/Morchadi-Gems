import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  ADMIN_PRODUCT_VIEWS,
  buildAdminProductsHref,
  hasActiveAdminProductFilters,
  matchesAdminProductQuery,
  matchesAdminProductView,
  parseAdminProductQuery,
  selectAdminProductPage,
  toAdminProductRow,
  type AdminProductQuery,
} from "@/lib/admin-products";
import type { Product } from "@/types/product";

/**
 * The list is exercised against the real catalogue rather than a fixture. Its whole job is to make
 * 449 records findable, and the properties worth checking — that the views partition the file,
 * that pagination loses nothing, that a filter narrows rather than reorders — are only meaningful
 * at that size.
 *
 * Counts are derived from the file at run time, never written down. `EXPECTED_PRODUCT_COUNT` in
 * `scripts/validate-products.mjs` is deliberately the only hardcoded catalogue count in the
 * repository (the ADR-053 addendum), and a second one here would make adding a product a
 * two-file chore for no extra protection.
 */
const catalogue = JSON.parse(
  readFileSync(join(process.cwd(), "data", "products.json"), "utf8"),
) as Product[];

const PRODUCTS_PATH = "/admin/products";

function query(changes: Partial<AdminProductQuery> = {}): AdminProductQuery {
  return { ...parseAdminProductQuery({}), ...changes };
}

describe("parseAdminProductQuery", () => {
  it("defaults every field when the URL says nothing", () => {
    expect(parseAdminProductQuery({})).toEqual({
      view: "all",
      category: null,
      priceBand: null,
      flag: null,
      search: "",
      sort: "id",
      page: 1,
    });
  });

  it("reads a URL a person could have produced", () => {
    expect(
      parseAdminProductQuery({
        view: "out-of-stock",
        category: "rings",
        price: "under-999",
        flag: "featured",
        search: " bow ",
        sort: "price-high",
        page: "3",
      }),
    ).toEqual({
      view: "out-of-stock",
      category: "rings",
      priceBand: "under-999",
      flag: "featured",
      search: "bow",
      sort: "price-high",
      page: 3,
    });
  });

  /**
   * A URL gets hand-edited, bookmarked and truncated by chat clients, so nothing here may throw.
   */
  it("falls back rather than failing on anything it does not recognise", () => {
    expect(
      parseAdminProductQuery({
        view: "nonsense",
        category: "jewellery",
        price: "free",
        flag: "shiny",
        sort: "cheapest",
        page: "-4",
      }),
    ).toEqual({
      view: "all",
      category: null,
      priceBand: null,
      flag: null,
      search: "",
      sort: "id",
      page: 1,
    });
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseAdminProductQuery({ view: ["draft", "live"] }).view).toBe("draft");
  });

  it("caps a search term rather than scanning the catalogue against a kilobyte", () => {
    expect(parseAdminProductQuery({ search: "x".repeat(500) }).search).toHaveLength(60);
  });
});

describe("the four views partition the catalogue", () => {
  it("puts every record in exactly one of live, out-of-stock and draft", () => {
    for (const product of catalogue) {
      const matched = ADMIN_PRODUCT_VIEWS.filter(
        (view) => view !== "all" && matchesAdminProductView(product, view),
      );

      expect({ id: product.id, views: matched }).toEqual({ id: product.id, views: [matched[0]] });
    }
  });

  it("has All hold everything", () => {
    expect(catalogue.filter((product) => matchesAdminProductView(product, "all"))).toHaveLength(
      catalogue.length,
    );
  });

  it("adds up to the whole catalogue", () => {
    const counted = ADMIN_PRODUCT_VIEWS.filter((view) => view !== "all").reduce(
      (total, view) =>
        total + catalogue.filter((product) => matchesAdminProductView(product, view)).length,
      0,
    );

    expect(counted).toBe(catalogue.length);
  });

  it("calls a draft a draft whether or not it is in stock", () => {
    const draft: Product = {
      ...catalogue[0],
      status: "draft",
      stock: { inStock: true, quantity: 10 },
    };

    expect(matchesAdminProductView(draft, "draft")).toBe(true);
    expect(matchesAdminProductView(draft, "live")).toBe(false);
    expect(matchesAdminProductView(draft, "out-of-stock")).toBe(false);
  });

  it("finds the out-of-stock products the catalogue actually holds", () => {
    const outOfStock = catalogue.filter((product) =>
      matchesAdminProductView(product, "out-of-stock"),
    );

    expect(outOfStock.length).toBeGreaterThan(0);
    for (const product of outOfStock) {
      expect(product.stock.inStock).toBe(false);
      expect(product.status).not.toBe("draft");
    }
  });
});

describe("filters narrow the list to exactly what they name", () => {
  it("returns only the named category", () => {
    const page = selectAdminProductPage(catalogue, query({ category: "watches" }));

    expect(page.totalCount).toBe(
      catalogue.filter((product) => product.category === "watches").length,
    );
    for (const row of page.rows) expect(row.category).toBe("watches");
  });

  it("returns only products inside the named price band", () => {
    const page = selectAdminProductPage(catalogue, query({ priceBand: "above-999" }));

    expect(page.totalCount).toBeGreaterThan(0);
    for (const row of page.rows) expect(row.price).toBeGreaterThanOrEqual(1000);
  });

  it("returns only flagged products", () => {
    const featured = selectAdminProductPage(catalogue, query({ flag: "featured" }));

    expect(featured.totalCount).toBe(
      catalogue.filter((product) => product.flags.featured).length,
    );
    for (const row of featured.rows) expect(row.featured).toBe(true);
  });

  it("matches a search against the product code and the name, case-insensitively", () => {
    const byCode = selectAdminProductPage(catalogue, query({ search: "p00" }));
    expect(byCode.totalCount).toBeGreaterThan(0);
    for (const row of byCode.rows) expect(row.id.toLowerCase()).toContain("p00");

    const target = catalogue[0];
    const byName = selectAdminProductPage(
      catalogue,
      query({ search: target.name.toUpperCase() }),
    );
    expect(byName.rows.some((row) => row.id === target.id)).toBe(true);
  });

  it("ands the facets together rather than oring them", () => {
    const combined = query({ category: "rings", flag: "featured" });
    const page = selectAdminProductPage(catalogue, combined);

    expect(page.totalCount).toBe(
      catalogue.filter((product) => matchesAdminProductQuery(product, combined)).length,
    );
    for (const row of page.rows) {
      expect(row.category).toBe("rings");
      expect(row.featured).toBe(true);
    }
  });

  it("reports an impossible combination as empty rather than as everything", () => {
    const page = selectAdminProductPage(
      catalogue,
      query({ search: "no product is called this" }),
    );

    expect(page.totalCount).toBe(0);
    expect(page.rows).toEqual([]);
    expect(page.pageCount).toBe(1);
  });

  it("knows whether anything beyond the view is narrowing the list", () => {
    expect(hasActiveAdminProductFilters(query())).toBe(false);
    expect(hasActiveAdminProductFilters(query({ view: "draft" }))).toBe(false);
    expect(hasActiveAdminProductFilters(query({ category: "rings" }))).toBe(true);
    expect(hasActiveAdminProductFilters(query({ search: "bow" }))).toBe(true);
  });
});

describe("pagination loses nothing", () => {
  it("walks every product exactly once across its pages", () => {
    const first = selectAdminProductPage(catalogue, query());
    const seen: string[] = [];

    for (let page = 1; page <= first.pageCount; page += 1) {
      seen.push(...selectAdminProductPage(catalogue, query({ page })).rows.map((row) => row.id));
    }

    expect(seen).toHaveLength(catalogue.length);
    expect(new Set(seen).size).toBe(catalogue.length);
  });

  it("fills every page but the last", () => {
    const first = selectAdminProductPage(catalogue, query());

    expect(first.rows).toHaveLength(ADMIN_PRODUCTS_PAGE_SIZE);
    expect(first.pageCount).toBe(Math.ceil(catalogue.length / ADMIN_PRODUCTS_PAGE_SIZE));
  });

  it("clamps a page beyond the end rather than showing nothing", () => {
    const page = selectAdminProductPage(catalogue, query({ page: 9_999 }));

    expect(page.page).toBe(page.pageCount);
    expect(page.rows.length).toBeGreaterThan(0);
  });

  /**
   * Every comparator ends on the id, so two products sharing a price cannot swap places between
   * one page and the next and hide a row.
   */
  it("orders totally, so no sort can drop a product between pages", () => {
    for (const sort of ["id", "name", "price-high", "price-low"] as const) {
      const first = selectAdminProductPage(catalogue, query({ sort }));
      const seen = new Set<string>();

      for (let page = 1; page <= first.pageCount; page += 1) {
        for (const row of selectAdminProductPage(catalogue, query({ sort, page })).rows) {
          seen.add(row.id);
        }
      }

      expect({ sort, count: seen.size }).toEqual({ sort, count: catalogue.length });
    }
  });

  it("sorts by price in the direction it says", () => {
    const high = selectAdminProductPage(catalogue, query({ sort: "price-high" })).rows;
    const low = selectAdminProductPage(catalogue, query({ sort: "price-low" })).rows;

    expect(high[0].price).toBeGreaterThanOrEqual(high[high.length - 1].price);
    expect(low[0].price).toBeLessThanOrEqual(low[low.length - 1].price);
  });
});

describe("the row a list renders", () => {
  it("carries no cost, because margin data has no business in a list", () => {
    const row = toAdminProductRow(catalogue[0]);

    expect(row).not.toHaveProperty("cost");
    expect(JSON.stringify(row)).not.toContain("cost");
  });

  it("carries what the table actually shows", () => {
    const product = catalogue[0];
    const row = toAdminProductRow(product);

    expect(row).toMatchObject({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.pricing.price,
      inStock: product.stock.inStock,
      featured: product.flags.featured,
    });
  });
});

describe("buildAdminProductsHref", () => {
  it("keeps the unfiltered list at a clean path", () => {
    expect(buildAdminProductsHref(PRODUCTS_PATH, query())).toBe(PRODUCTS_PATH);
  });

  it("omits every default and writes only what is set", () => {
    expect(buildAdminProductsHref(PRODUCTS_PATH, query({ view: "draft", category: "rings" }))).toBe(
      `${PRODUCTS_PATH}?view=draft&category=rings`,
    );
  });

  it("resets to page one when a filter changes", () => {
    expect(
      buildAdminProductsHref(PRODUCTS_PATH, query({ page: 7 }), { category: "rings" }),
    ).toBe(`${PRODUCTS_PATH}?category=rings`);
  });

  it("keeps the filters when only the page changes", () => {
    expect(
      buildAdminProductsHref(PRODUCTS_PATH, query({ category: "rings" }), { page: 3 }),
    ).toBe(`${PRODUCTS_PATH}?category=rings&page=3`);
  });

  it("round-trips through the parser", () => {
    const original = query({
      view: "live",
      category: "watches",
      priceBand: "under-999",
      flag: "new",
      search: "bow",
      sort: "name",
      page: 4,
    });

    const href = buildAdminProductsHref(PRODUCTS_PATH, original);
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);

    expect(parseAdminProductQuery(params)).toEqual(original);
  });
});
