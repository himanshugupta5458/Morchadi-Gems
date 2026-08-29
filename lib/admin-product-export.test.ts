import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  adminProductExportLabel,
  matchesAdminProductView,
  parseAdminProductQuery,
  selectMatchingAdminProducts,
} from "@/lib/admin-products";
import {
  PRODUCT_EXPORT_CONTENT_TYPE,
  flattenProductForExport,
  productExportFilename,
} from "@/lib/product-export";
import type { Product } from "@/types/product";

/**
 * The `.xlsx` export, from the query string to the bytes a browser saves.
 *
 * The workbook is parsed back rather than inspected as a buffer, because "returns a valid xlsx" is
 * a claim about what Excel can open and a length check proves none of it.
 */

const catalogue = JSON.parse(
  readFileSync(join(process.cwd(), "data", "products.json"), "utf8"),
) as Product[];

let signedInAdmin: { id: string; username: string } | null = null;

const listProducts = vi.fn(async () => catalogue);

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
  headers: () => ({ get: () => null }),
}));

vi.mock("@/lib/admin-session", () => ({
  readAdminSessionFromRequest: async () => signedInAdmin,
}));

vi.mock("@/lib/product-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-repository")>();
  return { ...actual, productRepository: { listProducts } };
});

async function exportWith(search: string): Promise<Response> {
  const { GET } = await import("@/app/admin/api/products/export/route");
  return GET(new Request(`http://localhost:3000/admin/api/products/export${search}`));
}

interface ParsedExport {
  rows: Array<Record<string, string | number | boolean>>;
  headers: string[];
  sheetNames: string[];
}

async function parseWorkbook(response: Response): Promise<ParsedExport> {
  const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return {
    rows: XLSX.utils.sheet_to_json(sheet) as ParsedExport["rows"],
    headers: (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] ?? []) as string[],
    sheetNames: workbook.SheetNames,
  };
}

beforeEach(() => {
  signedInAdmin = { id: "admin-1", username: "owner" };
  listProducts.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the export refuses a request with no live session", () => {
  it("answers 401 and never reads the catalogue", async () => {
    signedInAdmin = null;

    const response = await exportWith("");

    expect(response.status).toBe(401);
    expect(listProducts).not.toHaveBeenCalled();
  });

  /**
   * The whole catalogue including `pricing.cost` is in this file. Margin data leaving the building
   * on a forged cookie is the thing the Postgres-backed check exists to prevent, and middleware —
   * which only sees that *a* cookie was sent — cannot be the one making it.
   */
  it("keeps margin data behind the session check", async () => {
    signedInAdmin = null;

    expect(await (await exportWith("")).text()).not.toContain("pricing.cost");
  });
});

describe("the exported workbook", () => {
  it("parses as a real xlsx with one named sheet", async () => {
    const parsed = await parseWorkbook(await exportWith(""));

    expect(parsed.sheetNames).toEqual(["Live Products"]);
    expect(parsed.rows.length).toBe(catalogue.length);
  });

  it("carries the same columns, in the same order, as the flattening function", async () => {
    const parsed = await parseWorkbook(await exportWith(""));

    expect(parsed.headers).toEqual(Object.keys(flattenProductForExport(catalogue[0])));
  });

  it("includes migration provenance, which is why the export exists", async () => {
    const parsed = await parseWorkbook(await exportWith(""));
    const migrated = catalogue.find((product) => product.migrationProvenance !== undefined);
    expect(migrated).toBeDefined();
    if (migrated === undefined) return;

    const row = parsed.rows.find((candidate) => candidate.id === migrated.id);
    expect(row?.["migrationProvenance.originalId"]).toBe(
      migrated.migrationProvenance?.originalId,
    );
  });

  it("answers the headers that make a browser save a file rather than render one", async () => {
    const response = await exportWith("");

    expect(response.headers.get("Content-Type")).toBe(PRODUCT_EXPORT_CONTENT_TYPE);
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="live-products-export-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

/**
 * The decision this feature turns on: export means the list on screen, every page of it. A route
 * that exported a fixed set would disagree with its own button the moment a filter was applied.
 */
describe("the export is the currently filtered list", () => {
  it("exports the whole catalogue when nothing narrows it", async () => {
    const parsed = await parseWorkbook(await exportWith(""));

    expect(parsed.rows.length).toBe(catalogue.length);
    expect(parsed.rows.length).toBeGreaterThan(ADMIN_PRODUCTS_PAGE_SIZE);
  });

  it("exports only the matching rows when a view narrows it", async () => {
    const expected = catalogue.filter((product) =>
      matchesAdminProductView(product, "out-of-stock"),
    );
    expect(expected.length).toBeGreaterThan(0);

    const parsed = await parseWorkbook(await exportWith("?view=out-of-stock"));

    expect(parsed.rows.map((row) => row.id).sort()).toEqual(
      expected.map((product) => product.id).sort(),
    );
  });

  it("honours a search the same way the list does", async () => {
    const query = parseAdminProductQuery({ search: "ring" });
    const expected = selectMatchingAdminProducts(catalogue, query);
    expect(expected.length).toBeGreaterThan(0);

    const parsed = await parseWorkbook(await exportWith("?search=ring"));

    expect(parsed.rows.map((row) => row.id)).toEqual(expected.map((product) => product.id));
  });

  it("writes the rows in the order the list sorts them", async () => {
    const query = parseAdminProductQuery({ sort: "price-high" });
    const expected = selectMatchingAdminProducts(catalogue, query);

    const parsed = await parseWorkbook(await exportWith("?sort=price-high"));

    expect(parsed.rows.map((row) => row.id)).toEqual(expected.map((product) => product.id));
  });

  it("ignores the page, because a page is not a subset of the answer", async () => {
    const parsed = await parseWorkbook(await exportWith("?page=3"));

    expect(parsed.rows.length).toBe(catalogue.length);
  });
});

describe("what the download is called", () => {
  const day = new Date("2026-08-29T10:00:00Z");

  it("keeps the standalone script's name for the unnarrowed export", () => {
    expect(productExportFilename(false, day)).toBe("live-products-export-2026-08-29.xlsx");
  });

  it("names a narrowed export differently, so it cannot be mistaken for the catalogue", () => {
    expect(productExportFilename(true, day)).toBe("products-export-filtered-2026-08-29.xlsx");
  });

  it("names the filtered file when a filter is on", async () => {
    const response = await exportWith("?view=out-of-stock");

    expect(response.headers.get("Content-Disposition")).toContain(
      "products-export-filtered-",
    );
  });
});

describe("the button's label says which of the two it does", () => {
  it("names the whole catalogue when nothing narrows it", () => {
    expect(adminProductExportLabel(parseAdminProductQuery({}), 449)).toBe(
      "Export all 449 products (.xlsx)",
    );
  });

  it("says the count is the filtered one when something does", () => {
    expect(adminProductExportLabel(parseAdminProductQuery({ view: "out-of-stock" }), 6)).toBe(
      "Export these 6 filtered products (.xlsx)",
    );
  });

  it("agrees with what the route actually exports", async () => {
    const query = parseAdminProductQuery({ view: "out-of-stock" });
    const parsed = await parseWorkbook(await exportWith("?view=out-of-stock"));

    expect(adminProductExportLabel(query, parsed.rows.length)).toContain(
      `${parsed.rows.length} filtered`,
    );
  });
});

describe("a catalogue that cannot be read", () => {
  it("says so rather than handing back an empty spreadsheet", async () => {
    const silenced = vi.spyOn(console, "error").mockImplementation(() => {});
    listProducts.mockRejectedValueOnce(new Error("products.json is not valid JSON"));

    const response = await exportWith("");

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("nothing was exported");
    silenced.mockRestore();
  });
});
