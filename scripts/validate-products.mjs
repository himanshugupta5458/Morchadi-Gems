import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  KEYWORD_MAP_RELATIVE_PATH,
  buildKeywordMap,
  serialiseKeywordMap,
} from "./backfill-keyword-map.mjs";
import { looselyNormaliseKeyword } from "./keyword-normalisation.mjs";
import {
  ADVISORY_DISCOUNT_PERCENT,
  CATEGORY_SLUGS,
  MAX_PRICE,
  MIN_PRICE,
  OPTION_TYPES,
  SURFACED_CATEGORY_SLUGS,
  createProductRuleContext,
  isPlainObject,
  validateCatalogueFloors,
  validateCatalogueSeoUniqueness,
  validateProductRecord,
} from "./product-record-rules.mjs";

/**
 * The catalogue gate.
 *
 * **The rules themselves are not here.** They live in `./product-record-rules.mjs`, which this
 * script imports and the admin product editor imports too — one implementation of "what makes a
 * record legal", so an edit saved through the panel cannot pass a weaker check than the one the
 * build runs. See [ADR-064](../docs/decisions/ADR-064-admin-product-management.md).
 *
 * What remains here is everything that is about validating *this repository's* catalogue rather
 * than about validating a record: where the file is, how many products it should hold, the
 * keyword map's freshness, and the summary a person reads.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE_PATH = join(REPO_ROOT, "data", "products.json");
const PUBLIC_DIR = join(REPO_ROOT, "public");
const KEYWORD_MAP_PATH = join(REPO_ROOT, "data", "keyword-map.json");

/**
 * The owner stocks forty-nine pieces. Exact rather than a floor, so a product cannot be added
 * or lost without someone changing this line on purpose. Bump it when real stock arrives.
 *
 * THIS IS THE ONLY HARDCODED CATALOGUE COUNT LEFT IN THE REPOSITORY, and it is deliberate.
 * Every count in the test suite is derived from the file at run time, because duplicating the
 * tripwire across eight files bought no protection and made adding a product an eight-file
 * chore — the reasoning is in the ADR-053 addendum. Being the single place a product count is
 * asserted is what makes this line meaningful: a record appearing or vanishing without anyone
 * intending it stops here, whether it is a draft or active, because this is a check on the file
 * rather than on a surface (ADR-052).
 *
 * So the gate failing after you add a product is CORRECT, not a bug. Bump the number.
 */
const EXPECTED_PRODUCT_COUNT = 449;

const secondaryKeywordAdvisories = [];
const nearMatchKeywordAdvisories = [];

function existsUnderPublic(publicPath) {
  return existsSync(join(PUBLIC_DIR, publicPath.replace(/^\//, "")));
}

let catalogue;
try {
  catalogue = JSON.parse(readFileSync(CATALOGUE_PATH, "utf8"));
} catch (error) {
  console.error(`FAIL  data/products.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

const context = createProductRuleContext({ existsUnderPublic });
const { check, counters } = context;

check(Array.isArray(catalogue), "products.json must be a JSON array");
if (!Array.isArray(catalogue)) process.exit(1);

check(
  catalogue.length === EXPECTED_PRODUCT_COUNT,
  catalogue.length > EXPECTED_PRODUCT_COUNT
    ? `expected exactly ${EXPECTED_PRODUCT_COUNT} products, found ${catalogue.length}. If you meant to add a product, this is the one line to update: set EXPECTED_PRODUCT_COUNT to ${catalogue.length} in scripts/validate-products.mjs. Nothing else in the repository hardcodes a catalogue count`
    : `expected exactly ${EXPECTED_PRODUCT_COUNT} products, found ${catalogue.length}. A record has gone missing from data/products.json — check the diff before touching EXPECTED_PRODUCT_COUNT`,
);

for (const product of catalogue) {
  validateProductRecord(product, product?.id ?? "<missing id>", context);
}

validateCatalogueSeoUniqueness(catalogue, context);

/**
 * The site-wide keyword map is **derived** from this catalogue, so the only way it can be wrong
 * is by being stale. ADR-036 rejected a parallel metadata file precisely because a second copy
 * drifts; the answer here is not discipline but this check — the map is rebuilt from the records
 * above and compared byte for byte, so an edited keyword with an un-regenerated map fails the
 * gate rather than quietly answering a collision question against yesterday's catalogue.
 *
 * Duplicate primary keywords are already a hard failure above, checked against the records
 * themselves rather than against the map. This section adds only what a site-wide view can see:
 * the map's freshness, and the overlaps that are advisory by design.
 */
const expectedKeywordMap = buildKeywordMap(catalogue);

if (!existsSync(KEYWORD_MAP_PATH)) {
  check(
    false,
    `${KEYWORD_MAP_RELATIVE_PATH} does not exist — run: npm run backfill:keyword-map`,
  );
} else {
  const onDisk = readFileSync(KEYWORD_MAP_PATH, "utf8");
  check(
    onDisk === serialiseKeywordMap(expectedKeywordMap),
    `${KEYWORD_MAP_RELATIVE_PATH} is stale — it does not match the keywords in data/products.json. Run: npm run backfill:keyword-map`,
  );
}

for (const [keyword, ids] of Object.entries(expectedKeywordMap.secondary)) {
  if (ids.length > 1) {
    secondaryKeywordAdvisories.push(`"${keyword}" shared by ${ids.join(", ")}`);
  }
}

/**
 * `loose` is computed once per entry, here, rather than inside the comparison below. The
 * comparison is every entry against every other — around 1.6 million pairs at the catalogue's
 * current 1,796 keyword entries — and normalising inside it meant 3.2 million normalisations of
 * the same 1,796 strings, which was most of this script's total runtime. The loop itself stays
 * as it is: it reports pairs in entry order, and the advisory list reads in that order.
 */
const everyKeywordEntry = [
  ...Object.entries(expectedKeywordMap.primary).map(([keyword, ids]) => ({
    keyword,
    ids,
    field: "primaryKeyword",
  })),
  ...Object.entries(expectedKeywordMap.secondary).map(([keyword, ids]) => ({
    keyword,
    ids,
    field: "secondaryKeywords",
  })),
].map((entry) => ({ ...entry, loose: looselyNormaliseKeyword(entry.keyword) }));

for (let left = 0; left < everyKeywordEntry.length; left += 1) {
  for (let right = left + 1; right < everyKeywordEntry.length; right += 1) {
    const first = everyKeywordEntry[left];
    const second = everyKeywordEntry[right];
    if (first.keyword === second.keyword) continue;
    if (first.loose !== second.loose) continue;
    const sharesEveryProduct =
      first.ids.length === second.ids.length &&
      first.ids.every((id) => second.ids.includes(id));
    if (sharesEveryProduct) continue;

    nearMatchKeywordAdvisories.push(
      `"${first.keyword}" (${first.field}, ${first.ids.join(", ")}) and "${second.keyword}" (${second.field}, ${second.ids.join(", ")}) differ only by word order or punctuation`,
    );
  }
}

check(
  counters.seenIds.size === catalogue.length,
  `ids are not unique: ${catalogue.length} products but ${counters.seenIds.size} distinct ids`,
);

validateCatalogueFloors(context);

let categoryImagesOnDisk = 0;
for (const slug of CATEGORY_SLUGS) {
  const onDisk = join(PUBLIC_DIR, "categories", `${slug}.webp`);
  const fileExists = existsSync(onDisk);
  check(
    fileExists,
    `public/categories/${slug}.webp does not exist — run npm run generate:placeholders`,
  );
  if (fileExists) categoryImagesOnDisk += 1;
}

const {
  seenIds,
  statusCounts,
  categoryCounts,
  priceBands,
  optionTypeCounts,
  impliedDiscounts,
  grossMargins,
  costedCount,
  discountedCount,
  codIneligibleCount,
  featuredCount,
  newCount,
  outOfStockCount,
  optionedProductCount,
  taggedProductCount,
  migratedProductCount,
  primaryImagesOnDisk,
  additionalImageCount,
  variantImageCount,
  seenMetaTitles,
  seenPrimaryKeywords,
  pricedMetadataIds,
} = counters;

console.log("Morchadi Gems — product catalogue validation\n");
console.log(`Products            ${catalogue.length}`);
console.log(`Unique ids          ${seenIds.size}`);
console.log(`Active              ${statusCounts.active}`);
console.log(`Draft               ${statusCounts.draft}`);
console.log(`Featured            ${featuredCount} (published)`);
console.log(`New arrivals        ${newCount} (published)`);
console.log(`Out of stock        ${outOfStockCount} (published)`);
console.log(`With options        ${optionedProductCount}`);
console.log(`With collections    ${taggedProductCount}`);
console.log(`With provenance     ${migratedProductCount} (migrated, server-only)`);
console.log("\nCategory distribution");
for (const slug of CATEGORY_SLUGS) {
  const pending = SURFACED_CATEGORY_SLUGS.includes(slug) ? "" : "  (pending — not surfaced)";
  console.log(`  ${slug.padEnd(18)}${categoryCounts[slug]}${pending}`);
}
console.log("\nOption controls");
for (const type of OPTION_TYPES) {
  console.log(`  ${type.padEnd(18)}${optionTypeCounts[type]}`);
}
console.log("\nPrice bands");
console.log(`  budget  ${MIN_PRICE}-999     ${priceBands.budget}`);
console.log(`  mid     1000-4999  ${priceBands.mid}`);
console.log(`  premium 5000-25000 ${priceBands.premium}`);
console.log("\nCash on delivery (ADR-058)");
console.log(`  COD-eligible       ${catalogue.length - codIneligibleCount}/${catalogue.length}`);
console.log(`  prepay required    ${codIneligibleCount}`);
console.log("\nImages (id-keyed, local under /public)");
console.log(`  primary files      ${primaryImagesOnDisk}/${catalogue.length}`);
console.log(`  additional views   ${additionalImageCount}`);
console.log(`  variant images     ${variantImageCount}`);
console.log(`  category files     ${categoryImagesOnDisk}/${CATEGORY_SLUGS.length}`);
console.log("\nSearch and social metadata");
console.log(`  with seo block     ${catalogue.filter((product) => isPlainObject(product?.seo)).length}/${catalogue.length}`);
console.log(`  unique metaTitles  ${seenMetaTitles.size}`);
console.log(`  unique keywords    ${seenPrimaryKeywords.size}`);
console.log(`  secondary keywords ${Object.keys(expectedKeywordMap.secondary).length}`);
console.log(`  price-dated copy   ${pricedMetadataIds.length}`);
console.log("\nMargin (cost is server-only, never shipped to a browser)");
console.log(`  with cost          ${costedCount}/${catalogue.length}`);
if (grossMargins.length > 0) {
  const lowest = Math.min(...grossMargins);
  const average = grossMargins.reduce((sum, value) => sum + value, 0) / grossMargins.length;
  console.log(`  lowest gross       ${lowest.toFixed(1)}%`);
  console.log(`  average gross      ${average.toFixed(1)}%`);
}
console.log("\nDiscount display (mrp is never charged)");
console.log(`  discounted         ${discountedCount}`);
console.log(`  at full price      ${catalogue.length - discountedCount}`);
if (impliedDiscounts.length > 0) {
  const highest = Math.max(...impliedDiscounts);
  const average =
    impliedDiscounts.reduce((sum, value) => sum + value, 0) / impliedDiscounts.length;
  console.log(`  highest implied    ${highest.toFixed(1)}%`);
  console.log(`  average implied    ${average.toFixed(1)}%`);
}

if (context.discountAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${context.discountAdvisories.length} product(s) above the ${ADVISORY_DISCOUNT_PERCENT}% house style. Real owner prices; changing them is a business call, not a code fix:`,
  );
  for (const advisory of context.discountAdvisories) console.warn(`  - ${advisory}`);
}

if (context.marginAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${context.marginAdvisories.length} product(s) priced at or below cost. Margin is the owner's call, not a code fix:`,
  );
  for (const advisory of context.marginAdvisories) console.warn(`  - ${advisory}`);
}

if (context.minPrepaidAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${context.minPrepaidAdvisories.length} product(s) whose minimum prepaid amount exceeds their own price. The figure is the owner's to correct:`,
  );
  for (const advisory of context.minPrepaidAdvisories) console.warn(`  - ${advisory}`);
}

if (context.descriptionAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${context.descriptionAdvisories.length} description(s) outside the house word range. Four products are still awaiting owner copy; see docs/CATALOGUE-DATA-TODO.md:`,
  );
  for (const advisory of context.descriptionAdvisories) console.warn(`  - ${advisory}`);
}

if (secondaryKeywordAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${secondaryKeywordAdvisories.length} secondary keyword(s) claimed by more than one product. Overlap is permitted by the collision rule and is usually correct; only a duplicate PRIMARY keyword is a failure:`,
  );
  for (const advisory of secondaryKeywordAdvisories) console.warn(`  - ${advisory}`);
}

if (nearMatchKeywordAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${nearMatchKeywordAdvisories.length} keyword pair(s) differ only by word order or punctuation. Not a collision; worth a look if the products are close:`,
  );
  for (const advisory of nearMatchKeywordAdvisories) console.warn(`  - ${advisory}`);
}

if (pricedMetadataIds.length > 0) {
  console.warn(
    `\nADVISORY — ${pricedMetadataIds.length} product(s) quote an amount in their search or social copy. Re-check these when a price or the shipping threshold moves: ${pricedMetadataIds.join(", ")}`,
  );
}

if (context.failures.length > 0) {
  console.error(`\nFAIL — ${context.failures.length} problem(s):`);
  for (const failure of context.failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nPASS — all checks green.");
