import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { BRAND_NAME } from "../config/site-facts.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE_PATH = join(REPO_ROOT, "data", "products.json");
const KEYWORD_MAP_PATH = join(REPO_ROOT, "data", "keyword-map.json");

export const KEYWORD_MAP_RELATIVE_PATH = "data/keyword-map.json";

/**
 * The map is **derived**, never authored. `data/products.json` stays the single source of truth
 * for a product's keywords — ADR-036 rejected holding metadata in a parallel `lib/` lookup on
 * the grounds that a second file drifts out of step with the record. This file exists anyway
 * because the collision rule in `.claude/skills/meta-skills.md` is a *site-wide* question that
 * cannot be answered from one product's record, and PROJECT-STATE §11 recorded the absence of
 * anywhere to ask it.
 *
 * The drift ADR-036 warned about is closed mechanically rather than by discipline:
 * `scripts/validate-products.mjs` rebuilds this map from the catalogue on every gate run and
 * fails if the committed file differs. A stale map is a build failure, not a silent lie.
 */

/**
 * Lower-cased and whitespace-collapsed. This is what "the same keyword" means for a hard
 * collision: `Gold-Plated Ring` and `gold-plated ring` are one keyword competing with itself,
 * not two. Nothing else is normalised here — punctuation and word order are load-bearing
 * differences and are handled as advisories, never as blocks.
 */
export function canonicaliseKeyword(keyword) {
  return String(keyword).trim().replace(/\s+/g, " ").toLowerCase();
}

function isPublished(product) {
  return product?.status !== "draft";
}

function addEntry(index, keyword, productId) {
  const canonical = canonicaliseKeyword(keyword);
  if (canonical.length === 0) return;
  if (!Object.prototype.hasOwnProperty.call(index, canonical)) index[canonical] = [];
  if (!index[canonical].includes(productId)) index[canonical].push(productId);
}

function sortIndex(index) {
  const sorted = {};
  for (const keyword of Object.keys(index).sort()) {
    sorted[keyword] = [...index[keyword]].sort();
  }
  return sorted;
}

/**
 * Draft products are excluded, for the same reason every public surface excludes them
 * ([ADR-052](../docs/decisions/ADR-052-product-status-field.md)): an unpublished record is not
 * competing for a search result, so letting it reserve a keyword would block a real product on
 * behalf of one nobody can reach. A draft's keyword becomes live when the product does.
 */
export function buildKeywordMap(catalogue) {
  const published = catalogue.filter(isPublished);
  const primary = {};
  const secondary = {};

  for (const product of published) {
    const seo = product?.seo;
    if (seo === null || typeof seo !== "object") continue;

    if (typeof seo.primaryKeyword === "string") {
      addEntry(primary, seo.primaryKeyword, product.id);
    }
    if (Array.isArray(seo.secondaryKeywords)) {
      for (const keyword of seo.secondaryKeywords) {
        if (typeof keyword === "string") addEntry(secondary, keyword, product.id);
      }
    }
  }

  return {
    generatedBy: "scripts/backfill-keyword-map.mjs",
    source: "data/products.json",
    productCount: published.length,
    primary: sortIndex(primary),
    secondary: sortIndex(secondary),
  };
}

/** Byte-identical output for identical input, so the staleness check is a plain comparison. */
export function serialiseKeywordMap(map) {
  return `${JSON.stringify(map, null, 2)}\n`;
}

export function readCatalogue(path = CATALOGUE_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function buildKeywordMapFromDisk(path = CATALOGUE_PATH) {
  return buildKeywordMap(readCatalogue(path));
}

export function summariseKeywordMap(map) {
  const sharedSecondary = Object.entries(map.secondary).filter(
    ([, ids]) => ids.length > 1,
  );
  const duplicatePrimary = Object.entries(map.primary).filter(([, ids]) => ids.length > 1);

  return {
    products: map.productCount,
    primaryKeywords: Object.keys(map.primary).length,
    secondaryKeywords: Object.keys(map.secondary).length,
    duplicatePrimary,
    sharedSecondary,
  };
}

function runCli() {
  const map = buildKeywordMapFromDisk();
  writeFileSync(KEYWORD_MAP_PATH, serialiseKeywordMap(map), "utf8");

  const summary = summariseKeywordMap(map);
  console.log(`${BRAND_NAME} — keyword map backfill\n`);
  console.log(`Wrote               ${KEYWORD_MAP_RELATIVE_PATH}`);
  console.log(`Published products  ${summary.products}`);
  console.log(`Primary keywords    ${summary.primaryKeywords}`);
  console.log(`Secondary keywords  ${summary.secondaryKeywords}`);

  if (summary.duplicatePrimary.length > 0) {
    console.error(
      `\nHARD COLLISION — ${summary.duplicatePrimary.length} primary keyword(s) claimed by more than one product. This is an owner decision, not a code fix:`,
    );
    for (const [keyword, ids] of summary.duplicatePrimary) {
      console.error(`  - "${keyword}" claimed by ${ids.join(", ")}`);
    }
    return 1;
  }

  console.log("\nNo hard collisions — every published product owns a distinct primary keyword.");

  if (summary.sharedSecondary.length > 0) {
    console.warn(
      `\nADVISORY — ${summary.sharedSecondary.length} secondary keyword(s) shared by more than one product. Overlap here is normal and is not a defect:`,
    );
    for (const [keyword, ids] of summary.sharedSecondary) {
      console.warn(`  - "${keyword}" shared by ${ids.join(", ")}`);
    }
  }

  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(runCli());
}
