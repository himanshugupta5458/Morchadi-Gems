#!/usr/bin/env node
/**
 * One-time export: every active product in data/products.json -> a single .xlsx file.
 *
 * Usage (from the repo root, in the Codespace):
 *   npm install xlsx --no-save
 *   node scripts/export-live-products.mjs
 *
 * --no-save is deliberate: this is a one-off tool, not a project dependency, so it should
 * not appear in package.json or package-lock.json. If you run this more than once, feel free
 * to drop --no-save and keep it around instead - your call.
 *
 * Output: live-products-export-YYYY-MM-DD.xlsx in the repo root. Not committed to git.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PRODUCTS_PATH = path.join(REPO_ROOT, "data", "products.json");

function readProducts() {
  const raw = fs.readFileSync(PRODUCTS_PATH, "utf8");
  const products = JSON.parse(raw);
  if (!Array.isArray(products)) {
    throw new Error("data/products.json did not parse to an array");
  }
  return products;
}

function isActive(product) {
  // Mirrors lib/products.ts's isActiveProduct: only an explicit "draft" withholds a product.
  return product.status !== "draft";
}

/**
 * Flattens one product into a single row. Nested objects (pricing, media, specs, seo, stock,
 * flags) are spread into prefixed columns so every field is visible and filterable in Excel,
 * rather than collapsing them into JSON-string blobs nobody can sort by.
 */
function flattenProduct(product) {
  const row = {
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

    "flags.featured": product.flags?.featured ?? "",
    "flags.isNew": product.flags?.isNew ?? "",

    options: (product.options ?? [])
      .map((opt) => `${opt.name}: ${(opt.values ?? []).join(", ")}`)
      .join(" | "),

    specs: Object.entries(product.specs ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | "),

    "seo.primaryKeyword": product.seo?.primaryKeyword ?? "",
    "seo.secondaryKeywords": (product.seo?.secondaryKeywords ?? []).join(" | "),
    "seo.metaTitle": product.seo?.metaTitle ?? "",
    "seo.metaDescription": product.seo?.metaDescription ?? "",
    "seo.imageAlt": product.seo?.imageAlt ?? "",

    // Migration provenance: only present on records migrated from the old Odoo site.
    // A genuinely new product (never listed on the old site) has no migrationProvenance
    // block at all, so these columns are blank for it - that's correct, not missing data.
    "migrationProvenance.originalId": product.migrationProvenance?.originalId ?? "",
    "migrationProvenance.originalSku": product.migrationProvenance?.originalSku ?? "",
    "migrationProvenance.originalUrl": product.migrationProvenance?.originalUrl ?? "",
    "migrationProvenance.originalCategories": (
      product.migrationProvenance?.originalCategories ?? []
    ).join(" | "),
  };

  return row;
}

function buildWorkbook(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // A sane default column width so the sheet isn't unreadable on open. XLSX doesn't measure
  // content automatically, so this is an approximation based on header length, capped so one
  // long description doesn't blow out every column.
  const headers = Object.keys(rows[0] ?? {});
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length, 12), 40),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Live Products");
  return workbook;
}

function main() {
  const allProducts = readProducts();
  const activeProducts = allProducts.filter(isActive);

  const withProvenance = activeProducts.filter((p) => p.migrationProvenance).length;

  console.log(`Total products in file: ${allProducts.length}`);
  console.log(`Active (exported): ${activeProducts.length}`);
  console.log(`Excluded (draft): ${allProducts.length - activeProducts.length}`);
  console.log(`With migrationProvenance (old website link, etc.): ${withProvenance}`);
  console.log(`Without (genuinely new products, never on the old site): ${activeProducts.length - withProvenance}`);

  if (activeProducts.length === 0) {
    console.error("No active products found - nothing to export. Stopping.");
    process.exit(1);
  }

  const rows = activeProducts.map(flattenProduct);
  const workbook = buildWorkbook(rows);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(REPO_ROOT, `live-products-export-${dateStamp}.xlsx`);

  XLSX.writeFile(workbook, outputPath);

  console.log(`\nWritten: ${outputPath}`);
  console.log("Right-click it in the Codespace file explorer and choose Download,");
  console.log("or run: code -r <path>  /  or drag it out via the Explorer sidebar.");
}

main();
