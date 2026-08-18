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
 * Every collection in the second tier — the two hand-tagged ones plus the three derived
 * from data the product record already carries. This is what the `?collection=` param
 * accepts and what the nav and the shop facet render.
 */
export type CollectionFilterSlug =
  | CollectionSlug
  | "best-sellers"
  | "new-arrivals"
  | "under-999";

/**
 * How a collection decides its membership. `tag` reads `product.collections`; the other
 * three read fields that already exist, so no product data is duplicated to support them.
 * `price-band` names a band in `PRICE_BANDS`, so the collection and the price facet can
 * never disagree about where the boundary sits.
 */
export type CollectionSource =
  | { kind: "tag" }
  | { kind: "featured-flag" }
  | { kind: "new-flag" }
  | { kind: "price-band"; band: "under-999" };

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
  {
    slug: "under-999",
    label: "Under ₹999",
    source: { kind: "price-band", band: "under-999" },
  },
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

export interface Review {
  name: string;
  rating: number;
  text: string;
}

export interface ProductDetails {
  material: string;
  /** Absent on the owner's own products, whose measured weights have not been supplied. */
  weight?: string;
  closure?: string;
  type?: string;
  stone?: string;
  size?: string;
}

/**
 * A choice the buyer makes without changing the price — an engraved letter, a shape, a
 * plating colour. Carried as catalogue data only; nothing reads it into a cart line yet.
 * See ADR-016 and ADR-019.
 */
export interface ProductOption {
  name: string;
  values: string[];
}

/**
 * One chosen value per option group — `{ Letter: "A" }`. Part of a cart line's identity, and
 * of nothing else: no amount, no stock check and no image ever reads it. See ADR-019.
 */
export type SelectedOptions = Record<string, string>;

/**
 * The projection of a product the browser is allowed to hold. It carries what a cart line
 * has to render and price and nothing else — no description, details, or reviews — so the
 * client cart can prune stale ids and read a trusted price without the full catalogue
 * crossing the server boundary. See ADR-010.
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
   * without the full catalogue. Absent on the ninety-six products sold in one configuration.
   */
  options?: ProductOption[];
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  /** The amount actually charged. The only field a server-side total may read. */
  price: number;
  /** Display-only compare-at price. Never used in any amount calculation. */
  mrp: number;
  images: string[];
  shortDescription: string;
  details: ProductDetails;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  featured: boolean;
  isNew: boolean;
  inStock: boolean;
  /** Absent or empty means the product is sold in exactly one configuration. */
  options?: ProductOption[];
  /**
   * The hand-tagged collections this product belongs to. Absent or empty is normal — a
   * product needs no tag to appear in the derived collections. See ADR-020.
   */
  collections?: CollectionSlug[];
}
