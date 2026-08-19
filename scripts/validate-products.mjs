import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE_PATH = join(REPO_ROOT, "data", "products.json");
const PUBLIC_DIR = join(REPO_ROOT, "public");

/**
 * The owner stocks forty-nine pieces. Exact rather than a floor, so a product cannot be added
 * or lost without someone changing this line on purpose. Bump it when real stock arrives.
 */
const EXPECTED_PRODUCT_COUNT = 49;

const MIN_FEATURED_COUNT = 4;
const MIN_NEW_COUNT = 4;

/**
 * Two ceilings, because the catalogue's real prices and the discount policy disagree. Sixty
 * percent is the house style for a compare-at price: past it, an "MRP" stops reading as a
 * price anyone was ever asked to pay. Nine of the owner's real pieces are marked down further
 * than that, and their prices are not ours to rewrite (ADR-021) — so the house style is
 * reported as an advisory and the hard failure sits at eighty, which no real product reaches.
 * Retiring the advisory means changing the owner's MRPs, which is a business call. See
 * ADR-027.
 */
const ADVISORY_DISCOUNT_PERCENT = 60;
const MAX_IMPLIED_DISCOUNT_PERCENT = 80;

const MIN_PRICE = 25;
const MAX_PRICE = 25000;

/**
 * Every product in the catalogue is one the owner actually stocks, and its id is the P-code
 * they use on invoices, photo filenames and every message about stock. This regex is what
 * keeps that true: an invented product cannot be added without either taking a P-code it has
 * no right to or failing here. See ADR-021.
 */
const PRODUCT_ID = /^P\d{3}$/;

const CATEGORY_SLUGS = [
  "necklaces",
  "earrings",
  "rings",
  "bracelets",
  "bangles",
  "pendants",
  "anklets",
  "nose-pins",
  "watches",
  "hair-accessories",
];

const COLLECTION_TAGS = ["gifting", "anti-tarnish"];

const OPTION_TYPES = ["dropdown", "swatch", "pills", "chips"];

const VARIANT_KEY_SEPARATOR = ":";

const PRODUCT_KEYS = [
  "id",
  "name",
  "category",
  "collections",
  "pricing",
  "media",
  "options",
  "specs",
  "description",
  "stock",
  "flags",
];

const failures = [];
const advisories = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

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

check(Array.isArray(catalogue), "products.json must be a JSON array");
if (!Array.isArray(catalogue)) process.exit(1);

check(
  catalogue.length === EXPECTED_PRODUCT_COUNT,
  `expected exactly ${EXPECTED_PRODUCT_COUNT} products, found ${catalogue.length}`,
);

const seenIds = new Set();
const categoryCounts = Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0]));
const priceBands = { budget: 0, mid: 0, premium: 0, outOfBand: 0 };
const optionTypeCounts = Object.fromEntries(OPTION_TYPES.map((type) => [type, 0]));
const impliedDiscounts = [];
let discountedCount = 0;
let featuredCount = 0;
let newCount = 0;
let outOfStockCount = 0;
let optionedProductCount = 0;
let taggedProductCount = 0;
let primaryImagesOnDisk = 0;
let additionalImageCount = 0;
let variantImageCount = 0;

function validatePricing(product, label) {
  const pricing = product?.pricing;
  check(isPlainObject(pricing), `${label}: pricing must be an object`);
  if (!isPlainObject(pricing)) return;

  check(
    isPositiveInteger(pricing.price),
    `${label}: pricing.price must be a positive whole number of rupees`,
  );
  check(
    isPositiveInteger(pricing.mrp),
    `${label}: pricing.mrp must be a positive whole number of rupees`,
  );

  if (isPositiveInteger(pricing.price)) {
    if (pricing.price >= MIN_PRICE && pricing.price <= 999) priceBands.budget += 1;
    else if (pricing.price >= 1000 && pricing.price <= 4999) priceBands.mid += 1;
    else if (pricing.price >= 5000 && pricing.price <= MAX_PRICE) priceBands.premium += 1;
    else priceBands.outOfBand += 1;
  }

  if (!isPositiveInteger(pricing.price) || !isPositiveInteger(pricing.mrp)) return;

  check(
    pricing.mrp >= pricing.price,
    `${label}: pricing.mrp ${pricing.mrp} is below pricing.price ${pricing.price}`,
  );
  if (pricing.mrp < pricing.price) return;

  const impliedDiscountPercent = ((pricing.mrp - pricing.price) / pricing.mrp) * 100;
  check(
    impliedDiscountPercent <= MAX_IMPLIED_DISCOUNT_PERCENT,
    `${label}: implied discount ${impliedDiscountPercent.toFixed(1)}% exceeds the ${MAX_IMPLIED_DISCOUNT_PERCENT}% ceiling`,
  );
  if (impliedDiscountPercent > ADVISORY_DISCOUNT_PERCENT) {
    advisories.push(
      `${label}: implied discount ${impliedDiscountPercent.toFixed(1)}% is above the ${ADVISORY_DISCOUNT_PERCENT}% house style`,
    );
  }

  impliedDiscounts.push(impliedDiscountPercent);
  if (pricing.mrp > pricing.price) discountedCount += 1;
}

function validateOptions(product, label) {
  const options = product?.options;
  check(
    options === undefined || Array.isArray(options),
    `${label}: options must be an array when present`,
  );
  if (!Array.isArray(options)) return;

  optionedProductCount += 1;

  options.forEach((option, index) => {
    check(
      isNonEmptyString(option?.name),
      `${label}: options[${index}].name must be a non-empty string`,
    );
    check(
      OPTION_TYPES.includes(option?.type),
      `${label}: options[${index}].type "${option?.type}" must be one of ${OPTION_TYPES.join(", ")}`,
    );
    if (OPTION_TYPES.includes(option?.type)) optionTypeCounts[option.type] += 1;

    const values = option?.values;
    check(
      Array.isArray(values) &&
        values.length >= 1 &&
        values.every((value) => isNonEmptyString(value)),
      `${label}: options[${index}] needs at least one non-empty value`,
    );
    if (Array.isArray(values)) {
      check(
        new Set(values).size === values.length,
        `${label}: options[${index}] has duplicate values`,
      );
      check(
        values.includes(option?.default),
        `${label}: options[${index}].default "${option?.default}" is not one of its values`,
      );
    }
  });

  const optionNames = options.map((option) => option?.name);
  check(
    new Set(optionNames).size === optionNames.length,
    `${label}: has two options with the same name`,
  );
}

function validateMedia(product, label) {
  const media = product?.media;
  check(isPlainObject(media), `${label}: media must be an object`);
  if (!isPlainObject(media)) return;

  const images = media.images;
  check(
    Array.isArray(images) &&
      images.length >= 1 &&
      images.every((image) => isNonEmptyString(image)),
    `${label}: media.images must be a non-empty array of non-empty strings`,
  );

  if (Array.isArray(images) && isNonEmptyString(product?.id)) {
    const expectedPrimaryImage = `/products/${product.id}.webp`;
    check(
      images[0] === expectedPrimaryImage,
      `${label}: media.images[0] must be exactly ${expectedPrimaryImage}, found ${images[0]}`,
    );

    if (images[0] === expectedPrimaryImage) {
      const fileExists = existsUnderPublic(expectedPrimaryImage);
      check(
        fileExists,
        `${label}: public${expectedPrimaryImage} does not exist — run npm run generate:placeholders`,
      );
      if (fileExists) primaryImagesOnDisk += 1;
    }

    check(new Set(images).size === images.length, `${label}: media.images repeats a path`);

    for (const image of images.slice(1)) {
      if (!isNonEmptyString(image)) continue;
      additionalImageCount += 1;
      check(
        image.startsWith(`/products/${product.id}-`) && image.endsWith(".webp"),
        `${label}: additional image ${image} must be named /products/${product.id}-{n}.webp`,
      );
      check(
        existsUnderPublic(image),
        `${label}: public${image} does not exist — run npm run generate:placeholders`,
      );
    }
  }

  const variantImages = media.variantImages;
  check(
    variantImages === undefined || isPlainObject(variantImages),
    `${label}: media.variantImages must be an object when present`,
  );
  if (!isPlainObject(variantImages)) return;

  const options = Array.isArray(product?.options) ? product.options : [];

  for (const [key, image] of Object.entries(variantImages)) {
    variantImageCount += 1;

    check(
      isNonEmptyString(image),
      `${label}: media.variantImages["${key}"] must be a non-empty path`,
    );

    const separatorIndex = key.indexOf(VARIANT_KEY_SEPARATOR);
    check(
      separatorIndex > 0 && separatorIndex < key.length - 1,
      `${label}: media.variantImages key "${key}" must read OptionName${VARIANT_KEY_SEPARATOR}value`,
    );
    if (separatorIndex <= 0 || separatorIndex >= key.length - 1) continue;

    const optionName = key.slice(0, separatorIndex);
    const optionValue = key.slice(separatorIndex + 1);
    const group = options.find((option) => option?.name === optionName);

    check(
      group !== undefined,
      `${label}: media.variantImages key "${key}" names option "${optionName}", which this product does not have`,
    );
    if (group === undefined) continue;

    check(
      Array.isArray(group.values) && group.values.includes(optionValue),
      `${label}: media.variantImages key "${key}" names a value "${optionName}" does not offer`,
    );

    if (!isNonEmptyString(image)) continue;
    check(
      image.startsWith(`/products/${product.id}-`) && image.endsWith(".webp"),
      `${label}: variant image ${image} must be named /products/${product.id}-{variant}.webp`,
    );
    check(
      existsUnderPublic(image),
      `${label}: public${image} does not exist — run npm run generate:placeholders`,
    );
  }
}

function validateSpecs(product, label) {
  const specs = product?.specs;
  check(isPlainObject(specs), `${label}: specs must be an object`);
  if (!isPlainObject(specs)) return;

  check(Object.keys(specs).length >= 1, `${label}: specs must carry at least one entry`);

  for (const [key, value] of Object.entries(specs)) {
    check(
      isNonEmptyString(key) && key === key.toLowerCase(),
      `${label}: specs key "${key}" must be a lower-case name`,
    );
    check(
      isNonEmptyString(value),
      `${label}: specs.${key} must be a non-empty string`,
    );
  }
}

/**
 * The catalogue holds no ratings and no reviews, and the `unknownProductKeys` check below is
 * what keeps it that way: `rating` and `reviews` are off `PRODUCT_KEYS`, so a record carrying
 * either fails here rather than reaching a Product schema. Reviews come back when there are
 * real ones to publish, and this validator gains the shape checks again at that point. See
 * ADR-034.
 */
function validateNoFabricatedReception(product, label) {
  check(
    product?.rating === undefined,
    `${label}: rating must not be present — this store publishes no ratings it has not collected`,
  );
  check(
    product?.reviews === undefined,
    `${label}: reviews must not be present — this store publishes no reviews it has not collected`,
  );
}

function validateStockAndFlags(product, label) {
  const stock = product?.stock;
  check(isPlainObject(stock), `${label}: stock must be an object`);
  if (isPlainObject(stock)) {
    check(
      typeof stock.inStock === "boolean",
      `${label}: stock.inStock must be a boolean`,
    );
    if (stock.inStock === false) outOfStockCount += 1;
  }

  const flags = product?.flags;
  check(isPlainObject(flags), `${label}: flags must be an object`);
  if (!isPlainObject(flags)) return;

  check(
    typeof flags.featured === "boolean",
    `${label}: flags.featured must be a boolean`,
  );
  check(typeof flags.isNew === "boolean", `${label}: flags.isNew must be a boolean`);
  if (flags.featured === true) featuredCount += 1;
  if (flags.isNew === true) newCount += 1;
}

function validateCollections(product, label) {
  const collections = product?.collections;
  check(
    collections === undefined || Array.isArray(collections),
    `${label}: collections must be an array when present`,
  );
  if (!Array.isArray(collections)) return;

  taggedProductCount += 1;
  collections.forEach((slug, index) => {
    check(
      COLLECTION_TAGS.includes(slug),
      `${label}: collections[${index}] "${slug}" is not a known collection tag`,
    );
  });
  check(
    new Set(collections).size === collections.length,
    `${label}: has a duplicate collection tag`,
  );
}

for (const product of catalogue) {
  const label = product?.id ?? "<missing id>";

  check(isNonEmptyString(product?.id), `${label}: id must be a non-empty string`);
  check(!seenIds.has(product?.id), `${label}: duplicate id`);
  seenIds.add(product?.id);

  check(
    PRODUCT_ID.test(product?.id ?? ""),
    `${label}: id must be the owner's P-code in the form P001 — the catalogue holds no invented products`,
  );

  check(isNonEmptyString(product?.name), `${label}: name must be a non-empty string`);
  check(
    isNonEmptyString(product?.description),
    `${label}: description must be a non-empty string`,
  );
  check(
    CATEGORY_SLUGS.includes(product?.category),
    `${label}: category "${product?.category}" is not a known slug`,
  );
  if (CATEGORY_SLUGS.includes(product?.category)) {
    categoryCounts[product.category] += 1;
  }

  validatePricing(product, label);
  validateOptions(product, label);
  validateMedia(product, label);
  validateSpecs(product, label);
  validateNoFabricatedReception(product, label);
  validateStockAndFlags(product, label);
  validateCollections(product, label);

  const unknownProductKeys = Object.keys(product ?? {}).filter(
    (key) => !PRODUCT_KEYS.includes(key),
  );
  check(
    unknownProductKeys.length === 0,
    `${label}: unknown keys ${unknownProductKeys.join(", ")}`,
  );
}

check(
  seenIds.size === catalogue.length,
  `ids are not unique: ${catalogue.length} products but ${seenIds.size} distinct ids`,
);

for (const slug of CATEGORY_SLUGS) {
  check(categoryCounts[slug] > 0, `category "${slug}" has no products`);
}

check(
  featuredCount >= MIN_FEATURED_COUNT,
  `expected at least ${MIN_FEATURED_COUNT} featured products to fill the home best-sellers row, found ${featuredCount}`,
);
check(
  newCount >= MIN_NEW_COUNT,
  `expected at least ${MIN_NEW_COUNT} isNew products to fill the home new-arrivals row, found ${newCount}`,
);
check(
  outOfStockCount >= 1,
  "expected at least one out-of-stock product so the sold-out UI keeps coverage",
);
check(
  priceBands.outOfBand === 0,
  `${priceBands.outOfBand} products fall outside the ${MIN_PRICE}-${MAX_PRICE} price range`,
);

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

console.log("Morchadi Gems — product catalogue validation\n");
console.log(`Products            ${catalogue.length}`);
console.log(`Unique ids          ${seenIds.size}`);
console.log(`Featured            ${featuredCount}`);
console.log(`New arrivals        ${newCount}`);
console.log(`Out of stock        ${outOfStockCount}`);
console.log(`With options        ${optionedProductCount}`);
console.log(`With collections    ${taggedProductCount}`);
console.log("\nCategory distribution");
for (const slug of CATEGORY_SLUGS) {
  console.log(`  ${slug.padEnd(18)}${categoryCounts[slug]}`);
}
console.log("\nOption controls");
for (const type of OPTION_TYPES) {
  console.log(`  ${type.padEnd(18)}${optionTypeCounts[type]}`);
}
console.log("\nPrice bands");
console.log(`  budget  ${MIN_PRICE}-999     ${priceBands.budget}`);
console.log(`  mid     1000-4999  ${priceBands.mid}`);
console.log(`  premium 5000-25000 ${priceBands.premium}`);
console.log("\nImages (id-keyed, local under /public)");
console.log(`  primary files      ${primaryImagesOnDisk}/${catalogue.length}`);
console.log(`  additional views   ${additionalImageCount}`);
console.log(`  variant images     ${variantImageCount}`);
console.log(`  category files     ${categoryImagesOnDisk}/${CATEGORY_SLUGS.length}`);
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

if (advisories.length > 0) {
  console.warn(
    `\nADVISORY — ${advisories.length} product(s) above the ${ADVISORY_DISCOUNT_PERCENT}% house style. Real owner prices; changing them is a business call, not a code fix:`,
  );
  for (const advisory of advisories) console.warn(`  - ${advisory}`);
}

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nPASS — all checks green.");
