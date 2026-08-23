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
 * Descriptions are long-form prose, roughly 150 to 300 words over several paragraphs stored
 * with a blank line between them. The range is an advisory rather than a failure: four of the
 * owner's products are still carrying their pre-content-pass one-liner and are listed in
 * docs/CATALOGUE-DATA-TODO.md, so a hard floor would fail the gate on work that has not been
 * written yet rather than on a defect. See ADR-035.
 */
const MIN_DESCRIPTION_WORDS = 150;
const MAX_DESCRIPTION_WORDS = 300;

/**
 * Review metadata from the copy pass — the hook annotation and the merchandiser note — is not
 * customer-facing copy, and a paste that carries it into the catalogue is the failure mode
 * this guards. Hard, because it is never correct.
 */
const REVIEW_METADATA = /\[Merchandiser note:|^\*Hook:|^### P\d{3}/m;

/**
 * A karat figure describes solid gold, and nothing in this catalogue is solid gold. The same
 * goes for hallmarking, 916, and sterling silver, none of which a plated brass or stainless
 * steel piece can honestly claim. Enforced across every shopper-facing string so the claim
 * cannot come back through a name or a description having been taken out of the specs. See
 * ADR-018 and ADR-035.
 */
const PRECIOUS_METAL_CLAIM =
  /\b(?:9|10|14|18|22|24)\s?[Kk]\b|\b916\b|hallmark|sterling silver/i;

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

/**
 * Publication state. Required on every product rather than defaulted here, so a record that
 * forgets it fails the gate instead of being published by omission — `lib/products.ts` reads a
 * missing status as `active`, and this check is what stops anything from ever relying on that.
 * See ADR-052.
 */
const PRODUCT_STATUSES = ["draft", "active"];

const OPTION_TYPES = ["dropdown", "swatch", "pills", "chips"];

const VARIANT_KEY_SEPARATOR = ":";

const PRODUCT_KEYS = [
  "id",
  "name",
  "category",
  "status",
  "collections",
  "pricing",
  "media",
  "options",
  "specs",
  "description",
  "seo",
  "stock",
  "flags",
];

const SEO_KEYS = [
  "primaryKeyword",
  "secondaryKeywords",
  "metaTitle",
  "metaDescription",
  "imageAlt",
  "additionalImageAlts",
  "ogTitle",
  "ogDescription",
  "ogImage",
];

/**
 * What a search result and a share card actually render. Google truncates a title by pixel
 * width rather than by character count, so sixty is generous rather than exact; the floor is
 * there because a title short enough to leave the SERP half empty is wasting the only line the
 * page gets. The description bounds are the measured ones the meta skill writes to, and the
 * alt ceiling is roughly where a screen reader stops being useful. Counted in code points, so
 * the rupee sign counts once. See ADR-036.
 */
const META_TITLE_MIN = 50;
const META_TITLE_MAX = 60;
const META_DESCRIPTION_MIN = 140;
const META_DESCRIPTION_MAX = 160;
const OG_TITLE_MIN = 40;
const OG_TITLE_MAX = 70;
const OG_DESCRIPTION_MAX = 200;
const IMAGE_ALT_MAX = 125;

/**
 * A meta field is written for a person to read in a search result, which rules out the
 * promotional vocabulary the copy skills already bar from the description. Listed here rather
 * than only in the skill so a hand-edit to products.json fails the gate.
 */
const BANNED_META_ADJECTIVES = [
  "stunning",
  "exquisite",
  "gorgeous",
  "breathtaking",
  "must-have",
  "elevate",
  "effortless",
  "timeless",
  "versatile",
  "statement",
  "luxurious",
  "radiant",
  "captivating",
  "dainty",
  "charming",
  "graceful",
];

const failures = [];
const advisories = [];
const descriptionAdvisories = [];

/**
 * A piece selling at or below what it cost is a business problem, not a build problem. The
 * cost figures in the catalogue are placeholders until the owner supplies real ones, and real
 * ones will occasionally carry a thin or negative margin that wants the owner's attention
 * rather than a red gate. So the presence and the shape of `pricing.cost` are hard checks, and
 * cost-against-price is an advisory. See ADR-040.
 */
const marginAdvisories = [];

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
const statusCounts = Object.fromEntries(PRODUCT_STATUSES.map((status) => [status, 0]));
const categoryCounts = Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0]));
const priceBands = { budget: 0, mid: 0, premium: 0, outOfBand: 0 };
const optionTypeCounts = Object.fromEntries(OPTION_TYPES.map((type) => [type, 0]));
const impliedDiscounts = [];
const grossMargins = [];
let costedCount = 0;
let discountedCount = 0;
let featuredCount = 0;
let newCount = 0;
let outOfStockCount = 0;
let optionedProductCount = 0;
let taggedProductCount = 0;
let primaryImagesOnDisk = 0;
let additionalImageCount = 0;
let variantImageCount = 0;
const seenMetaTitles = new Map();
const seenPrimaryKeywords = new Map();
const pricedMetadataIds = [];

/**
 * Repeated here rather than imported: this script is plain Node with no path aliases, and the
 * only thing it needs from `lib/config.ts` is the one number a meta description is allowed to
 * quote. Kept in sync by the shipping tests, which read the real constant.
 */
const FREE_SHIPPING_THRESHOLD = 799;

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
  check(
    isPositiveInteger(pricing.cost),
    `${label}: pricing.cost must be a positive whole number of rupees`,
  );

  if (isPositiveInteger(pricing.cost) && isPositiveInteger(pricing.price)) {
    costedCount += 1;
    grossMargins.push(((pricing.price - pricing.cost) / pricing.price) * 100);
    if (pricing.cost >= pricing.price) {
      marginAdvisories.push(
        `${label}: pricing.cost ${pricing.cost} is not below pricing.price ${pricing.price} — the piece sells at or under what it cost`,
      );
    }
  }

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

function countWords(text) {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

function validateDescription(product, label) {
  const description = product?.description;
  if (!isNonEmptyString(description)) return;

  check(
    !REVIEW_METADATA.test(description),
    `${label}: description carries copy-pass review metadata — only the prose belongs in the field`,
  );

  const wordCount = countWords(description);
  if (wordCount < MIN_DESCRIPTION_WORDS || wordCount > MAX_DESCRIPTION_WORDS) {
    descriptionAdvisories.push(
      `${label}: ${wordCount} words, outside the ${MIN_DESCRIPTION_WORDS}-${MAX_DESCRIPTION_WORDS} word house range`,
    );
  }
}

function validateNoPreciousMetalClaim(product, label) {
  const shopperFacing = [
    product?.name,
    product?.description,
    ...Object.values(product?.specs ?? {}),
    ...(product?.options ?? []).flatMap((option) => [option?.name, ...(option?.values ?? [])]),
  ].filter(isNonEmptyString);

  for (const text of shopperFacing) {
    check(
      !PRECIOUS_METAL_CLAIM.test(text),
      `${label}: "${text}" makes a precious-metal claim this catalogue cannot support`,
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

function countCharacters(text) {
  return [...text].length;
}

function checkLength(value, label, field, min, max) {
  const length = countCharacters(value);
  check(
    length >= min && length <= max,
    `${label}: seo.${field} is ${length} characters, outside the ${min}-${max} range a search result renders`,
  );
  return length;
}

/**
 * The search and social metadata, checked for the two things a page cannot recover from once
 * published: a field that is missing, and a field the wrong length for the surface it renders
 * on. Uniqueness of `metaTitle` and `primaryKeyword` is checked across the batch below, because
 * two products sharing either is a collision the per-product pass cannot see. See ADR-036.
 */
function validateSeo(product, label) {
  const seo = product?.seo;
  check(isPlainObject(seo), `${label}: seo must be an object`);
  if (!isPlainObject(seo)) return;

  const unknownSeoKeys = Object.keys(seo).filter((key) => !SEO_KEYS.includes(key));
  check(
    unknownSeoKeys.length === 0,
    `${label}: seo has unknown keys ${unknownSeoKeys.join(", ")}`,
  );

  for (const field of ["primaryKeyword", "metaTitle", "metaDescription", "imageAlt", "ogTitle", "ogDescription", "ogImage"]) {
    check(isNonEmptyString(seo[field]), `${label}: seo.${field} must be a non-empty string`);
  }

  check(
    Array.isArray(seo.secondaryKeywords) &&
      seo.secondaryKeywords.every((keyword) => isNonEmptyString(keyword)),
    `${label}: seo.secondaryKeywords must be an array of non-empty strings`,
  );

  if (isNonEmptyString(seo.metaTitle)) {
    checkLength(seo.metaTitle, label, "metaTitle", META_TITLE_MIN, META_TITLE_MAX);
  }
  if (isNonEmptyString(seo.metaDescription)) {
    checkLength(
      seo.metaDescription,
      label,
      "metaDescription",
      META_DESCRIPTION_MIN,
      META_DESCRIPTION_MAX,
    );
  }
  if (isNonEmptyString(seo.ogTitle)) {
    checkLength(seo.ogTitle, label, "ogTitle", OG_TITLE_MIN, OG_TITLE_MAX);
  }
  if (isNonEmptyString(seo.ogDescription)) {
    check(
      countCharacters(seo.ogDescription) <= OG_DESCRIPTION_MAX,
      `${label}: seo.ogDescription is longer than the ${OG_DESCRIPTION_MAX} characters any platform shows`,
    );
  }

  const additionalAlts = seo.additionalImageAlts;
  check(
    additionalAlts === undefined ||
      (Array.isArray(additionalAlts) && additionalAlts.every((alt) => isNonEmptyString(alt))),
    `${label}: seo.additionalImageAlts must be an array of non-empty strings when present`,
  );

  const images = Array.isArray(product?.media?.images) ? product.media.images : [];
  const alts = [seo.imageAlt, ...(Array.isArray(additionalAlts) ? additionalAlts : [])].filter(
    isNonEmptyString,
  );
  check(
    alts.length === images.length,
    `${label}: ${alts.length} image alt(s) for ${images.length} image(s) — every photograph needs its own`,
  );
  check(new Set(alts).size === alts.length, `${label}: two images share one alt`);
  for (const alt of alts) {
    check(
      countCharacters(alt) <= IMAGE_ALT_MAX,
      `${label}: an image alt runs past ${IMAGE_ALT_MAX} characters`,
    );
    check(
      !/^(?:image|picture|photo) of/i.test(alt),
      `${label}: an image alt opens with "image of", which a screen reader already announces`,
    );
  }

  if (isNonEmptyString(seo.ogImage)) {
    check(
      seo.ogImage === images[0],
      `${label}: seo.ogImage must be the product's own photograph ${images[0]}, found ${seo.ogImage}`,
    );
  }

  const metaFields = [seo.metaTitle, seo.metaDescription, seo.ogTitle, seo.ogDescription, ...alts]
    .filter(isNonEmptyString);

  for (const text of metaFields) {
    for (const adjective of BANNED_META_ADJECTIVES) {
      check(
        !text.toLowerCase().includes(adjective),
        `${label}: seo copy uses the barred adjective "${adjective}"`,
      );
    }
  }

  const isAntiTarnish = (product?.collections ?? []).includes("anti-tarnish");
  if (!isAntiTarnish) {
    for (const text of metaFields) {
      check(
        !/anti-tarnish/i.test(text),
        `${label}: seo copy claims anti-tarnish, which this product is not tagged for`,
      );
    }
  }

  const quotedAmounts = [...metaFields.join(" ").matchAll(/\u20B9(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  for (const amount of quotedAmounts) {
    check(
      amount === product?.pricing?.price || amount === FREE_SHIPPING_THRESHOLD,
      `${label}: seo copy quotes \u20B9${amount}, which is neither the price \u20B9${product?.pricing?.price} nor the free-shipping threshold`,
    );
  }
  if (quotedAmounts.length > 0) pricedMetadataIds.push(product.id);
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

function validateStatus(product, label) {
  const status = product?.status;
  check(
    PRODUCT_STATUSES.includes(status),
    `${label}: status must be one of ${PRODUCT_STATUSES.join(", ")} — found ${JSON.stringify(status)}`,
  );
  if (PRODUCT_STATUSES.includes(status)) statusCounts[status] += 1;
}

function isPublished(product) {
  return product?.status !== "draft";
}

/**
 * The stock and merchandising counters below are the floors that keep a rendered surface
 * populated — the home best-sellers row, the new-arrivals row, the sold-out styling. A draft
 * reaches none of those, so it is counted towards none of them: a catalogue whose only four
 * featured pieces are unpublished has an empty row, and the gate should say so.
 */
function validateStockAndFlags(product, label) {
  const published = isPublished(product);
  const stock = product?.stock;
  check(isPlainObject(stock), `${label}: stock must be an object`);
  if (isPlainObject(stock)) {
    check(
      typeof stock.inStock === "boolean",
      `${label}: stock.inStock must be a boolean`,
    );
    if (stock.inStock === false && published) outOfStockCount += 1;
  }

  const flags = product?.flags;
  check(isPlainObject(flags), `${label}: flags must be an object`);
  if (!isPlainObject(flags)) return;

  check(
    typeof flags.featured === "boolean",
    `${label}: flags.featured must be a boolean`,
  );
  check(typeof flags.isNew === "boolean", `${label}: flags.isNew must be a boolean`);
  if (flags.featured === true && published) featuredCount += 1;
  if (flags.isNew === true && published) newCount += 1;
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
  validateDescription(product, label);
  validateNoPreciousMetalClaim(product, label);
  check(
    CATEGORY_SLUGS.includes(product?.category),
    `${label}: category "${product?.category}" is not a known slug`,
  );
  if (CATEGORY_SLUGS.includes(product?.category) && isPublished(product)) {
    categoryCounts[product.category] += 1;
  }

  validatePricing(product, label);
  validateOptions(product, label);
  validateMedia(product, label);
  validateSpecs(product, label);
  validateSeo(product, label);
  validateNoFabricatedReception(product, label);
  validateStatus(product, label);
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

for (const product of catalogue) {
  const seo = product?.seo;
  if (!isPlainObject(seo)) continue;

  if (isNonEmptyString(seo.metaTitle)) {
    check(
      !seenMetaTitles.has(seo.metaTitle),
      `${product.id}: shares its seo.metaTitle with ${seenMetaTitles.get(seo.metaTitle)}`,
    );
    seenMetaTitles.set(seo.metaTitle, product.id);
  }

  if (isNonEmptyString(seo.primaryKeyword)) {
    check(
      !seenPrimaryKeywords.has(seo.primaryKeyword),
      `${product.id}: shares its seo.primaryKeyword with ${seenPrimaryKeywords.get(seo.primaryKeyword)}`,
    );
    seenPrimaryKeywords.set(seo.primaryKeyword, product.id);
  }

  check(
    seo.ogTitle !== seo.metaTitle,
    `${product.id}: seo.ogTitle repeats seo.metaTitle — a share card and a search result are different jobs`,
  );
  check(
    seo.ogDescription !== seo.metaDescription,
    `${product.id}: seo.ogDescription repeats seo.metaDescription`,
  );
  check(
    seo.imageAlt !== seo.metaDescription && seo.imageAlt !== seo.ogDescription,
    `${product.id}: seo.imageAlt clones another field`,
  );
}

check(
  seenIds.size === catalogue.length,
  `ids are not unique: ${catalogue.length} products but ${seenIds.size} distinct ids`,
);

for (const slug of CATEGORY_SLUGS) {
  check(
    categoryCounts[slug] > 0,
    `category "${slug}" has no published products — its listing would render empty`,
  );
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
console.log(`Active              ${statusCounts.active}`);
console.log(`Draft               ${statusCounts.draft}`);
console.log(`Featured            ${featuredCount} (published)`);
console.log(`New arrivals        ${newCount} (published)`);
console.log(`Out of stock        ${outOfStockCount} (published)`);
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
console.log("\nSearch and social metadata");
console.log(`  with seo block     ${catalogue.filter((product) => isPlainObject(product?.seo)).length}/${catalogue.length}`);
console.log(`  unique metaTitles  ${seenMetaTitles.size}`);
console.log(`  unique keywords    ${seenPrimaryKeywords.size}`);
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

if (advisories.length > 0) {
  console.warn(
    `\nADVISORY — ${advisories.length} product(s) above the ${ADVISORY_DISCOUNT_PERCENT}% house style. Real owner prices; changing them is a business call, not a code fix:`,
  );
  for (const advisory of advisories) console.warn(`  - ${advisory}`);
}

if (marginAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${marginAdvisories.length} product(s) priced at or below cost. Margin is the owner's call, not a code fix:`,
  );
  for (const advisory of marginAdvisories) console.warn(`  - ${advisory}`);
}

if (descriptionAdvisories.length > 0) {
  console.warn(
    `\nADVISORY — ${descriptionAdvisories.length} description(s) outside the house word range. Four products are still awaiting owner copy; see docs/CATALOGUE-DATA-TODO.md:`,
  );
  for (const advisory of descriptionAdvisories) console.warn(`  - ${advisory}`);
}

if (pricedMetadataIds.length > 0) {
  console.warn(
    `\nADVISORY — ${pricedMetadataIds.length} product(s) quote an amount in their search or social copy. Re-check these when a price or the shipping threshold moves: ${pricedMetadataIds.join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nPASS — all checks green.");
