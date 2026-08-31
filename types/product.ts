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
  | "hair-accessories"
  | "gift-hampers";

/**
 * Whether shoppers can see a category yet. `surfaced` is in the nav, the home grid, the shop
 * facets and the sitemap; `pending` is a valid value a product record may carry and appears on
 * none of those surfaces. See [ADR-055](/docs/decisions/ADR-055-category-vocabulary-and-surfacing.md).
 */
export type CategoryStatus = "surfaced" | "pending";

export interface CategoryOption {
  slug: Category;
  label: string;
  status: CategoryStatus;
}

/**
 * The first tier of the catalogue: every product sits in exactly one of these. Nath and
 * other nose ornaments are filed under `nose-pins` rather than earning a category of their
 * own. See [ADR-020](/docs/decisions/ADR-020-two-tier-catalogue-ia.md).
 *
 * This is the **vocabulary** — every slug a product record is allowed to carry. It is not the
 * list a shopper browses; that is `SURFACED_CATEGORIES` below, and the two differ whenever a
 * category has been agreed before its products exist.
 */
export const CATEGORIES: readonly CategoryOption[] = [
  { slug: "necklaces", label: "Necklaces", status: "surfaced" },
  { slug: "earrings", label: "Earrings", status: "surfaced" },
  { slug: "rings", label: "Rings", status: "surfaced" },
  { slug: "bracelets", label: "Bracelets", status: "surfaced" },
  { slug: "bangles", label: "Bangles", status: "surfaced" },
  { slug: "pendants", label: "Pendants", status: "surfaced" },
  { slug: "anklets", label: "Anklets", status: "surfaced" },
  { slug: "nose-pins", label: "Nose Pins", status: "surfaced" },
  { slug: "watches", label: "Watches", status: "surfaced" },
  { slug: "hair-accessories", label: "Hair Accessories", status: "surfaced" },
  { slug: "gift-hampers", label: "Gift Hampers", status: "surfaced" },
] as const;

export const CATEGORY_SLUGS: readonly Category[] = CATEGORIES.map(
  (category) => category.slug,
);

/**
 * The categories a shopper can actually reach. Every storefront surface that lists categories
 * reads this rather than `CATEGORIES`, so a category can be agreed, typed and validated long
 * before it has a single product to show — and an empty listing, an empty sitemap URL and an
 * empty nav entry never ship.
 *
 * A static filter rather than a count over the catalogue, for the same reason
 * [ADR-010](/docs/decisions/ADR-010-cart-architecture.md) gave: the nav, the mobile drawer and
 * the shop filter panel are Client Components, and deriving this from `data/products.json`
 * would put the whole catalogue in the browser bundle to answer a question with eleven possible
 * answers. `scripts/validate-products.mjs` is what keeps the flag honest in both directions.
 */
/**
 * The surfacing rule as a function of the `status` field alone, so it can be applied to a list
 * other than `CATEGORIES` — which is what lets a test flip a category's status and check the
 * result, rather than checking the one category that happens to be pending today.
 * `scripts/validate-products.mjs` keeps its own copy of this list and derives its browsable
 * subset the same way; `lib/category-vocabulary.test.ts` holds the two together.
 */
export function selectSurfacedCategories(
  categories: readonly CategoryOption[],
): CategoryOption[] {
  return categories.filter((category) => category.status === "surfaced");
}

export const SURFACED_CATEGORIES: readonly CategoryOption[] =
  selectSurfacedCategories(CATEGORIES);

export const SURFACED_CATEGORY_SLUGS: readonly Category[] =
  SURFACED_CATEGORIES.map((category) => category.slug);

/**
 * How many category tiles the home page shows. Ten rather than eleven because the grid is five
 * abreast from `lg` and two abreast on a phone: eleven tiles is two full rows plus one orphan
 * at both widths, and the orphan reads as a tile that failed to load rather than as the last
 * category.
 */
export const HOME_CATEGORY_LIMIT = 10;

/**
 * The categories the home page's tile grid leaves out.
 *
 * `gift-hampers` is browsable, in the nav, in the shop facets and in the sitemap — it is
 * `surfaced` and this does not change that. What it is not is a *category* in the sense the
 * other ten are: the rest name a thing you wear, and a hamper is a way of buying several of
 * them. Putting it in the same grid asks the shopper to choose between "Rings" and "how it is
 * packaged", which is not one question.
 *
 * A list rather than a status on `CategoryOption`, because this is a decision about one
 * page's grid and not a property of the category. `SURFACED_CATEGORIES` stays eleven and
 * every other surface still reads it. See
 * [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
export const HOME_HIDDEN_CATEGORIES: readonly Category[] = ["gift-hampers"];

/**
 * The tiles the home grid renders: the surfaced categories, minus the ones held back from it,
 * capped at `HOME_CATEGORY_LIMIT`.
 *
 * Takes the list rather than reading `SURFACED_CATEGORIES` for the reason
 * `selectSurfacedCategories` does — so the rule can be tested over categories that do not
 * exist, instead of only over the one that happens to be held back today.
 */
export function selectHomeCategories(
  categories: readonly CategoryOption[],
  limit: number = HOME_CATEGORY_LIMIT,
): CategoryOption[] {
  return categories
    .filter((category) => !HOME_HIDDEN_CATEGORIES.includes(category.slug))
    .slice(0, limit);
}

export const HOME_CATEGORIES: readonly CategoryOption[] =
  selectHomeCategories(SURFACED_CATEGORIES);

export function getCategoryLabel(slug: Category): string {
  const match = CATEGORIES.find((category) => category.slug === slug);
  return match ? match.label : slug;
}

/** Is this a slug a product record may carry? The vocabulary check. */
export function isCategory(value: string): value is Category {
  return CATEGORIES.some((category) => category.slug === value);
}

/**
 * Is this a slug a shopper may browse? Narrower than `isCategory`, and the one the `?category=`
 * param is parsed against — a hand-typed URL for a pending category falls back to the whole shop
 * rather than rendering an empty one.
 */
export function isSurfacedCategory(value: string): value is Category {
  return SURFACED_CATEGORIES.some((category) => category.slug === value);
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
 * Whether a product is published. `draft` is the catalogue's own unpublished state: the
 * record ships in `data/products.json` and is validated like any other, but no public surface
 * may render it, link to it, price it, or sell it. See
 * [ADR-052](/docs/decisions/ADR-052-product-status-field.md).
 */
export type ProductStatus = "draft" | "active";

export const PRODUCT_STATUSES: readonly ProductStatus[] = ["draft", "active"] as const;

export function isProductStatus(value: string): value is ProductStatus {
  return PRODUCT_STATUSES.some((status) => status === value);
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
  /**
   * The amount per unit that must be paid online, in whole rupees. `0` — which is every
   * product in the catalogue today — means the piece may be sold cash on delivery.
   *
   * Any value above `0` disables COD for the *whole order*, not merely for its own line: a
   * cart is offered COD only when every line reads `0`. The rule is deliberately strict
   * because the alternative is splitting one delivery into a prepaid part and a collected
   * part, which is a reconciliation problem rather than a checkout feature.
   *
   * It exists because Cashfree denied COD at the account level (ticket 8266236), leaving no
   * gateway-side pincode, RTO or order-value screening to lean on. This field is the shop's
   * own substitute: the owner marks the pieces whose value or fragility makes an
   * uncollected delivery too expensive to absorb, and accepts the risk on the rest. See
   * [ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md).
   *
   * `isCartCodEligible` in `lib/cod.ts` is the only place the cart-level rule is decided.
   */
  minPrepaidAmount: number;
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

/**
 * Where a migrated record came from, kept as one named group rather than four top-level
 * fields so that every surface which must exclude it excludes it by dropping one key. The
 * shop's own hand-written products carry no such block, and its absence is the normal case.
 *
 * It is **server-only catalogue data**, held to the same seal as `pricing.cost`: no
 * `CatalogueEntry`, no order catalogue and no rendered page reads it, so another shop's
 * identifiers never reach a browser. Its one job is to keep "which Odoo listing is P387?"
 * answerable from the repository after `content-pipeline/` is cleaned up. See
 * [ADR-056](/docs/decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md).
 */
export interface ProductMigrationProvenance {
  /** The source system's own id for the listing. The one field that is never null. */
  originalId: string;
  originalSku: string | null;
  originalUrl: string | null;
  /** The source system's category path, verbatim, before it was mapped to a `Category`. */
  originalCategories: string[];
}

/**
 * How many of a piece the owner has on the shelf. A real count rather than a bucket, because
 * the card says "Only 2 left" in the owner's own words and a bucket cannot fill in the number.
 *
 * It does not replace `inStock`. The two answer different questions — "is this piece being
 * sold at all" and "how many are on the shelf" — and the owner uses the first to withdraw a
 * piece that is still in a drawer. `isStockAvailable` in `lib/product-badge.ts` is the one
 * place they are combined, and every surface that asks whether a product can be bought asks
 * it rather than reading either field alone. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
export interface ProductStock {
  inStock: boolean;
  /** A non-negative whole count. `0` and `inStock: false` both mean sold out. */
  quantity: number;
}

/**
 * The merchandising badge the owner has chosen for a piece, or `null` for the pieces they
 * have not merchandised. It is a *request* for a badge rather than the badge itself:
 * `selectProductBadge` decides what actually renders, and availability outranks anything
 * chosen here.
 */
export type ProductBadge = "trending" | "bestseller" | "new";

export const PRODUCT_BADGES: readonly ProductBadge[] = [
  "trending",
  "bestseller",
  "new",
] as const;

export function isProductBadge(value: string): value is ProductBadge {
  return PRODUCT_BADGES.some((badge) => badge === value);
}

/**
 * `isNew` and `badge` are deliberately both here and they are not duplicates.
 *
 * `isNew` is a *membership* flag: it decides the home new-arrivals row, the `new-arrivals`
 * collection facet, and the catalogue floor that keeps that row full. 408 of the 449 records
 * carry it, which is why it can never be a badge on its own — a badge on nine cards in ten is
 * not a badge.
 *
 * `badge` is a *display* choice, one per product, and the only field that can ask for
 * "Trending" or "Best Seller". The one place they meet is the New case of the cascade, which
 * fires on either, so today's New badge renders exactly where it always did while the owner
 * gains somewhere to say something else. See ADR-067.
 */
export interface ProductFlags {
  featured: boolean;
  isNew: boolean;
  badge: ProductBadge | null;
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
  /**
   * Which shelf the piece sits on. Carried so the browser can answer "what else is like what
   * is already in this basket" without a second catalogue crossing the boundary — the cart and
   * the confirmation screen both read it through `selectCrossSellCategory` in
   * [`lib/cross-sell.ts`](/lib/cross-sell.ts). Display and merchandising only: no amount, no
   * eligibility rule and no total has ever read it.
   */
  category: Category;
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
 * The projection of a product a **card** is allowed to hold — the one shape that may be handed
 * to a client component and rendered there.
 *
 * `Product` is not that shape. It carries `pricing.cost`, which is margin data barred from
 * every browser-facing catalogue (see `getOrderCaptureCatalogue`), and `migrationProvenance`,
 * which names another shop's identifiers. Both would be serialised into the page the moment a
 * whole record crossed a `"use client"` boundary, so the cross-sell rails hand this across
 * instead and `lib/catalogue-client-boundary.test.ts` keeps it that way.
 *
 * A `Product` satisfies it structurally, which is what lets the shop listing, the home page and
 * the product page go on passing whole records to `ProductCard` unchanged — those render on the
 * server, where the extra fields never leave.
 */
export interface ProductCardView {
  id: string;
  name: string;
  category: Category;
  pricing: { price: number; mrp: number };
  media: ProductMedia;
  seo: { imageAlt: string };
  stock: ProductStock;
  flags: ProductFlags;
  options?: ProductOption[];
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
   * The source system's second tier, carried through as free text because this catalogue has
   * no subcategory vocabulary to validate it against. Nothing renders it and no facet reads
   * it: it is captured so that a subcategory decision taken later has the data it needs,
   * rather than being re-derived from 542 raw blocks. Absent on every hand-written product.
   *
   * Unlike `migrationProvenance` it is not sensitive, and it is deliberately *permitted* to
   * reach a client bundle should a surface ever need it. That it does not reach one today is
   * a consequence of `toCatalogueEntry`'s whitelist and not of any rule about this field.
   */
  subcategory?: string;
  /**
   * Whether the record is published. Written on every product rather than left optional, so
   * "no status" is a validation failure rather than a silent guess. The one place that guess
   * is still made is `lib/products.ts`, which reads a record without the field as `active`
   * for backward compatibility — nothing but an explicit `draft` withholds a product. See
   * [ADR-052](/docs/decisions/ADR-052-product-status-field.md).
   */
  status: ProductStatus;
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
  /** Present only on a record that came from the Odoo migration. Never sent to a browser. */
  migrationProvenance?: ProductMigrationProvenance;
}
