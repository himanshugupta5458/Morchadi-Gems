import type {
  CollectionSlug,
  Product,
  ProductFlags,
  ProductMedia,
  ProductMigrationProvenance,
  ProductOption,
  ProductPricing,
  ProductSeo,
  ProductSpecs,
  VariantImages,
} from "@/types/product";
import { COLLECTION_TAGS, isCategory, isProductOptionType } from "@/types/product";
import type { KeywordCollisionReport, KeywordMap } from "@/lib/keyword-collision-check";
import { canonicaliseKeyword, checkPrimaryKeywordCollision } from "@/lib/keyword-collision-check";

/**
 * The Draft A shape as `.claude/skills/draft-a-skills.md` defines it, narrowed to the fields
 * this module reads. Every field is declared as what the *file* may legally hold rather than
 * as what a valid draft holds — a draft arriving here is parsed JSON, so `null` and `undefined`
 * are both real possibilities and are checked rather than assumed away.
 */
export interface DraftAttributeSource {
  origin: string;
  quotedPhrase: string;
}

export interface DraftAttribute {
  label: string;
  value: string;
  displayTerm: string | null;
  stoneSource: "known-trade-term" | "unverified-guess" | null;
  source: DraftAttributeSource | null;
  confirmed: boolean;
}

export interface DraftVariant {
  optionName: string;
  values: string[];
}

/**
 * One suggested photograph, in the same always-propose-always-confirm shape as
 * `DraftAttribute`. Stage 0 writes the path it derived from the source export and sets
 * `confirmed: false`; the manual image-assignment step is what turns that into `true`, and
 * nothing else may. A suggestion the reviewer declined is deleted from the draft rather than
 * left unconfirmed, so "present but unconfirmed" means review has not reached it yet.
 *
 * `sourceFile` and `role` are the provenance that used to sit in a parallel
 * `imageSuggestionProvenance` block and could not cross into a Draft A object. They ride
 * inside the suggestion now, which is what makes them survive extraction. See ADR-056.
 */
export interface DraftGeneralImage {
  path: string;
  confirmed: boolean;
  sourceFile?: string | null;
  role?: string | null;
}

/**
 * A suggested variant photograph. `verifiedDistinct` is the source system's own hash check —
 * evidence that two files differ, never evidence that this is the right photograph for this
 * variant. It is carried for the person doing the confirming and is read by nothing else. A
 * missing flag reads as *not* verified.
 */
export interface DraftVariantImage {
  path: string;
  confirmed: boolean;
  sourceFile?: string | null;
  verifiedDistinct?: boolean;
}

export interface DraftImages {
  general: DraftGeneralImage[];
  variantImages: Record<string, DraftVariantImage>;
}

/**
 * What Stage 0 transcribed off the source listing. `rawContent` and `referenceTitle` are raw
 * material for the copy skills; the four `original*` fields are the link back to the listing
 * this product came from, and are the only source `migrationProvenance` has.
 */
export interface DraftSourceNotes {
  originalId?: string | null;
  originalSku?: string | null;
  originalUrl?: string | null;
  originalCategories?: string[];
  referenceTitle?: string | null;
  rawContent?: string | null;
}

export interface DraftPricing {
  price: number | null;
  mrp: number | null;
  cost: number | null;
  referencePrice: string | null;
}

export interface DraftA {
  productId: string;
  sourceType: "fresh" | "migrated";
  category: string | null;
  subcategory: string | null;
  variants: DraftVariant[];
  attributes: DraftAttribute[];
  images: DraftImages;
  sourceNotes?: DraftSourceNotes | null;
  pricing: DraftPricing;
  personalized: boolean | null;
  suggestedCollections: string[];
  status: string;
}

export type MappingSeverity = "error" | "advisory";

export interface MappingIssue {
  severity: MappingSeverity;
  field: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(field: string, message: string): MappingIssue {
  return { severity: "error", field, message };
}

function advisory(field: string, message: string): MappingIssue {
  return { severity: "advisory", field, message };
}

/**
 * The spec keys the storefront already knows how to order and label, from
 * `PREFERRED_SPEC_ORDER` in `lib/specs.ts`. A Draft A label that resolves to one of these
 * lands beside every other product's; anything else becomes its own key, which `ProductSpecs`
 * permits by design (ADR-027) and `lib/specs.ts` renders by capitalising the first letter.
 */
export const CANONICAL_SPEC_KEYS = [
  "material",
  "weight",
  "closure",
  "type",
  "stone",
  "size",
  "colour",
] as const;

export type CanonicalSpecKey = (typeof CANONICAL_SPEC_KEYS)[number];

/**
 * Draft A labels are written by the extraction skill in whatever words the source used, so the
 * mapping is by **label synonym**, stated here in full rather than guessed per draft. The table
 * is deliberately narrow: a label it does not recognise is not an error and is not coerced, it
 * simply keeps its own name.
 *
 * `plating`, `finish` and `metal` all resolve to `material` on purpose. Draft A rule 2 requires
 * the maximal phrase — `18K gold-plated stainless steel`, never `gold-plated` plus `steel` —
 * so a draft carrying both a Material and a Plating attribute has split a phrase that should
 * not have been split, and the duplicate-key refusal below is the right place to catch it.
 */
export const SPEC_LABEL_ALIASES: Readonly<Record<string, CanonicalSpecKey>> = {
  material: "material",
  materials: "material",
  metal: "material",
  "base metal": "material",
  "base material": "material",
  plating: "material",
  finish: "material",
  stone: "stone",
  stones: "stone",
  gem: "stone",
  gems: "stone",
  gemstone: "stone",
  gemstones: "stone",
  type: "type",
  "product type": "type",
  style: "type",
  form: "type",
  size: "size",
  sizes: "size",
  dimension: "size",
  dimensions: "size",
  measurement: "size",
  measurements: "size",
  length: "size",
  "chain length": "size",
  closure: "closure",
  "closure type": "closure",
  clasp: "closure",
  fastening: "closure",
  back: "closure",
  backing: "closure",
  weight: "weight",
  colour: "colour",
  color: "colour",
  "colour family": "colour",
};

/**
 * Lower-cased, punctuation dropped, whitespace collapsed. This is the form a label is looked up
 * in and, when the lookup misses, the form it is filed under — `validate-products.mjs` requires
 * a lower-case spec key and permits nothing else about it.
 */
export function canonicaliseSpecLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveSpecKey(label: string): string {
  const canonical = canonicaliseSpecLabel(label);
  return SPEC_LABEL_ALIASES[canonical] ?? canonical;
}

/**
 * Whitespace collapsed and the first character upper-cased, and nothing else. The rest of the
 * value is left exactly as the owner confirmed it, so `cat's-eye`, `CZ` and `18K` survive a
 * mapping that would otherwise quietly re-case a claim somebody checked by hand.
 */
export function formatSpecValue(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  return collapsed.length === 0
    ? collapsed
    : collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}

export interface SpecMappingResult {
  specs: ProductSpecs;
  issues: MappingIssue[];
}

/**
 * Draft A's flexible `attributes` array becomes the product record's `specs` object.
 *
 * The value written is always `attribute.value` — the confirmed technical term — and never
 * `displayTerm`, which holds the trade name the source used (`American Diamond`). The
 * catalogue's honesty rules (ADR-018, ADR-035) are about what the record *claims*, and a
 * trade name in `specs.stone` is a claim the shop cannot substantiate.
 */
export function mapAttributesToSpecs(
  attributes: readonly DraftAttribute[],
): SpecMappingResult {
  const specs: ProductSpecs = {};
  const issues: MappingIssue[] = [];
  const claimedBy = new Map<string, string>();

  attributes.forEach((attribute, index) => {
    const field = `attributes[${index}]`;

    if (attribute === null || typeof attribute !== "object") {
      issues.push(error(field, "attribute must be an object"));
      return;
    }

    const label = typeof attribute.label === "string" ? attribute.label : "";
    const value = typeof attribute.value === "string" ? attribute.value : "";

    if (canonicaliseSpecLabel(label).length === 0) {
      issues.push(error(`${field}.label`, "label must be a non-empty string, since it becomes the spec key"));
      return;
    }
    if (formatSpecValue(value).length === 0) {
      issues.push(
        error(`${field}.value`, `attribute "${label}" has no value. An unset candidate cannot become a spec`),
      );
      return;
    }
    if (attribute.confirmed !== true) {
      issues.push(
        error(
          `${field}.confirmed`,
          `attribute "${label}" is not confirmed. Every candidate is an owner decision before it reaches the catalogue`,
        ),
      );
      return;
    }

    const key = resolveSpecKey(label);
    const previousLabel = claimedBy.get(key);
    if (previousLabel !== undefined) {
      issues.push(
        error(
          `${field}.label`,
          `"${label}" and "${previousLabel}" both map to specs.${key}. Merge them into one maximal phrase in the draft, which is Draft A rule 2, rather than deciding here which one the record keeps`,
        ),
      );
      return;
    }

    claimedBy.set(key, label);
    specs[key] = formatSpecValue(value);

    if (SPEC_LABEL_ALIASES[canonicaliseSpecLabel(label)] === undefined) {
      issues.push(
        advisory(
          `${field}.label`,
          `"${label}" is not a known spec label, so it keeps its own key specs.${key} and renders as "${key.charAt(0).toUpperCase()}${key.slice(1)}". Legal, since specs is open-ended, but check that it reads as a label`,
        ),
      );
    }
    if (attribute.stoneSource === "unverified-guess") {
      issues.push(
        advisory(
          `${field}.stoneSource`,
          `"${label}" was proposed as an unverified guess. Confirmation cleared it for publication; this is a note that it never had a reference list behind it`,
        ),
      );
    }
    if (
      typeof attribute.displayTerm === "string" &&
      attribute.displayTerm.trim().length > 0 &&
      canonicaliseSpecLabel(attribute.displayTerm) !== canonicaliseSpecLabel(value)
    ) {
      issues.push(
        advisory(
          `${field}.displayTerm`,
          `specs.${key} carries the technical value "${formatSpecValue(value)}"; the trade name "${attribute.displayTerm}" is not written to the record and may appear in copy only where the copy also says what it is`,
        ),
      );
    }
  });

  if (Object.keys(specs).length === 0) {
    issues.push(error("attributes", "specs must carry at least one entry, and no attribute mapped to one"));
  }

  return { specs, issues };
}

export interface OptionMappingResult {
  options: ProductOption[];
  issues: MappingIssue[];
}

/**
 * Draft A's `variants` become `options`. Two fields have no source in the draft and are not
 * invented here:
 *
 * - **`type`** is catalogue data, not a count-based guess (ADR-027) — four locket shapes are a
 *   set to compare, four ribbon colours are a set to look at — so it is supplied per option
 *   name by the caller and its absence is a refusal.
 * - **`default`** is the first listed value, because Draft A rule 11 records option values in
 *   the order the source stated them and a first value is a stated one. Override it by
 *   reordering the draft's values, never by editing the product record after the fact.
 */
export function mapVariantsToOptions(
  variants: readonly DraftVariant[],
  optionTypes: Readonly<Record<string, string>> = {},
): OptionMappingResult {
  const options: ProductOption[] = [];
  const issues: MappingIssue[] = [];
  const seenNames = new Set<string>();

  variants.forEach((variant, index) => {
    const field = `variants[${index}]`;

    if (variant === null || typeof variant !== "object") {
      issues.push(error(field, "variant must be an object"));
      return;
    }

    const name = typeof variant.optionName === "string" ? variant.optionName.trim() : "";
    if (name.length === 0) {
      issues.push(error(`${field}.optionName`, "optionName must be a non-empty string"));
      return;
    }
    if (seenNames.has(name.toLowerCase())) {
      issues.push(error(`${field}.optionName`, `"${name}" is declared twice. One option group per name`));
      return;
    }

    const values = Array.isArray(variant.values)
      ? variant.values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    if (values.length === 0) {
      issues.push(error(`${field}.values`, `option "${name}" has no values. A choice with nothing to choose is not an option`));
      return;
    }

    const declaredType = optionTypes[name];
    if (declaredType === undefined || !isProductOptionType(declaredType)) {
      issues.push(
        error(
          `${field}.optionName`,
          `option "${name}" has no control type. ADR-027 makes the control catalogue data rather than a guess from the number of values, so declare it as dropdown, swatch, pills or chips`,
        ),
      );
      return;
    }

    seenNames.add(name.toLowerCase());
    options.push({ name, type: declaredType, values, default: values[0] });
  });

  return { options, issues };
}

export interface MediaMappingResult {
  media: ProductMedia;
  issues: MappingIssue[];
}

/**
 * `images.general` becomes `media.images` and `images.variantImages` becomes
 * `media.variantImages`. Both already use the storefront's own key format —
 * `"OptionName:value"` — so this is a rename and not a translation (ADR-050).
 *
 * **Only a confirmed suggestion is carried forward**, which is the same rule
 * `mapAttributesToSpecs` applies to a candidate value and for the same reason: a path Stage 0
 * derived from an export is a proposal, and a proposal nobody approved is not a photograph
 * this shop publishes. An unconfirmed entry is dropped with an advisory rather than in
 * silence, so a draft that reaches the mapper mid-review says so. `validatePublishReadiness`
 * is the gate that refuses it earlier. See ADR-056.
 *
 * The one structural thing checked is that every variant key names an option the product
 * actually declares. A photograph keyed to a value nothing can select is unreachable, and the
 * unified gallery strip renders every mapped photograph, so it would render a thumbnail no
 * swatch ever selects back.
 */
export function mapImagesToMedia(
  images: DraftImages,
  options: readonly ProductOption[],
): MediaMappingResult {
  const issues: MappingIssue[] = [];

  const general: string[] = [];
  const rawGeneral = Array.isArray(images?.general) ? images.general : [];
  rawGeneral.forEach((entry, index) => {
    const field = `images.general[${index}]`;
    const path = isRecord(entry) && typeof entry.path === "string" ? entry.path.trim() : "";

    if (path.length === 0) {
      issues.push(
        error(
          field,
          "each general image must be an object carrying a non-empty path and a confirmed flag. A bare path string records nothing about whether a person approved it",
        ),
      );
      return;
    }
    if (entry.confirmed !== true) {
      issues.push(
        advisory(
          field,
          `"${path}" is still confirmed: false, so it is not written to media.images. An image suggestion is an owner decision before it reaches the catalogue`,
        ),
      );
      return;
    }
    general.push(path);
  });

  if (general.length === 0) {
    issues.push(
      error(
        "images.general",
        "images.general must hold at least one confirmed path. media.images[0] is every listing's photograph",
      ),
    );
  }

  const variantImages: VariantImages = {};
  const rawVariantImages = images?.variantImages;
  if (isRecord(rawVariantImages)) {
    for (const [key, entry] of Object.entries(rawVariantImages)) {
      const field = `images.variantImages["${key}"]`;
      const path = isRecord(entry) && typeof entry.path === "string" ? entry.path.trim() : "";

      if (path.length === 0) {
        issues.push(
          error(
            field,
            "each variant image must be an object carrying a non-empty path and a confirmed flag",
          ),
        );
        continue;
      }

      const separator = key.indexOf(":");
      if (separator <= 0 || separator === key.length - 1) {
        issues.push(error(field, 'variant image key must read "OptionName:value"'));
        continue;
      }

      const optionName = key.slice(0, separator);
      const optionValue = key.slice(separator + 1);
      const matchedOption = options.find((option) => option.name === optionName);
      if (matchedOption === undefined) {
        issues.push(
          error(
            field,
            `no option named "${optionName}". A photograph keyed to a choice the product does not offer is unreachable`,
          ),
        );
        continue;
      }
      if (!matchedOption.values.includes(optionValue)) {
        issues.push(error(field, `option "${optionName}" has no value "${optionValue}"`));
        continue;
      }

      if (entry.confirmed !== true) {
        issues.push(
          advisory(
            field,
            `"${path}" is still confirmed: false, so it is not written to media.variantImages`,
          ),
        );
        continue;
      }

      variantImages[key] = path;
    }
  }

  const media: ProductMedia =
    Object.keys(variantImages).length === 0
      ? { images: general }
      : { images: general, variantImages };

  return { media, issues };
}

export interface ProvenanceMappingResult {
  /** `null` for a fresh draft and for a migrated one carrying no source id. */
  migrationProvenance: ProductMigrationProvenance | null;
  issues: MappingIssue[];
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * `sourceNotes` becomes `migrationProvenance` — the record's link back to the listing it came
 * from. Only a migrated draft may carry one: provenance on a piece this shop wrote from
 * scratch would be a claim about an origin that does not exist.
 *
 * `originalId` is the field the block exists for, so a migrated draft without one loses its
 * provenance entirely rather than gaining a block with a hole in it, and says so out loud.
 * That is an advisory rather than an error because a draft can legitimately be migrated in
 * *copy* and hand-entered in *identity*; what it may never be is silently unlinked, which is
 * what happened before ADR-056.
 */
export function mapMigrationProvenance(
  sourceType: unknown,
  sourceNotes: DraftSourceNotes | null | undefined,
): ProvenanceMappingResult {
  const issues: MappingIssue[] = [];
  const notes = isRecord(sourceNotes) ? sourceNotes : {};
  const originalId = readNullableString(notes.originalId);

  if (sourceType !== "migrated") {
    if (originalId !== null) {
      issues.push(
        advisory(
          "sourceNotes.originalId",
          `sourceType is "${String(sourceType)}", so the source id ${originalId} is not written to the record. Provenance belongs only to a migrated listing`,
        ),
      );
    }
    return { migrationProvenance: null, issues };
  }

  if (originalId === null) {
    issues.push(
      advisory(
        "sourceNotes.originalId",
        "this draft is migrated but carries no sourceNotes.originalId, so the record ships with no link back to the listing it came from",
      ),
    );
    return { migrationProvenance: null, issues };
  }

  const originalCategories = Array.isArray(notes.originalCategories)
    ? notes.originalCategories
        .map((entry) => readNullableString(entry))
        .filter((entry): entry is string => entry !== null)
    : [];

  return {
    migrationProvenance: {
      originalId,
      originalSku: readNullableString(notes.originalSku),
      originalUrl: readNullableString(notes.originalUrl),
      originalCategories,
    },
    issues,
  };
}

export interface PricingMappingResult {
  pricing: ProductPricing | null;
  issues: MappingIssue[];
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * `mrp` falls back to `price` when the draft leaves it unset, which is the honest reading of
 * "no compare-at price was decided" — an mrp equal to the price shows no discount at all. `cost`
 * has no such fallback: `validate-products.mjs` requires a positive whole number and there is no
 * defensible value to invent for what a piece cost the shop.
 */
export function mapPricing(pricing: DraftPricing): PricingMappingResult {
  const issues: MappingIssue[] = [];

  if (pricing === null || typeof pricing !== "object") {
    return { pricing: null, issues: [error("pricing", "pricing must be an object")] };
  }

  if (!isPositiveInteger(pricing.price)) {
    issues.push(
      error("pricing.price", "price must be a positive whole number of rupees, the owner's explicit decision made in review"),
    );
  }
  if (!isPositiveInteger(pricing.cost)) {
    issues.push(
      error(
        "pricing.cost",
        "cost must be a positive whole number of rupees. It is margin data the catalogue validator requires and nothing may guess",
      ),
    );
  }
  if (pricing.mrp !== null && !isPositiveInteger(pricing.mrp)) {
    issues.push(error("pricing.mrp", "mrp must be null or a positive whole number of rupees"));
  }

  if (!isPositiveInteger(pricing.price) || !isPositiveInteger(pricing.cost)) {
    return { pricing: null, issues };
  }

  const mrp = isPositiveInteger(pricing.mrp) ? pricing.mrp : pricing.price;
  if (mrp < pricing.price) {
    issues.push(error("pricing.mrp", `mrp ${mrp} is below price ${pricing.price}`));
    return { pricing: null, issues };
  }
  if (pricing.mrp === null) {
    issues.push(
      advisory("pricing.mrp", `mrp was unset, so it is written equal to price (₹${pricing.price}) and the page shows no discount`),
    );
  }
  if (pricing.cost >= pricing.price) {
    issues.push(
      advisory("pricing.cost", `cost ₹${pricing.cost} is not below price ₹${pricing.price}, so the piece sells at or under what it cost`),
    );
  }

  return { pricing: { price: pricing.price, mrp, cost: pricing.cost }, issues };
}

export interface CollectionMappingResult {
  collections: CollectionSlug[];
  issues: MappingIssue[];
}

/**
 * Only the two hand-tagged collections may be carried on a record. `best-sellers` and
 * `new-arrivals` are derived from `flags` (ADR-020, ADR-024) and a record that tags itself into
 * one is asserting a merchandising outcome rather than a fact about the piece.
 */
export function mapCollections(suggested: readonly string[]): CollectionMappingResult {
  const collections: CollectionSlug[] = [];
  const issues: MappingIssue[] = [];

  if (!Array.isArray(suggested)) {
    return { collections, issues: [error("suggestedCollections", "suggestedCollections must be an array")] };
  }

  suggested.forEach((slug, index) => {
    const match = COLLECTION_TAGS.find((tag) => tag === slug);
    if (match === undefined) {
      issues.push(
        error(
          `suggestedCollections[${index}]`,
          `"${String(slug)}" is not a taggable collection. Only ${COLLECTION_TAGS.join(" and ")} are carried on a record; best-sellers and new-arrivals are derived from flags`,
        ),
      );
      return;
    }
    if (collections.includes(match)) return;
    collections.push(match);
  });

  return { collections, issues };
}

/**
 * What the skill writes and this module cannot derive: the product's name, its description, and
 * its SEO block. All three are generated by `product-skills.md` and `meta-skills.md` against the
 * confirmed draft, and arrive here already written.
 */
export interface AuthoredContent {
  name: string;
  description: string;
  seo: ProductSeo;
}

export interface ProductBuildInput {
  draft: DraftA;
  content: AuthoredContent;
  /** Control type per option name. Required for every variant the draft declares. */
  optionTypes?: Readonly<Record<string, string>>;
  /** Defaults to `{ featured: false, isNew: true }` — a product nobody has merchandised yet. */
  flags?: ProductFlags;
  /** Defaults to `true`. A piece being published is one the shop has. */
  inStock?: boolean;
}

export interface ProductBuildResult {
  /** `null` whenever any error was raised. A partial product is never returned. */
  product: Product | null;
  errors: MappingIssue[];
  advisories: MappingIssue[];
}

/**
 * Assembles one catalogue record from a confirmed Draft A object plus the copy written for it.
 *
 * **`status` is always `"draft"`.** Publication is `scripts/publish-product.mjs` and a separate
 * owner decision (ADR-052); nothing that writes a record also switches it on.
 *
 * **`subcategory` and `migrationProvenance` are carried through here and nowhere else.** Both
 * are server-only catalogue data: `lib/products.ts`'s `toCatalogueEntry` whitelist is what
 * keeps them out of a browser bundle, and `lib/product-provenance.test.ts` is what checks that
 * it still does. See ADR-056.
 *
 * This function does not run `validatePublishReadiness`, the keyword collision check or the
 * similarity gate. Those are the orchestration skill's gates and run before it, so that a draft
 * that fails one never reaches the point of having a record built for it.
 */
export function buildProductFromDraft(input: ProductBuildInput): ProductBuildResult {
  const { draft, content, optionTypes = {}, flags, inStock } = input;
  const issues: MappingIssue[] = [];

  const id = typeof draft?.productId === "string" ? draft.productId.trim() : "";
  if (id.length === 0) issues.push(error("productId", "productId must be a non-empty string"));

  const category = typeof draft?.category === "string" && isCategory(draft.category) ? draft.category : null;
  if (category === null) {
    issues.push(
      error(
        "category",
        "category must be resolved to one of the ten fixed slugs before publish. It is the record's first-tier identity",
      ),
    );
  }

  const name = typeof content?.name === "string" ? content.name.trim() : "";
  if (name.length === 0) issues.push(error("content.name", "name must be a non-empty string"));

  const description = typeof content?.description === "string" ? content.description.trim() : "";
  if (description.length === 0) {
    issues.push(error("content.description", "description must be a non-empty string"));
  }

  if (content?.seo === null || typeof content?.seo !== "object") {
    issues.push(error("content.seo", "seo must be the block meta-skills.md produced"));
  }

  const specResult = mapAttributesToSpecs(Array.isArray(draft?.attributes) ? draft.attributes : []);
  issues.push(...specResult.issues);

  const optionResult = mapVariantsToOptions(
    Array.isArray(draft?.variants) ? draft.variants : [],
    optionTypes,
  );
  issues.push(...optionResult.issues);

  const mediaResult = mapImagesToMedia(
    draft?.images ?? { general: [], variantImages: {} },
    optionResult.options,
  );
  issues.push(...mediaResult.issues);

  const pricingResult = mapPricing(draft?.pricing);
  issues.push(...pricingResult.issues);

  const collectionResult = mapCollections(
    Array.isArray(draft?.suggestedCollections) ? draft.suggestedCollections : [],
  );
  issues.push(...collectionResult.issues);

  const provenanceResult = mapMigrationProvenance(draft?.sourceType, draft?.sourceNotes);
  issues.push(...provenanceResult.issues);

  const subcategory = typeof draft?.subcategory === "string" ? draft.subcategory.trim() : "";

  if (draft?.personalized === true && optionResult.options.length === 0) {
    issues.push(
      advisory(
        "personalized",
        "the draft records this piece as personalised but declares no option group, so the page offers nothing to personalise",
      ),
    );
  }

  for (const option of optionResult.options) {
    if (specResult.specs[option.name.toLowerCase()] !== undefined) {
      issues.push(
        advisory(
          "specs",
          `specs.${option.name.toLowerCase()} states one fixed value while "${option.name}" is also a choice the shopper makes. One of the two is wrong`,
        ),
      );
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const advisories = issues.filter((issue) => issue.severity === "advisory");
  if (errors.length > 0 || pricingResult.pricing === null || category === null) {
    return { product: null, errors, advisories };
  }

  const product: Product = {
    id,
    name,
    category,
    ...(subcategory.length > 0 ? { subcategory } : {}),
    status: "draft",
    ...(collectionResult.collections.length > 0
      ? { collections: collectionResult.collections }
      : {}),
    pricing: pricingResult.pricing,
    media: mediaResult.media,
    ...(optionResult.options.length > 0 ? { options: optionResult.options } : {}),
    specs: specResult.specs,
    description,
    seo: content.seo,
    stock: { inStock: inStock ?? true },
    flags: flags ?? { featured: false, isNew: true },
    ...(provenanceResult.migrationProvenance === null
      ? {}
      : { migrationProvenance: provenanceResult.migrationProvenance }),
  };

  return { product, errors, advisories };
}

export interface PendingKeywordCheck {
  /** Against `data/keyword-map.json`, which indexes published products only. */
  published: KeywordCollisionReport;
  /**
   * Against the draft records sitting in `data/products.json`. The committed map excludes them
   * by design — a draft is not competing for a search result — but two drafts claiming one
   * keyword is a collision that only surfaces at publish, when it is expensive. This finds it
   * at the point the second keyword is chosen.
   */
  pendingDrafts: KeywordCollisionReport;
  blocked: boolean;
}

function buildDraftKeywordMap(catalogue: readonly Product[]): KeywordMap {
  const primary: Record<string, string[]> = {};
  const secondary: Record<string, string[]> = {};
  const drafts = catalogue.filter((product) => product.status === "draft");

  const add = (index: Record<string, string[]>, keyword: string, productId: string): void => {
    const canonical = canonicaliseKeyword(keyword);
    if (canonical.length === 0) return;
    const claimants = index[canonical] ?? [];
    if (!claimants.includes(productId)) claimants.push(productId);
    index[canonical] = claimants;
  };

  for (const product of drafts) {
    add(primary, product.seo.primaryKeyword, product.id);
    for (const keyword of product.seo.secondaryKeywords) add(secondary, keyword, product.id);
  }

  return {
    generatedBy: "lib/draft-a-to-product.ts",
    source: "data/products.json (draft records only)",
    productCount: drafts.length,
    primary,
    secondary,
  };
}

/**
 * The keyword gate the orchestration skill runs before it writes anything: the candidate
 * primary keyword against the published map and against every unpublished record. Either one
 * finding a hard collision blocks.
 */
export function checkCandidatePrimaryKeyword(
  candidate: string,
  committedMap: KeywordMap,
  catalogue: readonly Product[],
  productId?: string,
): PendingKeywordCheck {
  const options = { ignoreProductId: productId };
  const published = checkPrimaryKeywordCollision(candidate, committedMap, options);
  const pendingDrafts = checkPrimaryKeywordCollision(
    candidate,
    buildDraftKeywordMap(catalogue),
    options,
  );

  return {
    published,
    pendingDrafts,
    blocked: published.blocked || pendingDrafts.blocked,
  };
}
