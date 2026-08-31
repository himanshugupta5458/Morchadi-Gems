import "server-only";
/**
 * A namespace import, not a default one. `xlsx` is CommonJS with no `default` export, and the two
 * bundlers this module passes through disagree about inventing one: esbuild does, so
 * `import XLSX from "xlsx"` tests green, and webpack does not, so the same line hands the running
 * dev server `undefined` and fails on the first `XLSX.write`. The namespace form is what both
 * agree on.
 */
import * as XLSX from "xlsx";
import type { Product } from "@/types/product";

/**
 * The catalogue as a spreadsheet — the columns, the sheet, and the name of the file.
 *
 * Ported verbatim from `scripts/export-live-products.mjs`, which this replaces. The script read
 * `data/products.json` off the disk of whatever machine happened to run it and left the workbook
 * in the repository root for somebody to find in the file explorer; the panel's export route calls
 * the same functions with records the repository handed it, so the export follows the catalogue
 * wherever it eventually lives ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 *
 * The column set is unchanged from the script's, deliberately and down to the order: an operator
 * with last week's sheet open beside this week's is comparing two of the same thing, and a column
 * list maintained in two places is a column list that drifts.
 */

export type ProductExportRow = Record<string, string | number | boolean>;

/**
 * One product flattened into a single row.
 *
 * Nested blocks — pricing, media, specs, seo, stock, flags — are spread into prefixed columns so
 * every field is visible, sortable and filterable in Excel, rather than collapsed into JSON blobs
 * nobody can sort by. `media.variantImages` is the one exception and stays a JSON string: it is a
 * map whose keys differ per product, so it has no fixed set of columns to become.
 *
 * The `migrationProvenance.*` columns are blank for a product that was never on the old Odoo site.
 * That is an absent block rather than missing data, and it reads correctly as an empty cell.
 */
export function flattenProductForExport(product: Product): ProductExportRow {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    status: product.status ?? "",
    description: product.description ?? "",

    "pricing.price": product.pricing?.price ?? "",
    "pricing.mrp": product.pricing?.mrp ?? "",
    "pricing.cost": product.pricing?.cost ?? "",
    "pricing.minPrepaidAmount": product.pricing?.minPrepaidAmount ?? "",

    "media.images": (product.media?.images ?? []).join(" | "),
    "media.variantImages": product.media?.variantImages
      ? JSON.stringify(product.media.variantImages)
      : "",

    "stock.inStock": product.stock?.inStock ?? "",
    "stock.quantity": product.stock?.quantity ?? "",

    "flags.featured": product.flags?.featured ?? "",
    "flags.isNew": product.flags?.isNew ?? "",
    "flags.badge": product.flags?.badge ?? "",

    options: (product.options ?? [])
      .map((option) => `${option.name}: ${(option.values ?? []).join(", ")}`)
      .join(" | "),

    specs: Object.entries(product.specs ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | "),

    "seo.primaryKeyword": product.seo?.primaryKeyword ?? "",
    "seo.secondaryKeywords": (product.seo?.secondaryKeywords ?? []).join(" | "),
    "seo.metaTitle": product.seo?.metaTitle ?? "",
    "seo.metaDescription": product.seo?.metaDescription ?? "",
    "seo.imageAlt": product.seo?.imageAlt ?? "",

    "migrationProvenance.originalId": product.migrationProvenance?.originalId ?? "",
    "migrationProvenance.originalSku": product.migrationProvenance?.originalSku ?? "",
    "migrationProvenance.originalUrl": product.migrationProvenance?.originalUrl ?? "",
    "migrationProvenance.originalCategories": (
      product.migrationProvenance?.originalCategories ?? []
    ).join(" | "),
  };
}

export const PRODUCT_EXPORT_SHEET_NAME = "Live Products";

export const PRODUCT_EXPORT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * A column width per header, approximated from the header's own length and capped.
 *
 * XLSX writes no width at all unless one is given, and the default leaves a sheet of 26 columns
 * unreadable on open. Measuring the content instead would let one 300-word description set the
 * width of the column it sits in and push everything else off the screen.
 */
function columnWidths(headers: readonly string[]): Array<{ wch: number }> {
  return headers.map((header) => ({ wch: Math.min(Math.max(header.length, 12), 40) }));
}

export function buildProductExportWorkbook(products: readonly Product[]): XLSX.WorkBook {
  const rows = products.map(flattenProductForExport);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = columnWidths(Object.keys(rows[0] ?? {}));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, PRODUCT_EXPORT_SHEET_NAME);
  return workbook;
}

/** The workbook as the bytes a download is made of. */
export function writeProductExportBuffer(products: readonly Product[]): Buffer {
  return XLSX.write(buildProductExportWorkbook(products), {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}

/**
 * What the downloaded file is called.
 *
 * The unfiltered export keeps `scripts/export-live-products.mjs`'s exact name, because it is the
 * same sheet that script produced and a folder of them should sort together. A narrowed export is
 * named differently rather than sharing that name: a file called `live-products-export` holding
 * six out-of-stock rows is a file that will be mistaken for the catalogue by whoever opens it next
 * month.
 */
export function productExportFilename(isFiltered: boolean, today: Date): string {
  const dateStamp = today.toISOString().slice(0, 10);
  const stem = isFiltered ? "products-export-filtered" : "live-products-export";
  return `${stem}-${dateStamp}.xlsx`;
}
