export type Category =
  | "necklaces"
  | "earrings"
  | "rings"
  | "bracelets"
  | "bangles"
  | "pendants"
  | "anklets"
  | "nose-pins"
  | "watches"
  | "hair-accessories";

export interface CategoryOption {
  slug: Category;
  label: string;
}

/**
 * The first tier of the catalogue: every product sits in exactly one of these. Nath and
 * other nose ornaments are filed under `nose-pins` rather than earning a category of their
 * own. See [ADR-020](/docs/decisions/ADR-020-two-tier-catalogue-ia.md).
 */
export const CATEGORIES: readonly CategoryOption[] = [
  { slug: "necklaces", label: "Necklaces" },
  { slug: "earrings", label: "Earrings" },
  { slug: "rings", label: "Rings" },
  { slug: "bracelets", label: "Bracelets" },
  { slug: "bangles", label: "Bangles" },
  { slug: "pendants", label: "Pendants" },
  { slug: "anklets", label: "Anklets" },
  { slug: "nose-pins", label: "Nose Pins" },
  { slug: "watches", label: "Watches" },
  { slug: "hair-accessories", label: "Hair Accessories" },
] as const;

export const CATEGORY_SLUGS: readonly Category[] = CATEGORIES.map(
  (category) => category.slug,
);

export function getCategoryLabel(slug: Category): string {
  const match = CATEGORIES.find((category) => category.slug === slug);
  return match ? match.label : slug;
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((category) => category.slug === value);
}

/**
 * A collection a product opts into by hand, by carrying the slug in `collections`. Kept
 * deliberately small: a tag earns its place only when nothing already in the record can
 * derive it.
 */
export type CollectionSlug = "gifting" | "anti-tarnish";

/**
 * Every collection in the second tier — the two hand-tagged ones plus the two derived from
 * data the product record already carries. This is what the `?collection=` param accepts
 * and what the nav and the shop facet render. A price band is not a collection: it is the
 * Price facet's job, and listing it in both places put the same checkbox on screen twice.
 * See [ADR-024](/docs/decisions/ADR-024-funnel-ui-polish.md).
 */
export type CollectionFilterSlug = CollectionSlug | "best-sellers" | "new-arrivals";

/**
 * How a collection decides its membership. `tag` reads `product.collections`; the other two
 * read fields that already exist, so no product data is duplicated to support them.
 */
export type CollectionSource =
  | { kind: "tag" }
  | { kind: "featured-flag" }
  | { kind: "new-flag" };

export interface CollectionOption {
  slug: CollectionFilterSlug;
  label: string;
  source: CollectionSource;
}

export const COLLECTIONS: readonly CollectionOption[] = [
  { slug: "gifting", label: "Gifting", source: { kind: "tag" } },
  { slug: "anti-tarnish", label: "Anti-Tarnish", source: { kind: "tag" } },
  { slug: "best-sellers", label: "Best Sellers", source: { kind: "featured-flag" } },
  { slug: "new-arrivals", label: "New Arrivals", source: { kind: "new-flag" } },
] as const;

export const COLLECTION_SLUGS: readonly CollectionFilterSlug[] = COLLECTIONS.map(
  (collection) => collection.slug,
);

/** The subset a product may carry in `collections` — everything else is derived. */
export const COLLECTION_TAGS: readonly CollectionSlug[] = COLLECTIONS.filter(
  (collection): collection is CollectionOption & { slug: CollectionSlug } =>
    collection.source.kind === "tag",
).map((collection) => collection.slug);

export function getCollection(slug: CollectionFilterSlug): CollectionOption {
  const match = COLLECTIONS.find((collection) => collection.slug === slug);
  if (match === undefined) throw new Error(`Unknown collection: ${slug}`);
  return match;
}

export function getCollectionLabel(slug: CollectionFilterSlug): string {
  const match = COLLECTIONS.find((collection) => collection.slug === slug);
  return match ? match.label : slug;
}

export function isCollectionFilterSlug(value: string): value is CollectionFilterSlug {
  return COLLECTIONS.some((collection) => collection.slug === value);
}

export function isCollectionTag(value: string): value is CollectionSlug {
  return COLLECTION_TAGS.some((slug) => slug === value);
}

/**
 * Which control a choice is made with. It is catalogue data rather than a guess made from
 * the number of values, because two groups of the same size are not the same kind of
 * question: four locket shapes are a set to compare, four ribbon colours are a set to look
 * at. See [ADR-027](/docs/decisions/ADR-027-product-schema-migration.md).
 */
export type ProductOptionType = "dropdown" | "swatch" | "pills" | "chips";

export const PRODUCT_OPTION_TYPES: readonly ProductOptionType[] = [
  "dropdown",
  "swatch",
  "pills",
  "chips",
] as const;

export function isProductOptionType(value: string): value is ProductOptionType {
  return PRODUCT_OPTION_TYPES.some((type) => type === value);
}

/**
 * A choice the buyer makes without changing the price — an engraved letter, a shape, a
 * plating colour. `default` is the value a shopper who never opens the control is recorded
 * as having chosen, so it is written down rather than inferred from the order of `values`.
 * See ADR-016, ADR-019 and ADR-027.
 */
export interface ProductOption {
  name: string;
  type: ProductOptionType;
  values: string[];
  default: string;
}

/**
 * One chosen value per option group — `{ Letter: "A" }`. Part of a cart line's identity and
 * of which photograph is shown, and of nothing else: no amount and no stock check ever reads
 * it. See ADR-019 and ADR-027.
 */
export type SelectedOptions = Record<string, string>;

/** The amount charged and the compare-at price beside it, kept apart from each other. */
export interface ProductPricing {
  /** The amount actually charged. The only field a server-side total may read. */
  price: number;
  /** Display-only compare-at price. Never used in any amount calculation. */
  mrp: number;
  /**
   * What the piece costs the shop, in whole rupees. Margin data: server-only and
   * admin-only, never narrowed into a `CatalogueEntry` and never rendered to a shopper.
   * Held to the same seal as `mrp` — it is absent from the pricing catalogue rather than
   * merely unread by it. See [ADR-011](/docs/decisions/ADR-011-checkout-address-step.md)
   * and [ADR-040](/docs/decisions/ADR-040-postgres-for-orders.md).
   */
  cost: number;
}

/**
 * A photograph keyed to one option value, under `"OptionName:value"` — `"Colour:Golden"`.
 * Absent for every product photographed in a single configuration.
 */
export type VariantImages = Record<string, string>;

export interface ProductMedia {
  /** `images[0]` is the product's own photograph and is what every listing renders. */
  images: string[];
  variantImages?: VariantImages;
}

/**
 * Open-ended on purpose: a watch has a strap and a locket has a closure, and a fixed list of
 * six keys turned every spec a product did not have into an absence to encode. Keys are the
 * spec name in lower case; `ProductDetailsList` supplies the display label. See ADR-027.
 */
export type ProductSpecs = Record<string, string>;

/**
 * The search and social metadata a product page publishes, written per product by the
 * `morchadi-product-meta` skill rather than derived from the description at render time. A
 * meta description and an opening paragraph do different jobs, and clipping the second into
 * the first produced a sentence that read as prose cut off mid-thought. See
 * [ADR-036](/docs/decisions/ADR-036-product-seo-metadata-pass.md).
 *
 * Every field is verified against a measured character count by
 * `scripts/validate-products.mjs`, so a rewrite that pushes a title past what a search result
 * renders fails the gate rather than shipping truncated.
 */
export interface ProductSeo {
  /** Internal targeting only. Never emitted as a `<meta name="keywords">` tag. */
  primaryKeyword: string;
  /** Internal targeting only, same as `primaryKeyword`. */
  secondaryKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  /** The alternative text for `media.images[0]`, which is also every listing's photograph. */
  imageAlt: string;
  /**
   * One alt per image in `media.images` beyond the first, in the same order. Absent on a
   * product photographed once, which is all but one of them.
   */
  additionalImageAlts?: string[];
  ogTitle: string;
  ogDescription: string;
  /** The share card's image. The product's own photograph rather than the brand card. */
  ogImage: string;
}

export interface ProductStock {
  inStock: boolean;
}

export interface ProductFlags {
  featured: boolean;
  isNew: boolean;
}

/**
 * The projection of a product the browser is allowed to hold. It carries what a cart line
 * has to render and price and nothing else — no description and no specs — so the
 * client cart can prune stale ids and read a trusted price without the full catalogue
 * crossing the server boundary. See ADR-010.
 *
 * It stays flat where `Product` is grouped: this is a wire shape read by cart arithmetic,
 * and every field on it is one the cart genuinely needs.
 */
export interface CatalogueEntry {
  id: string;
  name: string;
  /** The amount actually charged. The only field a cart total may read. */
  price: number;
  /** Display-only compare-at price. Never used in any amount calculation. */
  mrp: number;
  image: string | null;
  inStock: boolean;
  /**
   * Carried so the client cart can re-validate a persisted selection and fill in defaults
   * without the full catalogue. Absent on products sold in one configuration.
   */
  options?: ProductOption[];
  /**
   * Carried so a cart line can show the photograph of the variant it records. Display only:
   * no amount reads it. Absent on products photographed in one configuration.
   */
  variantImages?: VariantImages;
}

/**
 * The catalogue record, grouped by what each field is *for* — money, media, specification,
 * availability, merchandising — rather than kept as one flat list of keys. There is no
 * reception group: this store has collected no reviews and no ratings, and the record holds
 * nothing it cannot substantiate. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 *
 * The grouping is what lets `pricing` be the single named place an amount lives, and lets
 * `specs` and `media` grow without the record's top level growing with them. See
 * [ADR-027](/docs/decisions/ADR-027-product-schema-migration.md).
 */
export interface Product {
  id: string;
  name: string;
  category: Category;
  /**
   * The hand-tagged collections this product belongs to. Absent or empty is normal — a
   * product needs no tag to appear in the derived collections. See ADR-020.
   */
  collections?: CollectionSlug[];
  pricing: ProductPricing;
  media: ProductMedia;
  /** Absent or empty means the product is sold in exactly one configuration. */
  options?: ProductOption[];
  specs: ProductSpecs;
  description: string;
  seo: ProductSeo;
  stock: ProductStock;
  flags: ProductFlags;
}
