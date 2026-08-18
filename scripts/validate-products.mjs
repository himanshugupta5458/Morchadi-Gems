import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE_PATH = join(REPO_ROOT, "data", "products.json");
const PUBLIC_DIR = join(REPO_ROOT, "public");

const MIN_PRODUCT_COUNT = 1;
const MIN_FEATURED_COUNT = 4;
const MIN_NEW_COUNT = 4;
const MIN_REVIEWS_PER_PRODUCT = 2;
const MAX_REVIEWS_PER_PRODUCT = 3;
const MIN_RATING = 3.5;
const MAX_RATING = 5.0;
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

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOneDecimalPlace(value) {
  return Math.round(value * 10) === Number((value * 10).toFixed(4));
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
  catalogue.length >= MIN_PRODUCT_COUNT,
  `expected at least ${MIN_PRODUCT_COUNT} product, found ${catalogue.length}`,
);

const seenIds = new Set();
const categoryCounts = Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0]));
const priceBands = { budget: 0, mid: 0, premium: 0, outOfBand: 0 };
const impliedDiscounts = [];
let discountedCount = 0;
let featuredCount = 0;
let newCount = 0;
let outOfStockCount = 0;
let optionedProductCount = 0;
let productImagesOnDisk = 0;
let taggedProductCount = 0;

for (const product of catalogue) {
  const label = product?.id ?? "<missing id>";

  check(isNonEmptyString(product?.id), `${label}: id must be a non-empty string`);
  check(!seenIds.has(product?.id), `${label}: duplicate id`);
  seenIds.add(product?.id);

  check(isNonEmptyString(product?.name), `${label}: name must be a non-empty string`);
  check(
    CATEGORY_SLUGS.includes(product?.category),
    `${label}: category "${product?.category}" is not a known slug`,
  );

  check(
    PRODUCT_ID.test(product?.id ?? ""),
    `${label}: id must be the owner's P-code in the form P001 — the catalogue holds no invented products`,
  );

  if (CATEGORY_SLUGS.includes(product?.category)) {
    categoryCounts[product.category] += 1;
  }

  check(
    typeof product?.price === "number" &&
      Number.isInteger(product.price) &&
      product.price > 0,
    `${label}: price must be a positive whole number of rupees`,
  );

  check(
    typeof product?.mrp === "number" &&
      Number.isInteger(product.mrp) &&
      product.mrp > 0,
    `${label}: mrp must be a positive whole number of rupees`,
  );

  if (typeof product?.mrp === "number" && typeof product?.price === "number") {
    check(
      product.mrp >= product.price,
      `${label}: mrp ${product.mrp} is below price ${product.price}`,
    );

    if (product.mrp >= product.price && product.mrp > 0) {
      const impliedDiscountPercent =
        ((product.mrp - product.price) / product.mrp) * 100;
      check(
        impliedDiscountPercent <= MAX_IMPLIED_DISCOUNT_PERCENT,
        `${label}: implied discount ${impliedDiscountPercent.toFixed(1)}% exceeds the ${MAX_IMPLIED_DISCOUNT_PERCENT}% ceiling`,
      );
      impliedDiscounts.push(impliedDiscountPercent);
      if (product.mrp > product.price) discountedCount += 1;
    }
  }

  if (typeof product?.price === "number") {
    if (product.price >= MIN_PRICE && product.price <= 999) priceBands.budget += 1;
    else if (product.price >= 1000 && product.price <= 4999) priceBands.mid += 1;
    else if (product.price >= 5000 && product.price <= 25000) priceBands.premium += 1;
    else priceBands.outOfBand += 1;
  }

  check(
    Array.isArray(product?.images) &&
      product.images.every((image) => isNonEmptyString(image)),
    `${label}: images must be an array of non-empty strings`,
  );

  if (Array.isArray(product?.images) && isNonEmptyString(product?.id)) {
    const expectedPrimaryImage = `/products/${product.id}.webp`;
    check(
      product.images[0] === expectedPrimaryImage,
      `${label}: images[0] must be exactly ${expectedPrimaryImage}, found ${product.images[0]}`,
    );

    if (product.images[0] === expectedPrimaryImage) {
      const onDisk = join(PUBLIC_DIR, "products", `${product.id}.webp`);
      const fileExists = existsSync(onDisk);
      check(
        fileExists,
        `${label}: public/products/${product.id}.webp does not exist — run npm run generate:placeholders`,
      );
      if (fileExists) productImagesOnDisk += 1;
    }
  }

  check(
    isNonEmptyString(product?.shortDescription),
    `${label}: shortDescription must be a non-empty string`,
  );

  const details = product?.details;
  check(
    details !== null && typeof details === "object" && !Array.isArray(details),
    `${label}: details must be an object`,
  );
  if (details && typeof details === "object") {
    check(isNonEmptyString(details.material), `${label}: details.material is required`);
    check(
      details.weight === undefined || isNonEmptyString(details.weight),
      `${label}: details.weight must be a non-empty string when present`,
    );
    check(
      details.closure === undefined || isNonEmptyString(details.closure),
      `${label}: details.closure must be a non-empty string when present`,
    );
    check(
      details.type === undefined || isNonEmptyString(details.type),
      `${label}: details.type must be a non-empty string when present`,
    );
    check(
      details.stone === undefined || isNonEmptyString(details.stone),
      `${label}: details.stone must be a non-empty string when present`,
    );
    check(
      details.size === undefined || isNonEmptyString(details.size),
      `${label}: details.size must be a non-empty string when present`,
    );
    const allowedKeys = ["material", "weight", "closure", "type", "stone", "size"];
    const unknownKeys = Object.keys(details).filter((key) => !allowedKeys.includes(key));
    check(
      unknownKeys.length === 0,
      `${label}: details has unknown keys ${unknownKeys.join(", ")}`,
    );
  }

  check(
    typeof product?.rating === "number" &&
      product.rating >= MIN_RATING &&
      product.rating <= MAX_RATING &&
      hasOneDecimalPlace(product.rating),
    `${label}: rating must be one decimal between ${MIN_RATING} and ${MAX_RATING}`,
  );

  check(
    typeof product?.reviewCount === "number" &&
      Number.isInteger(product.reviewCount) &&
      product.reviewCount >= 0,
    `${label}: reviewCount must be a non-negative integer`,
  );

  check(
    Array.isArray(product?.reviews) &&
      product.reviews.length >= MIN_REVIEWS_PER_PRODUCT &&
      product.reviews.length <= MAX_REVIEWS_PER_PRODUCT,
    `${label}: expected ${MIN_REVIEWS_PER_PRODUCT}-${MAX_REVIEWS_PER_PRODUCT} reviews, found ${product?.reviews?.length}`,
  );

  if (Array.isArray(product?.reviews)) {
    product.reviews.forEach((review, index) => {
      check(isNonEmptyString(review?.name), `${label}: reviews[${index}].name is required`);
      check(isNonEmptyString(review?.text), `${label}: reviews[${index}].text is required`);
      check(
        typeof review?.rating === "number" && review.rating >= 1 && review.rating <= 5,
        `${label}: reviews[${index}].rating must be between 1 and 5`,
      );
    });

    const reviewTexts = new Set(product.reviews.map((review) => review.text));
    check(
      reviewTexts.size === product.reviews.length,
      `${label}: has duplicate review text`,
    );
  }

  check(typeof product?.featured === "boolean", `${label}: featured must be a boolean`);
  check(typeof product?.isNew === "boolean", `${label}: isNew must be a boolean`);
  check(typeof product?.inStock === "boolean", `${label}: inStock must be a boolean`);

  const options = product?.options;
  check(
    options === undefined || Array.isArray(options),
    `${label}: options must be an array when present`,
  );
  if (Array.isArray(options)) {
    optionedProductCount += 1;
    options.forEach((option, index) => {
      check(
        isNonEmptyString(option?.name),
        `${label}: options[${index}].name must be a non-empty string`,
      );
      check(
        Array.isArray(option?.values) &&
          option.values.length >= 1 &&
          option.values.every((value) => isNonEmptyString(value)),
        `${label}: options[${index}] needs at least one non-empty value`,
      );
      if (Array.isArray(option?.values)) {
        check(
          new Set(option.values).size === option.values.length,
          `${label}: options[${index}] has duplicate values`,
        );
      }
    });
    const optionNames = options.map((option) => option?.name);
    check(
      new Set(optionNames).size === optionNames.length,
      `${label}: has two options with the same name`,
    );
  }

  const collections = product?.collections;
  check(
    collections === undefined || Array.isArray(collections),
    `${label}: collections must be an array when present`,
  );
  if (Array.isArray(collections)) {
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

  if (product?.featured === true) featuredCount += 1;
  if (product?.isNew === true) newCount += 1;
  if (product?.inStock === false) outOfStockCount += 1;

  const allowedProductKeys = [
    "id", "name", "category", "price", "mrp", "images", "shortDescription", "details",
    "rating", "reviewCount", "reviews", "featured", "isNew", "inStock", "options",
    "collections",
  ];
  const unknownProductKeys = Object.keys(product ?? {}).filter(
    (key) => !allowedProductKeys.includes(key),
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
console.log("\nPrice bands");
console.log(`  budget  ${MIN_PRICE}-999     ${priceBands.budget}`);
console.log(`  mid     1000-4999  ${priceBands.mid}`);
console.log(`  premium 5000-25000 ${priceBands.premium}`);
console.log("\nImages (id-keyed, local under /public)");
console.log(`  product files      ${productImagesOnDisk}/${catalogue.length}`);
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

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nPASS — all checks green.");
