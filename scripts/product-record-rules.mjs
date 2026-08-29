/**
 * The catalogue's validation rules, as one implementation with no `process.exit` in it.
 *
 * `scripts/validate-products.mjs` used to hold these inline, which was fine for as long as the
 * gate was the only thing that validated a product. The admin product editor
 * ([ADR-064](../docs/decisions/ADR-064-admin-product-management.md)) is the second, and a
 * second copy of "what makes a record legal" is the one thing this catalogue cannot afford: an
 * editor whose rules were a subset of the gate's would let an operator save a record that then
 * fails the build, and an editor whose rules were a superset would refuse edits the gate
 * accepts.
 *
 * So the rules moved here whole, and the validator imports them. It is the same extraction
 * `min-prepaid-rule.mjs` and `banned-meta-adjectives.mjs` already did, applied to the rest of
 * the file: plain ESM with no path aliases and no TypeScript, so the gate stays runnable as
 * `node scripts/validate-products.mjs` and a Vitest suite can still import the functions.
 *
 * **Every rule reports through an injected context rather than to module state.** The gate
 * hands in a context whose counters feed its summary; the admin editor hands in a throwaway one
 * and reads only `failures`. That is what lets one record be validated on its own without
 * pretending it is a catalogue.
 */

import { findBannedMetaAdjectives } from "./banned-meta-adjectives.mjs";
import { isValidMinPrepaidAmount, minPrepaidExceedsPrice } from "./min-prepaid-rule.mjs";

export const MIN_FEATURED_COUNT = 4;
export const MIN_NEW_COUNT = 4;

/**
 * Two ceilings, because the catalogue's real prices and the discount policy disagree. Sixty
 * percent is the house style for a compare-at price: past it, an "MRP" stops reading as a
 * price anyone was ever asked to pay. Nine of the owner's real pieces are marked down further
 * than that, and their prices are not ours to rewrite (ADR-021) — so the house style is
 * reported as an advisory and the hard failure sits at eighty, which no real product reaches.
 * Retiring the advisory means changing the owner's MRPs, which is a business call. See
 * ADR-027.
 */
export const ADVISORY_DISCOUNT_PERCENT = 60;
export const MAX_IMPLIED_DISCOUNT_PERCENT = 80;

export const MIN_PRICE = 25;
export const MAX_PRICE = 25000;

/**
 * Descriptions are long-form prose, roughly 150 to 300 words over several paragraphs stored
 * with a blank line between them. The range is an advisory rather than a failure: four of the
 * owner's products are still carrying their pre-content-pass one-liner and are listed in
 * docs/CATALOGUE-DATA-TODO.md, so a hard floor would fail the gate on work that has not been
 * written yet rather than on a defect. See ADR-035.
 */
export const MIN_DESCRIPTION_WORDS = 150;
export const MAX_DESCRIPTION_WORDS = 300;

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
 * A spec key that answers "what is this made of" — `material` itself, plus every compound label
 * the migration produced that names a plating, a finish, a coating or a metal. Deliberately not
 * every key: `design`, `chain` and `dial` legitimately carry decorative descriptions like
 * "gold bead detailing", where the metal word is about the look of a component and not a claim
 * about what the piece is.
 */
const MATERIAL_FAMILY_SPEC_KEY = /plating|finish|coating|metal/i;

/**
 * A precious metal named on its own is a claim this catalogue cannot support — every piece is
 * plated, toned or an alloy (ADR-018, ADR-035). Bare here means the value names one of these
 * and nothing in the same value says how the metal is present.
 */
const PRECIOUS_METAL_WORD = /\b(?:gold|silver|platinum)\b/i;

/**
 * The words that turn a metal name into an honest one. `german silver` is on the list because
 * the trade term is itself the qualifier: it names a copper-nickel alloy containing no silver,
 * and the description skill requires the copy to say so.
 */
const METAL_QUALIFIER =
  /plat(?:ed|ing)|tone[ds]?|finish|coating|look|colou?rs?\b|anti-tarnish|german silver/i;

/**
 * Every product in the catalogue is one the owner actually stocks, and its id is the P-code
 * they use on invoices, photo filenames and every message about stock. This regex is what
 * keeps that true: an invented product cannot be added without either taking a P-code it has
 * no right to or failing here. See ADR-021.
 */
export const PRODUCT_ID = /^P\d{3}$/;

/**
 * The eleven categories, each with the state
 * [ADR-055](../docs/decisions/ADR-055-category-vocabulary-and-surfacing.md) gives it. Duplicated
 * from `CATEGORIES` in `types/product.ts` rather than imported, because this file must stay
 * runnable as plain ESM over `data/products.json` with no application code loaded.
 *
 * **It carries `status` rather than deriving surfacing from a slug name.** This list used to be
 * eleven bare strings with the browsable subset computed as
 * `CATEGORY_SLUGS.filter((slug) => slug !== "gift-hampers")`, which was correct only for as long
 * as `gift-hampers` was the one pending category and answered a question about a *name* rather
 * than about the field ADR-055 created to answer it. Flipping that category to surfaced in
 * `types/product.ts` produced a failure here telling you to do the thing you had just done, and a
 * second pending category would not have been checked at all.
 *
 * `lib/category-vocabulary.test.ts` compares this array against `types/product.ts` on both slug
 * and status, so the two cannot drift apart on either.
 */
export const CATEGORIES = [
  { slug: "necklaces", status: "surfaced" },
  { slug: "earrings", status: "surfaced" },
  { slug: "rings", status: "surfaced" },
  { slug: "bracelets", status: "surfaced" },
  { slug: "bangles", status: "surfaced" },
  { slug: "pendants", status: "surfaced" },
  { slug: "anklets", status: "surfaced" },
  { slug: "nose-pins", status: "surfaced" },
  { slug: "watches", status: "surfaced" },
  { slug: "hair-accessories", status: "surfaced" },
  { slug: "gift-hampers", status: "surfaced" },
];

/** Every slug a product record may carry. The vocabulary. */
export const CATEGORY_SLUGS = CATEGORIES.map((category) => category.slug);

/**
 * The subset a shopper can browse — `SURFACED_CATEGORIES` in `types/product.ts`, derived from the
 * same field. The difference between this and the vocabulary is checked in **both** directions
 * by `validateCatalogueFloors`: a surfaced category with nothing in it would render an empty
 * listing, and a pending category with something in it would be a product no shopper can reach.
 */
export const SURFACED_CATEGORY_SLUGS = CATEGORIES.filter(
  (category) => category.status === "surfaced",
).map((category) => category.slug);

export const COLLECTION_TAGS = ["gifting", "anti-tarnish"];

/**
 * Publication state. Required on every product rather than defaulted here, so a record that
 * forgets it fails the gate instead of being published by omission — `lib/products.ts` reads a
 * missing status as `active`, and this check is what stops anything from ever relying on that.
 * See ADR-052.
 */
export const PRODUCT_STATUSES = ["draft", "active"];

export const OPTION_TYPES = ["dropdown", "swatch", "pills", "chips"];

const VARIANT_KEY_SEPARATOR = ":";

export const PRODUCT_KEYS = [
  "id",
  "name",
  "category",
  "subcategory",
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
  "migrationProvenance",
];

/**
 * Every key `migrationProvenance` may hold, and the only ones. The block exists so a migrated
 * record keeps a link back to the listing it came from; an unrecognised key inside it is a
 * field somebody added without deciding whether it is safe to keep, so it fails here for the
 * same reason an unrecognised product key does. See ADR-056.
 */
const MIGRATION_PROVENANCE_KEYS = [
  "originalId",
  "originalSku",
  "originalUrl",
  "originalCategories",
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
export const META_TITLE_MIN = 50;
export const META_TITLE_MAX = 60;
export const META_DESCRIPTION_MIN = 140;
export const META_DESCRIPTION_MAX = 160;
export const OG_TITLE_MIN = 40;
export const OG_TITLE_MAX = 70;
export const OG_DESCRIPTION_MAX = 200;
export const IMAGE_ALT_MAX = 125;

/**
 * Repeated here rather than imported: this module is plain Node with no path aliases, and the
 * only thing it needs from `lib/config.ts` is the one number a meta description is allowed to
 * quote. Kept in sync by the shipping tests, which read the real constant.
 */
const FREE_SHIPPING_THRESHOLD = 799;

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Everything one validation pass accumulates: what failed, what is merely worth saying, and the
 * counters the gate's summary prints.
 *
 * `existsUnderPublic` is injected rather than imported because it is the one rule that needs a
 * filesystem. The gate points it at `public/`; a caller that has no filesystem to check — a unit
 * test over a synthetic record — passes one that always answers true and gets every other rule
 * unchanged.
 *
 * @param {{ existsUnderPublic: (publicPath: string) => boolean }} dependencies
 */
export function createProductRuleContext({ existsUnderPublic }) {
  const context = {
    failures: [],
    discountAdvisories: [],
    marginAdvisories: [],
    minPrepaidAdvisories: [],
    descriptionAdvisories: [],
    existsUnderPublic,
    counters: {
      seenIds: new Set(),
      statusCounts: Object.fromEntries(PRODUCT_STATUSES.map((status) => [status, 0])),
      categoryCounts: Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0])),
      priceBands: { budget: 0, mid: 0, premium: 0, outOfBand: 0 },
      optionTypeCounts: Object.fromEntries(OPTION_TYPES.map((type) => [type, 0])),
      impliedDiscounts: [],
      grossMargins: [],
      costedCount: 0,
      discountedCount: 0,
      codIneligibleCount: 0,
      featuredCount: 0,
      newCount: 0,
      outOfStockCount: 0,
      optionedProductCount: 0,
      taggedProductCount: 0,
      migratedProductCount: 0,
      primaryImagesOnDisk: 0,
      additionalImageCount: 0,
      variantImageCount: 0,
      seenMetaTitles: new Map(),
      seenPrimaryKeywords: new Map(),
      pricedMetadataIds: [],
    },
    check(condition, message) {
      if (!condition) context.failures.push(message);
    },
  };

  return context;
}

function countWords(text) {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

function countCharacters(text) {
  return [...text].length;
}

function checkLength(context, value, label, field, min, max) {
  const length = countCharacters(value);
  context.check(
    length >= min && length <= max,
    `${label}: seo.${field} is ${length} characters, outside the ${min}-${max} range a search result renders`,
  );
  return length;
}

export function validatePricing(product, label, context) {
  const { check, counters } = context;
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

  check(
    isValidMinPrepaidAmount(pricing.minPrepaidAmount),
    `${label}: pricing.minPrepaidAmount must be a whole number of rupees, zero or more (0 means the piece may be sold cash on delivery)`,
  );

  if (isValidMinPrepaidAmount(pricing.minPrepaidAmount) && pricing.minPrepaidAmount > 0) {
    counters.codIneligibleCount += 1;
  }
  if (minPrepaidExceedsPrice(pricing.minPrepaidAmount, pricing.price)) {
    context.minPrepaidAdvisories.push(
      `${label}: pricing.minPrepaidAmount ${pricing.minPrepaidAmount} exceeds pricing.price ${pricing.price} — the shopper would prepay more than the item costs`,
    );
  }

  if (isPositiveInteger(pricing.cost) && isPositiveInteger(pricing.price)) {
    counters.costedCount += 1;
    counters.grossMargins.push(((pricing.price - pricing.cost) / pricing.price) * 100);
    if (pricing.cost >= pricing.price) {
      context.marginAdvisories.push(
        `${label}: pricing.cost ${pricing.cost} is not below pricing.price ${pricing.price} — the piece sells at or under what it cost`,
      );
    }
  }

  if (isPositiveInteger(pricing.price)) {
    if (pricing.price >= MIN_PRICE && pricing.price <= 999) counters.priceBands.budget += 1;
    else if (pricing.price >= 1000 && pricing.price <= 4999) counters.priceBands.mid += 1;
    else if (pricing.price >= 5000 && pricing.price <= MAX_PRICE) counters.priceBands.premium += 1;
    else counters.priceBands.outOfBand += 1;
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
    context.discountAdvisories.push(
      `${label}: implied discount ${impliedDiscountPercent.toFixed(1)}% is above the ${ADVISORY_DISCOUNT_PERCENT}% house style`,
    );
  }

  counters.impliedDiscounts.push(impliedDiscountPercent);
  if (pricing.mrp > pricing.price) counters.discountedCount += 1;
}

export function validateOptions(product, label, context) {
  const { check, counters } = context;
  const options = product?.options;
  check(
    options === undefined || Array.isArray(options),
    `${label}: options must be an array when present`,
  );
  if (!Array.isArray(options)) return;

  counters.optionedProductCount += 1;

  options.forEach((option, index) => {
    check(
      isNonEmptyString(option?.name),
      `${label}: options[${index}].name must be a non-empty string`,
    );
    check(
      OPTION_TYPES.includes(option?.type),
      `${label}: options[${index}].type "${option?.type}" must be one of ${OPTION_TYPES.join(", ")}`,
    );
    if (OPTION_TYPES.includes(option?.type)) counters.optionTypeCounts[option.type] += 1;

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

export function validateMedia(product, label, context) {
  const { check, counters, existsUnderPublic } = context;
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
      if (fileExists) counters.primaryImagesOnDisk += 1;
    }

    check(new Set(images).size === images.length, `${label}: media.images repeats a path`);

    for (const image of images.slice(1)) {
      if (!isNonEmptyString(image)) continue;
      counters.additionalImageCount += 1;
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
    counters.variantImageCount += 1;

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

export function validateDescription(product, label, context) {
  const description = product?.description;
  if (!isNonEmptyString(description)) return;

  context.check(
    !REVIEW_METADATA.test(description),
    `${label}: description carries copy-pass review metadata — only the prose belongs in the field`,
  );

  const wordCount = countWords(description);
  if (wordCount < MIN_DESCRIPTION_WORDS || wordCount > MAX_DESCRIPTION_WORDS) {
    context.descriptionAdvisories.push(
      `${label}: ${wordCount} words, outside the ${MIN_DESCRIPTION_WORDS}-${MAX_DESCRIPTION_WORDS} word house range`,
    );
  }
}

export function validateNoPreciousMetalClaim(product, label, context) {
  const shopperFacing = [
    product?.name,
    product?.description,
    ...Object.values(product?.specs ?? {}),
    ...(product?.options ?? []).flatMap((option) => [option?.name, ...(option?.values ?? [])]),
  ].filter(isNonEmptyString);

  for (const text of shopperFacing) {
    context.check(
      !PRECIOUS_METAL_CLAIM.test(text),
      `${label}: "${text}" makes a precious-metal claim this catalogue cannot support`,
    );
  }
}

/**
 * The bare-metal rule, over material-family spec keys only. `validateNoPreciousMetalClaim`
 * above catches the karat and hallmark vocabulary; this catches the quieter version, a
 * `material` that reads simply "Rose gold" or "Silver" because a compound label was flattened
 * and the qualifier that made it honest was the half that got dropped. Five records were in
 * that state when this check was written.
 *
 * Hard rather than advisory, for the same reason the karat rule is hard: the record says the
 * piece is made of a precious metal and it is not, which is a false claim to a shopper rather
 * than a style note. The catalogue is at zero violations, so the gate can hold the line from
 * here rather than accumulating a backlog nobody reads.
 */
export function validateNoBarePreciousMetalSpec(product, label, context) {
  const specs = product?.specs;
  if (!isPlainObject(specs)) return;

  for (const [key, value] of Object.entries(specs)) {
    if (!isNonEmptyString(value)) continue;
    if (key !== "material" && !MATERIAL_FAMILY_SPEC_KEY.test(key)) continue;
    if (!PRECIOUS_METAL_WORD.test(value)) continue;

    context.check(
      METAL_QUALIFIER.test(value),
      `${label}: specs.${key} is "${value}" — a precious metal named with no plating, tone, finish or coating qualifier. Nothing in this catalogue is solid gold or silver; use the phrase the confirmed draft attribute carried`,
    );
  }
}

export function validateSpecs(product, label, context) {
  const { check } = context;
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
 * The search and social metadata, checked for the two things a page cannot recover from once
 * published: a field that is missing, and a field the wrong length for the surface it renders
 * on. Uniqueness of `metaTitle` and `primaryKeyword` is checked across the batch by
 * `validateCatalogueSeoUniqueness`, because two products sharing either is a collision the
 * per-product pass cannot see. See ADR-036.
 */
export function validateSeo(product, label, context) {
  const { check, counters } = context;
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
    checkLength(context, seo.metaTitle, label, "metaTitle", META_TITLE_MIN, META_TITLE_MAX);
  }
  if (isNonEmptyString(seo.metaDescription)) {
    checkLength(
      context,
      seo.metaDescription,
      label,
      "metaDescription",
      META_DESCRIPTION_MIN,
      META_DESCRIPTION_MAX,
    );
  }
  if (isNonEmptyString(seo.ogTitle)) {
    checkLength(context, seo.ogTitle, label, "ogTitle", OG_TITLE_MIN, OG_TITLE_MAX);
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
    for (const adjective of findBannedMetaAdjectives(text)) {
      check(false, `${label}: seo copy uses the barred adjective "${adjective}"`);
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

  const quotedAmounts = [...metaFields.join(" ").matchAll(/₹(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  for (const amount of quotedAmounts) {
    check(
      amount === product?.pricing?.price || amount === FREE_SHIPPING_THRESHOLD,
      `${label}: seo copy quotes ₹${amount}, which is neither the price ₹${product?.pricing?.price} nor the free-shipping threshold`,
    );
  }
  if (quotedAmounts.length > 0) counters.pricedMetadataIds.push(product.id);
}

/**
 * The catalogue holds no ratings and no reviews, and the `unknownProductKeys` check in
 * `validateProductRecord` is what keeps it that way: `rating` and `reviews` are off
 * `PRODUCT_KEYS`, so a record carrying either fails there rather than reaching a Product schema.
 * Reviews come back when there are real ones to publish, and this validator gains the shape
 * checks again at that point. See ADR-034.
 */
export function validateNoFabricatedReception(product, label, context) {
  context.check(
    product?.rating === undefined,
    `${label}: rating must not be present — this store publishes no ratings it has not collected`,
  );
  context.check(
    product?.reviews === undefined,
    `${label}: reviews must not be present — this store publishes no reviews it has not collected`,
  );
}

export function validateStatus(product, label, context) {
  const status = product?.status;
  context.check(
    PRODUCT_STATUSES.includes(status),
    `${label}: status must be one of ${PRODUCT_STATUSES.join(", ")} — found ${JSON.stringify(status)}`,
  );
  if (PRODUCT_STATUSES.includes(status)) context.counters.statusCounts[status] += 1;
}

export function isPublished(product) {
  return product?.status !== "draft";
}

/**
 * The stock and merchandising counters below are the floors that keep a rendered surface
 * populated — the home best-sellers row, the new-arrivals row, the sold-out styling. A draft
 * reaches none of those, so it is counted towards none of them: a catalogue whose only four
 * featured pieces are unpublished has an empty row, and the gate should say so.
 */
export function validateStockAndFlags(product, label, context) {
  const { check, counters } = context;
  const published = isPublished(product);
  const stock = product?.stock;
  check(isPlainObject(stock), `${label}: stock must be an object`);
  if (isPlainObject(stock)) {
    check(
      typeof stock.inStock === "boolean",
      `${label}: stock.inStock must be a boolean`,
    );
    if (stock.inStock === false && published) counters.outOfStockCount += 1;
  }

  const flags = product?.flags;
  check(isPlainObject(flags), `${label}: flags must be an object`);
  if (!isPlainObject(flags)) return;

  check(
    typeof flags.featured === "boolean",
    `${label}: flags.featured must be a boolean`,
  );
  check(typeof flags.isNew === "boolean", `${label}: flags.isNew must be a boolean`);
  if (flags.featured === true && published) counters.featuredCount += 1;
  if (flags.isNew === true && published) counters.newCount += 1;
}

/**
 * `subcategory` and `migrationProvenance` are both optional and both absent from every
 * hand-written product. What is checked is that a record carrying either carries it in full:
 * a subcategory that is present but blank says nothing, and a provenance block missing its
 * `originalId` is a link back to the source system that cannot be followed.
 *
 * `originalSku` and `originalUrl` are nullable because the export genuinely omits them for
 * some listings, and a null recorded on purpose is worth more than a field quietly dropped.
 * See ADR-056.
 */
export function validateMigrationFields(product, label, context) {
  const { check, counters } = context;
  const { subcategory } = product ?? {};
  check(
    subcategory === undefined || isNonEmptyString(subcategory),
    `${label}: subcategory must be a non-empty string when present`,
  );

  const provenance = product?.migrationProvenance;
  if (provenance === undefined) return;

  check(
    isPlainObject(provenance),
    `${label}: migrationProvenance must be an object when present`,
  );
  if (!isPlainObject(provenance)) return;

  counters.migratedProductCount += 1;

  const unknownKeys = Object.keys(provenance).filter(
    (key) => !MIGRATION_PROVENANCE_KEYS.includes(key),
  );
  check(
    unknownKeys.length === 0,
    `${label}: migrationProvenance has unknown keys ${unknownKeys.join(", ")}`,
  );

  check(
    isNonEmptyString(provenance.originalId),
    `${label}: migrationProvenance.originalId must be a non-empty string — it is the link back to the source listing`,
  );
  for (const field of ["originalSku", "originalUrl"]) {
    check(
      provenance[field] === null || isNonEmptyString(provenance[field]),
      `${label}: migrationProvenance.${field} must be null or a non-empty string`,
    );
  }
  check(
    Array.isArray(provenance.originalCategories),
    `${label}: migrationProvenance.originalCategories must be an array`,
  );
  if (!Array.isArray(provenance.originalCategories)) return;
  provenance.originalCategories.forEach((entry, index) => {
    check(
      isNonEmptyString(entry),
      `${label}: migrationProvenance.originalCategories[${index}] must be a non-empty string`,
    );
  });
}

export function validateCollections(product, label, context) {
  const { check, counters } = context;
  const collections = product?.collections;
  check(
    collections === undefined || Array.isArray(collections),
    `${label}: collections must be an array when present`,
  );
  if (!Array.isArray(collections)) return;

  counters.taggedProductCount += 1;
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

/**
 * Everything that can be decided about one record by looking at that record alone.
 *
 * `seenIds` lives on the context rather than being reset here, so calling this across a
 * catalogue detects a duplicate id the same way the gate's loop always did. Validating a single
 * record with a fresh context therefore never reports a duplicate against itself.
 */
export function validateProductRecord(product, label, context) {
  const { check, counters } = context;

  check(isNonEmptyString(product?.id), `${label}: id must be a non-empty string`);
  check(!counters.seenIds.has(product?.id), `${label}: duplicate id`);
  counters.seenIds.add(product?.id);

  check(
    PRODUCT_ID.test(product?.id ?? ""),
    `${label}: id must be the owner's P-code in the form P001 — the catalogue holds no invented products`,
  );

  check(isNonEmptyString(product?.name), `${label}: name must be a non-empty string`);
  check(
    isNonEmptyString(product?.description),
    `${label}: description must be a non-empty string`,
  );
  validateDescription(product, label, context);
  validateNoPreciousMetalClaim(product, label, context);
  validateNoBarePreciousMetalSpec(product, label, context);
  check(
    CATEGORY_SLUGS.includes(product?.category),
    `${label}: category "${product?.category}" is not a known slug`,
  );
  if (CATEGORY_SLUGS.includes(product?.category) && isPublished(product)) {
    counters.categoryCounts[product.category] += 1;
  }

  validatePricing(product, label, context);
  validateOptions(product, label, context);
  validateMedia(product, label, context);
  validateSpecs(product, label, context);
  validateSeo(product, label, context);
  validateNoFabricatedReception(product, label, context);
  validateStatus(product, label, context);
  validateStockAndFlags(product, label, context);
  validateCollections(product, label, context);
  validateMigrationFields(product, label, context);

  const unknownProductKeys = Object.keys(product ?? {}).filter(
    (key) => !PRODUCT_KEYS.includes(key),
  );
  check(
    unknownProductKeys.length === 0,
    `${label}: unknown keys ${unknownProductKeys.join(", ")}`,
  );
}

/**
 * The collisions no single record can see: two products claiming one `metaTitle`, two claiming
 * one `primaryKeyword`, and the three ways a record can clone one of its own SEO fields into
 * another.
 *
 * This is the check the admin editor most needs from the catalogue rather than from the record
 * it is saving — changing a keyword to one another product already owns is the easiest way to
 * break the catalogue's SEO guarantees from a form that looks entirely reasonable.
 */
export function validateCatalogueSeoUniqueness(catalogue, context) {
  const { check, counters } = context;

  for (const product of catalogue) {
    const seo = product?.seo;
    if (!isPlainObject(seo)) continue;

    if (isNonEmptyString(seo.metaTitle)) {
      check(
        !counters.seenMetaTitles.has(seo.metaTitle),
        `${product.id}: shares its seo.metaTitle with ${counters.seenMetaTitles.get(seo.metaTitle)}`,
      );
      counters.seenMetaTitles.set(seo.metaTitle, product.id);
    }

    if (isNonEmptyString(seo.primaryKeyword)) {
      check(
        !counters.seenPrimaryKeywords.has(seo.primaryKeyword),
        `${product.id}: shares its seo.primaryKeyword with ${counters.seenPrimaryKeywords.get(seo.primaryKeyword)}`,
      );
      counters.seenPrimaryKeywords.set(seo.primaryKeyword, product.id);
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
}

/**
 * The floors a whole catalogue has to clear for the rendered surfaces to be populated: every
 * surfaced category has something in it, the two home rows have enough to fill them, the
 * sold-out styling keeps its coverage, and no price falls outside the band.
 *
 * These are catalogue-level and the admin editor checks them too, because a single edit can
 * break one — unfeaturing the fourth featured piece empties the home best-sellers row, and the
 * operator who did it should be told before the build is.
 *
 * Call only after `validateProductRecord` has run over every record: the counters it reads are
 * the ones that pass fills in.
 */
export function validateCatalogueFloors(context) {
  const { check, counters } = context;

  for (const slug of SURFACED_CATEGORY_SLUGS) {
    check(
      counters.categoryCounts[slug] > 0,
      `category "${slug}" is surfaced but has no published products — its listing would render empty`,
    );
  }

  for (const slug of CATEGORY_SLUGS.filter(
    (candidate) => !SURFACED_CATEGORY_SLUGS.includes(candidate),
  )) {
    check(
      counters.categoryCounts[slug] === 0,
      `category "${slug}" is still pending but has ${counters.categoryCounts[slug]} published product(s) — flip its status to "surfaced" in types/product.ts, or nobody can reach them`,
    );
  }

  check(
    counters.featuredCount >= MIN_FEATURED_COUNT,
    `expected at least ${MIN_FEATURED_COUNT} featured products to fill the home best-sellers row, found ${counters.featuredCount}`,
  );
  check(
    counters.newCount >= MIN_NEW_COUNT,
    `expected at least ${MIN_NEW_COUNT} isNew products to fill the home new-arrivals row, found ${counters.newCount}`,
  );
  check(
    counters.outOfStockCount >= 1,
    "expected at least one out-of-stock product so the sold-out UI keeps coverage",
  );
  check(
    counters.priceBands.outOfBand === 0,
    `${counters.priceBands.outOfBand} products fall outside the ${MIN_PRICE}-${MAX_PRICE} price range`,
  );
}
