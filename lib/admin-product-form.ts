import { buildGalleryImages, parseVariantImageKey } from "@/lib/variant-images";
import type { ProductEdit } from "@/types/admin-product";
import type {
  Category,
  Product,
  ProductBadge,
  ProductOptionType,
  ProductSpecs,
  ProductStatus,
  VariantImages,
} from "@/types/product";

/**
 * The product edit form's state, and the functions that turn a record into it and back.
 *
 * They live here rather than in the component for the reason CLAUDE.md gives — components stay
 * presentational and logic lives in `/lib` — and because the round trip is the part worth testing
 * on its own. A form that silently dropped a spec key or reordered an option's values would be a
 * data bug wearing a UI, and the test that catches it should not have to render anything.
 *
 * Not `server-only`: `AdminProductForm` is a `"use client"` component and imports these.
 *
 * **Every field is held as the string the input actually carries**, including the amounts. A form
 * that coerced `"210.5"` to `210` on the way in would silently change what the operator typed and
 * then save it; carrying the text through to the server means the catalogue's real rule —
 * `pricing.price must be a positive whole number of rupees` — is what rejects it, in the words the
 * build would use. See [ADR-064](/docs/decisions/ADR-064-admin-product-management.md) and
 * [ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md).
 */

export interface ProductSpecDraft {
  key: string;
  value: string;
}

export interface ProductOptionDraft {
  name: string;
  type: ProductOptionType;
  /**
   * One entry per value the buyer may choose, held as a list rather than as newline-separated
   * text. The list is what the variant-photograph picker keys off, and a textarea's stray blank
   * line or trailing space is indistinguishable from a value until it has already created a row
   * nothing can be paired with. See ADR-065.
   */
  values: string[];
  default: string;
}

export interface VariantImageDraft {
  /** `"OptionName:value"`, the key `media.variantImages` is stored under. */
  key: string;
  image: string;
}

export interface ProductDraft {
  name: string;
  category: Category;
  subcategory: string;
  description: string;
  status: ProductStatus;
  featured: boolean;
  isNew: boolean;
  /** `null` is "no badge chosen", which is a value the operator picks rather than a blank. */
  badge: ProductBadge | null;
  inStock: boolean;
  /**
   * Held as the string the input carries, like the amounts and for the same reason: `"7.5"`
   * must reach `stock.quantity must be a whole number of pieces` rather than be rounded here
   * into a count nobody typed. See ADR-067.
   */
  quantity: string;
  options: ProductOptionDraft[];
  variantImages: VariantImageDraft[];
  price: string;
  mrp: string;
  cost: string;
  minPrepaidAmount: string;
  specs: ProductSpecDraft[];
  primaryKeyword: string;
  /** One keyword per line. */
  secondaryKeywords: string;
  metaTitle: string;
  metaDescription: string;
  imageAlt: string;
  /** One alt per image beyond the first, in `media.images` order. */
  additionalImageAlts: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

export function toLineList(values: readonly string[]): string {
  return values.join("\n");
}

export function fromLineList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** The values an option actually offers: trimmed, with the unfilled rows left out. */
export function filledOptionValues(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

/**
 * The amount as the catalogue stores it, or `NaN` for anything that is not a number.
 *
 * `NaN` is deliberate and it survives on purpose: `JSON.stringify` turns it into `null`, which the
 * catalogue's own rule rejects with "must be a positive whole number of rupees". Coercing a blank
 * field to `0` here would instead save a zero-rupee price on some other rule's watch.
 */
export function toAmount(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

export function toAmountField(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

export function toProductDraft(product: Product): ProductDraft {
  const additionalImageCount = Math.max(0, product.media.images.length - 1);
  const storedAlts = product.seo.additionalImageAlts ?? [];

  return {
    name: product.name,
    category: product.category,
    subcategory: product.subcategory ?? "",
    description: product.description,
    status: product.status,
    featured: product.flags.featured,
    isNew: product.flags.isNew,
    badge: product.flags.badge,
    inStock: product.stock.inStock,
    quantity: toAmountField(product.stock.quantity),
    options: (product.options ?? []).map((option) => ({
      name: option.name,
      type: option.type,
      values: [...option.values],
      default: option.default,
    })),
    variantImages: Object.entries(product.media.variantImages ?? {}).map(([key, image]) => ({
      key,
      image,
    })),
    price: toAmountField(product.pricing.price),
    mrp: toAmountField(product.pricing.mrp),
    cost: toAmountField(product.pricing.cost),
    minPrepaidAmount: toAmountField(product.pricing.minPrepaidAmount),
    specs: Object.entries(product.specs).map(([key, value]) => ({ key, value })),
    primaryKeyword: product.seo.primaryKeyword,
    secondaryKeywords: toLineList(product.seo.secondaryKeywords),
    metaTitle: product.seo.metaTitle,
    metaDescription: product.seo.metaDescription,
    imageAlt: product.seo.imageAlt,
    additionalImageAlts: Array.from(
      { length: additionalImageCount },
      (_unused, index) => storedAlts[index] ?? "",
    ),
    ogTitle: product.seo.ogTitle,
    ogDescription: product.seo.ogDescription,
    ogImage: product.seo.ogImage,
  };
}

/**
 * A spec block from the form's rows, dropping any row whose key is blank.
 *
 * A blank row is how the form offers "add a spec", so it is a row that has not been filled in
 * rather than a spec named "". Dropping it here means an operator can leave one lying around
 * without it becoming a validation failure they did not cause.
 */
function toSpecs(rows: readonly ProductSpecDraft[]): ProductSpecs {
  const specs: ProductSpecs = {};

  for (const row of rows) {
    const key = row.key.trim();
    if (key === "") continue;
    specs[key] = row.value.trim();
  }

  return specs;
}

/**
 * The variant image map, dropping rows with no path.
 *
 * The form lists a row for every option value a product offers, whether or not it has its own
 * photograph, so most rows are legitimately empty — a product photographed once has an image for
 * no variant at all. Only the filled ones become entries.
 *
 * It is given `variantImageRowsFor(draft)` rather than `draft.variantImages`, and the difference
 * is a bug the structured value editor made easy to reach: deleting an option value used to leave
 * its photograph in the draft, and the save sent a mapping for a value the record no longer
 * offered. Deriving the map from the options at save time makes "every key names a value this
 * product has" true rather than intended. Every record in the catalogue already satisfies it, so
 * nothing existing changes shape. See ADR-065.
 */
function toVariantImages(rows: readonly VariantImageDraft[]): VariantImages {
  const variantImages: VariantImages = {};

  for (const row of rows) {
    const image = row.image.trim();
    if (image === "" || row.key.trim() === "") continue;
    variantImages[row.key] = image;
  }

  return variantImages;
}

export function toProductEdit(draft: ProductDraft): ProductEdit {
  const additionalImageAlts = draft.additionalImageAlts.map((alt) => alt.trim());

  return {
    name: draft.name.trim(),
    category: draft.category,
    subcategory: draft.subcategory.trim() === "" ? null : draft.subcategory.trim(),
    description: draft.description,
    status: draft.status,
    flags: { featured: draft.featured, isNew: draft.isNew, badge: draft.badge },
    stock: { inStock: draft.inStock, quantity: toAmount(draft.quantity) },
    options: draft.options
      .filter((option) => option.name.trim() !== "")
      .map((option) => ({
        name: option.name.trim(),
        type: option.type,
        values: filledOptionValues(option.values),
        default: option.default.trim(),
      })),
    variantImages: toVariantImages(variantImageRowsFor(draft)),
    pricing: {
      price: toAmount(draft.price),
      mrp: toAmount(draft.mrp),
      cost: toAmount(draft.cost),
      minPrepaidAmount: toAmount(draft.minPrepaidAmount),
    },
    specs: toSpecs(draft.specs),
    seo: {
      primaryKeyword: draft.primaryKeyword.trim(),
      secondaryKeywords: fromLineList(draft.secondaryKeywords),
      metaTitle: draft.metaTitle.trim(),
      metaDescription: draft.metaDescription.trim(),
      imageAlt: draft.imageAlt.trim(),
      ...(additionalImageAlts.length === 0 ? {} : { additionalImageAlts }),
      ogTitle: draft.ogTitle.trim(),
      ogDescription: draft.ogDescription.trim(),
      ogImage: draft.ogImage.trim(),
    },
  };
}

/**
 * The variant-image rows a product's current options imply — one per option value, carrying the
 * path already stored for it if there is one.
 *
 * Recomputed from the *draft's* options rather than from the saved record, so renaming an option
 * or adding a value updates the list of photographs it can be given without a save in between.
 * A key that no longer matches any option value is dropped, which is what stops an edit to an
 * option from leaving behind a variant image the validator would then reject.
 */
export function variantImageRowsFor(draft: ProductDraft): VariantImageDraft[] {
  const stored = new Map(draft.variantImages.map((row) => [row.key, row.image]));

  return draft.options.flatMap((option) => {
    const name = option.name.trim();
    if (name === "") return [];

    return filledOptionValues(option.values).map((value) => {
      const key = `${name}:${value}`;
      return { key, image: stored.get(key) ?? "" };
    });
  });
}

/**
 * The rows with one value's photograph changed, computed from the rows the draft's options
 * currently imply rather than from whatever the draft happens to be carrying.
 *
 * Written as a function over `variantImageRowsFor` so the picker cannot resurrect a mapping whose
 * option value has since been deleted: the set of keys that survives a click is exactly the set
 * the options describe. An empty `image` clears the pairing, which is how "use the default
 * photograph" is expressed — there is no separate deletion path to keep in step.
 */
export function assignVariantImage(
  draft: ProductDraft,
  key: string,
  image: string,
): VariantImageDraft[] {
  return variantImageRowsFor(draft).map((row) =>
    row.key === key ? { key: row.key, image } : row,
  );
}

/** One photograph an operator may pair with an option value, and what to call it on screen. */
export interface PhotographChoice {
  src: string;
  label: string;
}

/**
 * Every photograph this product already has, as pickable choices.
 *
 * **Not `media.images` alone**, and that is the finding this picker was designed around: in this
 * catalogue no variant photograph is listed in `media.images` — all seven existing mappings point
 * at files beside them. A picker offering only `media.images` could not represent a single
 * mapping the catalogue actually holds, and would show every one of them as unassigned, which the
 * first save would then make true.
 *
 * So the choices are `buildGalleryImages`'s set — the product's own photographs first, then each
 * already-mapped variant photograph the list does not already contain — which is the same list
 * the storefront gallery builds from the same record ([ADR-050](/docs/decisions/ADR-050-unified-gallery-strip.md)).
 * Nothing here uploads, adds or removes a file; it names the ones the record already knows about.
 */
export function photographChoicesFor(product: Product): PhotographChoice[] {
  return buildGalleryImages(product.media.images, product.media.variantImages).map(
    (entry, index) => ({
      src: entry.src,
      label: labelForPhotograph(entry.variant, index, product.media.images.length),
    }),
  );
}

function labelForPhotograph(
  variant: ReturnType<typeof parseVariantImageKey>,
  index: number,
  ownImageCount: number,
): string {
  if (index < ownImageCount) return index === 0 ? "Primary" : `View ${index + 1}`;
  if (variant === null) return `Photograph ${index + 1}`;
  return `${variant.optionName}: ${variant.value}`;
}

export const PRODUCT_FORM_TABS = ["basic", "variants", "pricing"] as const;

export type ProductFormTab = (typeof PRODUCT_FORM_TABS)[number];

export const PRODUCT_FORM_TAB_LABELS: Record<ProductFormTab, string> = {
  basic: "Basic details",
  variants: "Variants & media",
  pricing: "Pricing & SEO",
};

/**
 * Which tab a refused rule belongs to, matched on the field name the catalogue's own message
 * opens with — `P001: pricing.price must be a positive whole number of rupees`.
 *
 * The point is not decoration. A save is one request across three tabs, so a rejection can name a
 * field that is not on screen, and before this the operator was told what was wrong and left to
 * find it. Unmatched prefixes fall to Basic details rather than to nothing, because a failure with
 * no tab marked is the state this function exists to remove.
 */
export function tabForProductFailure(failure: string): ProductFormTab {
  const field = failure.slice(failure.indexOf(":") + 1).trim();

  if (/^(pricing|specs|seo)\b/.test(field)) return "pricing";
  if (/^(options|media)\b/.test(field)) return "variants";
  return "basic";
}

export function tabsWithProductFailures(failures: readonly string[]): ProductFormTab[] {
  const marked = new Set(failures.map(tabForProductFailure));
  return PRODUCT_FORM_TABS.filter((tab) => marked.has(tab));
}

/**
 * The draft reduced to the bytes a save would send. Two drafts comparing equal here would produce
 * the same request, which is exactly the question "is there anything unsaved" is asking — a
 * trailing space typed into a field that gets trimmed is not an unsaved change.
 */
export function serialiseDraftForComparison(draft: ProductDraft): string {
  return JSON.stringify(toProductEdit(draft));
}
