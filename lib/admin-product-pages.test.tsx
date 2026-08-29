import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ADMIN_PRODUCTS_PAGE_SIZE, matchesAdminProductView } from "@/lib/admin-products";
import type { Product } from "@/types/product";

/**
 * The two product screens, rendered as Server Components against the real catalogue.
 *
 * `lib/admin-products.test.ts` already proves the query layer returns the right *set* of records.
 * What it cannot prove is that the pages render them — a page could compute a correct result and
 * then show the empty state, and every test in that file would still pass. These read the markup.
 *
 * The failure case is here for the reason CLAUDE.md gives: anything that reads a store must have a
 * deliberate answer to "what happens when it is not there", and an empty list is never that
 * answer. See [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md).
 */

const catalogue = JSON.parse(
  readFileSync(join(process.cwd(), "data", "products.json"), "utf8"),
) as Product[];

/** Flipped by a test to make the repository fail the way a malformed file would. */
const readState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("@/lib/product-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-repository")>();
  const real = new actual.JsonFileProductRepository();

  return {
    ...actual,
    productRepository: {
      listProducts: async () => {
        if (readState.shouldFail) throw new Error("data/products.json is not valid JSON");
        return real.listProducts();
      },
      getProduct: async (id: string) => {
        if (readState.shouldFail) throw new Error("data/products.json is not valid JSON");
        return real.getProduct(id);
      },
      updateProduct: real.updateProduct.bind(real),
    },
  };
});

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : null),
  }),
}));

class NotFoundSignal extends Error {}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal("not found");
  },
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CATALOGUE_ERROR_HEADING = "The catalogue could not be read";

let silencedErrors: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  silencedErrors.mockRestore();
});

beforeEach(() => {
  readState.shouldFail = false;
});

async function renderList(
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<string> {
  const { default: AdminProductsPage } = await import(
    "@/app/admin/(protected)/products/page"
  );
  return renderToStaticMarkup(await AdminProductsPage({ searchParams }));
}

async function renderDetail(id: string): Promise<string> {
  const { default: AdminProductPage } = await import(
    "@/app/admin/(protected)/products/[id]/page"
  );
  return renderToStaticMarkup(await AdminProductPage({ params: { id } }));
}

function countOccurrences(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

describe("the product list renders the real catalogue", () => {
  it("shows a full first page and says how much of the catalogue that is", async () => {
    const markup = await renderList();

    expect(markup).toContain(`Showing 1–${ADMIN_PRODUCTS_PAGE_SIZE} of ${catalogue.length}`);
    expect(markup).toContain("Products");
  });

  it("links every row on the page to its own detail page", async () => {
    const markup = await renderList();
    const firstPageIds = [...catalogue]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, ADMIN_PRODUCTS_PAGE_SIZE)
      .map((product) => product.id);

    for (const id of firstPageIds) {
      expect(markup).toContain(`/admin/products/${id}`);
    }
  });

  it("puts the count on each tab that the view actually holds", async () => {
    const markup = await renderList();

    for (const view of ["live", "out-of-stock", "draft"] as const) {
      const count = catalogue.filter((product) => matchesAdminProductView(product, view)).length;
      expect(markup).toContain(`>${count}</span>`);
    }
  });

  /**
   * Checked against the *rows* rather than against the markup as a whole: every category name
   * appears on this page regardless, because the filter dropdown lists all eleven of them.
   */
  it("renders only the filtered category's rows", async () => {
    const markup = await renderList({ category: "watches" });
    const watches = catalogue.filter((product) => product.category === "watches");
    const others = catalogue.filter((product) => product.category !== "watches");

    expect(markup).toContain(`of ${watches.length}`);

    for (const product of others) {
      expect(countOccurrences(markup, `/admin/products/${product.id}"`)).toBe(0);
    }
    const firstPage = [...watches]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, ADMIN_PRODUCTS_PAGE_SIZE);

    for (const product of firstPage) {
      expect(markup).toContain(`/admin/products/${product.id}"`);
    }
  });

  it("renders the out-of-stock view as the products that are genuinely out of stock", async () => {
    const markup = await renderList({ view: "out-of-stock" });
    const outOfStock = catalogue.filter((product) =>
      matchesAdminProductView(product, "out-of-stock"),
    );

    expect(outOfStock.length).toBeGreaterThan(0);
    expect(markup).toContain(`of ${outOfStock.length}`);
    for (const product of outOfStock.slice(0, ADMIN_PRODUCTS_PAGE_SIZE)) {
      expect(markup).toContain(product.id);
    }
  });

  /**
   * The catalogue holds no drafts today, so this view is empty — and its empty state must be a
   * sentence about the catalogue rather than one that could be mistaken for a fault.
   */
  it("shows an empty state that talks about the catalogue, not about an error", async () => {
    const markup = await renderList({ view: "draft" });
    const drafts = catalogue.filter((product) => product.status === "draft");

    if (drafts.length === 0) {
      expect(markup).toContain("No draft products.");
      expect(markup).not.toContain(CATALOGUE_ERROR_HEADING);
    } else {
      expect(markup).toContain(`of ${drafts.length}`);
    }
  });

  it("offers to clear the filters only when there are filters to clear", async () => {
    expect(await renderList()).not.toContain("Clear filters");
    expect(await renderList({ search: "bow" })).toContain("Clear filters");
  });

  it("says how a saved edit reaches the shop", async () => {
    expect(await renderList()).toContain("Edits are saved to the working tree");
  });
});

describe("the product detail page renders one whole record", () => {
  it("shows the product's own fields", async () => {
    const product = catalogue[0];
    const markup = await renderDetail(product.id);

    expect(markup).toContain(product.name);
    expect(markup).toContain(product.id);
    expect(markup).toContain("Back to products");
  });

  it("offers all three tabs", async () => {
    const markup = await renderDetail(catalogue[0].id);

    expect(markup).toContain("Basic details");
    expect(markup).toContain("Variants &amp; media");
    expect(markup).toContain("Pricing &amp; SEO");
  });

  it("404s for an id the catalogue does not hold", async () => {
    await expect(renderDetail("P000")).rejects.toBeInstanceOf(NotFoundSignal);
  });

  /**
   * A draft is a 404 on the storefront and editable here. That asymmetry is the whole point of the
   * status field — the panel is where an unpublished record is worked on.
   */
  it("opens a draft, which the storefront would refuse", async () => {
    const draft = catalogue.find((product) => product.status === "draft");
    if (draft === undefined) return;

    expect(await renderDetail(draft.id)).toContain(draft.name);
  });
});

describe("when the catalogue cannot be read", () => {
  it("tells the operator so instead of rendering an empty list", async () => {
    readState.shouldFail = true;
    const markup = await renderList();

    expect(markup).toContain(CATALOGUE_ERROR_HEADING);
    expect(markup).not.toContain("No all products.");
  });

  it("tells the operator so on the detail page instead of a 404", async () => {
    readState.shouldFail = true;
    const markup = await renderDetail(catalogue[0].id);

    expect(markup).toContain(CATALOGUE_ERROR_HEADING);
  });

  /**
   * The wording matters as much as the presence. A malformed catalogue is not an outage: the shop
   * carries on serving the copy compiled into the running build, and an operator who read the
   * database panel's wording here would treat a bad JSON file as lost revenue.
   */
  it("does not describe it as a database outage or imply orders are being lost", async () => {
    readState.shouldFail = true;
    const markup = await renderList();

    expect(markup).not.toContain("The order database did not answer");
    expect(markup).toContain("The shop itself is unaffected");
  });
});
