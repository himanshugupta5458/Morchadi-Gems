/**
 * One-off: give every catalogue record a `pricing.minPrepaidAmount`.
 *
 * The field designates a product as requiring prepayment (see ADR-058). No product does yet,
 * so every record is backfilled to `0` — COD-eligible — and the owner raises individual ones
 * later. Written as a script rather than a hand edit because 449 records is past the point
 * where a hand edit can be trusted.
 *
 * It rewrites the whole file through `JSON.parse`/`JSON.stringify`, which is safe here only
 * because that round-trip is byte-identical on this file: two-space indent, a trailing
 * newline, and non-ASCII characters left as themselves. The script asserts that identity on
 * the untouched parse before it writes anything, so a future formatting change fails loudly
 * instead of silently reformatting the catalogue into an unreviewable diff.
 *
 * Idempotent: a record that already carries the field keeps its value.
 *
 *   node scripts/backfill-min-prepaid-amount.mjs [--check]
 *
 * `--check` reports what would change and writes nothing.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CATALOGUE_PATH = "data/products.json";
const DEFAULT_MIN_PREPAID_AMOUNT = 0;

const checkOnly = process.argv.includes("--check");

const original = readFileSync(CATALOGUE_PATH, "utf8");
const products = JSON.parse(original);

function serialise(records) {
  return `${JSON.stringify(records, null, 2)}\n`;
}

if (serialise(products) !== original) {
  console.error(
    `${CATALOGUE_PATH}: a no-op parse/serialise round-trip is not byte-identical, so this ` +
      `script cannot rewrite the file without reformatting it. Fix the serialisation to ` +
      `match the file's existing style before backfilling.`,
  );
  process.exit(1);
}

let added = 0;
let alreadyPresent = 0;

for (const product of products) {
  if (typeof product.pricing !== "object" || product.pricing === null) {
    console.error(`${product.id}: no pricing object to add minPrepaidAmount to`);
    process.exit(1);
  }
  if ("minPrepaidAmount" in product.pricing) {
    alreadyPresent += 1;
    continue;
  }
  product.pricing.minPrepaidAmount = DEFAULT_MIN_PREPAID_AMOUNT;
  added += 1;
}

const updated = serialise(products);

console.log(
  `${products.length} products: ${added} given minPrepaidAmount=${DEFAULT_MIN_PREPAID_AMOUNT}, ` +
    `${alreadyPresent} already carried the field.`,
);

if (checkOnly) {
  console.log(`--check: ${CATALOGUE_PATH} not written.`);
  process.exit(0);
}

writeFileSync(CATALOGUE_PATH, updated);
console.log(`${CATALOGUE_PATH} written.`);
