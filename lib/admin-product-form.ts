import type { ProductEdit } from "@/types/admin-product";
import type {
  Category,
  Product,
  ProductOptionType,
  ProductSpecs,
  ProductStatus,
  VariantImages,
} from "@/types/product";

/**
 * The product edit form's state, and the two functions that turn a record into it and back.
 *
 * They live here rather than in the component for the reason CLAUDE.md gives — components stay
 * presentational and logic lives in `/lib` — and because the round trip is the part worth testing
 * on its own. A form that silently dropped a spec key or reordered an option's values would be a
 * data bug wearing a UI, and the test that catches it should not have to render anything.
 *
 * Not `server-only`: `AdminProductForm` is a `"use client"` component and imports both of these.
 *
 * **Every field is held as the string the input actually carries**, including the amounts. A form
 * that coerced `"210.5"` to `210` on the way in would silently change what the operator typed and
 * then save it; carrying the text through to the server means the catalogue's real rule —
 * `pricing.price must be a positive whole number of rupees` — is what rejects it, in the words the
 * build would use. See [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */

export interface ProductSpecDraft {
  key: string;
  value: string;
}

export interface ProductOptionDraft {
  name: string;
  type: ProductOptionType;
  /** One value per line. Newline-separated rather than comma-separated so a value may contain a comma. */
  values: string;
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
  inStock: boolean;
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
    inStock: product.stock.inStock,
    options: (product.options ?? []).map((option) => ({
      name: option.name,
      type: option.type,
      values: toLineList(option.values),
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
    flags: { featured: draft.featured, isNew: draft.isNew },
    stock: { inStock: draft.inStock },
    options: draft.options
      .filter((option) => option.name.trim() !== "")
      .map((option) => ({
        name: option.name.trim(),
        type: option.type,
        values: fromLineList(option.values),
        default: option.default.trim(),
      })),
    variantImages: toVariantImages(draft.variantImages),
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

    return fromLineList(option.values).map((value) => {
      const key = `${name}:${value}`;
      return { key, image: stored.get(key) ?? "" };
    });
  });
}
