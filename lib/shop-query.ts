import {
  SURFACED_CATEGORIES,
  COLLECTIONS,
  isSurfacedCategory,
  isCollectionFilterSlug,
  type Category,
  type CollectionFilterSlug,
} from "@/types/product";
import { formatRupees } from "@/lib/format";
import type { ProductBadgeKind } from "@/lib/product-badge";

export const SHOP_PATH = "/shop";
export const PER_PAGE = 12;

export type PriceBandSlug =
  | "under-99"
  | "under-299"
  | "under-499"
  | "under-999"
  | "above-999";

export interface PriceBand {
  slug: PriceBandSlug;
  label: string;
  min: number;
  /** `null` is unbounded above. Bounds are inclusive at both ends. */
  max: number | null;
}

/**
 * Four ceilings and one floor, nested rather than partitioned: "Under ₹299" contains
 * everything "Under ₹99" does. That is deliberate and it is why they are ticked rather than
 * chosen — a shopper looking for a gift under three hundred rupees wants one question
 * answered, not to work out which of four disjoint bands their budget straddles.
 *
 * Nesting is safe because selections inside a facet are OR-ed: ticking two ceilings is the
 * wider of the two, never an empty set. `above-999` starts at 1000 so the five bands cover
 * every rupee with no gap at exactly 999, which an exclusive reading of "Under ₹999" would
 * have left uncovered. The custom range beside them is a separate facet and is AND-ed.
 */
export const PRICE_BANDS: readonly PriceBand[] = [
  { slug: "under-99", label: "Under ₹99", min: 0, max: 99 },
  { slug: "under-299", label: "Under ₹299", min: 0, max: 299 },
  { slug: "under-499", label: "Under ₹499", min: 0, max: 499 },
  { slug: "under-999", label: "Under ₹999", min: 0, max: 999 },
  { slug: "above-999", label: "Above ₹999", min: 1000, max: null },
];

/**
 * A shopper's own bounds, either or both. It is a facet of its own rather than a sixth band
 * because it answers a different question: the bands are shortcuts to a price point, and this
 * is a range nobody anticipated. AND-ed with the bands, so a ticked band and a typed range
 * narrow each other rather than widening.
 */
export interface PriceRange {
  min: number | null;
  max: number | null;
}

export const EMPTY_PRICE_RANGE: PriceRange = { min: null, max: null };

export function hasPriceRange(range: PriceRange): boolean {
  return range.min !== null || range.max !== null;
}

export function isPriceInRange(price: number, range: PriceRange): boolean {
  if (range.min !== null && price < range.min) return false;
  return range.max === null || price <= range.max;
}

/** "₹200 – ₹500", "From ₹200", "Up to ₹500" — whichever bounds the shopper actually gave. */
export function formatPriceRange(range: PriceRange): string {
  if (range.min !== null && range.max !== null) {
    return `${formatRupees(range.min)} – ${formatRupees(range.max)}`;
  }
  if (range.min !== null) return `From ${formatRupees(range.min)}`;
  if (range.max !== null) return `Up to ${formatRupees(range.max)}`;
  return "";
}

/**
 * The status facet is the badge cascade turned into a filter, one option per badge a card can
 * render. It reads `selectProductBadge` rather than the fields behind it, so "Only a few left"
 * lists exactly the pieces whose cards say that and nothing else — a low-stock piece the owner
 * also marked Trending is under the badge it shows, because that is the one a shopper saw.
 * See [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
export type StatusSlug = ProductBadgeKind;

export interface StatusOption {
  slug: StatusSlug;
  label: string;
}

export const STATUS_FILTERS: readonly StatusOption[] = [
  { slug: "sold-out", label: "Sold Out" },
  { slug: "low-stock", label: "Only a few left" },
  { slug: "trending", label: "Trending" },
  { slug: "bestseller", label: "Best Seller" },
  { slug: "new", label: "New" },
];

export function isStatusSlug(value: string): value is StatusSlug {
  return STATUS_FILTERS.some((option) => option.slug === value);
}

export function getStatusLabel(slug: StatusSlug): string {
  const match = STATUS_FILTERS.find((option) => option.slug === slug);
  return match ? match.label : slug;
}

export type SortSlug = "name-asc" | "name-desc" | "price-asc" | "price-desc";

export interface SortOption {
  slug: SortSlug;
  label: string;
}

/**
 * Four orders, all of them properties the catalogue actually holds.
 *
 * No "Top rated": the catalogue carries no ratings — see
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md) — and a sort control is a claim
 * that the data behind it exists. "Newest first" is gone for a milder version of the same
 * reason: the catalogue has no timestamp, so it sorted on the `isNew` flag that 408 of the 449
 * records carry, which put nine products in ten in one undifferentiated block and called the
 * result recency. A shopper who wants the new arrivals has a collection facet that says so.
 * See [ADR-068](/docs/decisions/ADR-068-shop-sort-status-and-price-facets.md).
 */
export const SORT_OPTIONS: readonly SortOption[] = [
  { slug: "price-asc", label: "Price: Low to High" },
  { slug: "price-desc", label: "Price: High to Low" },
  { slug: "name-asc", label: "A to Z" },
  { slug: "name-desc", label: "Z to A" },
];

/**
 * A to Z. Alphabetical is the one default that says nothing about which pieces the shop wants
 * sold: a price-led default editorialises, and the flag-led one it replaces was not an order at
 * all. It is also stable under a catalogue edit, which is what a canonical URL needs.
 */
export const DEFAULT_SORT: SortSlug = "name-asc";

export function isPriceBandSlug(value: string): value is PriceBandSlug {
  return PRICE_BANDS.some((band) => band.slug === value);
}

export function isSortSlug(value: string): value is SortSlug {
  return SORT_OPTIONS.some((option) => option.slug === value);
}

export function getPriceBand(slug: PriceBandSlug): PriceBand {
  const match = PRICE_BANDS.find((band) => band.slug === slug);
  if (match === undefined) throw new Error(`Unknown price band: ${slug}`);
  return match;
}

export function getPriceBandLabel(slug: PriceBandSlug): string {
  return getPriceBand(slug).label;
}

export function isPriceInBand(price: number, band: PriceBand): boolean {
  if (price < band.min) return false;
  return band.max === null || price <= band.max;
}

export type RawSearchParam = string | string[] | undefined;

export interface ShopSearchParams {
  category?: RawSearchParam;
  collection?: RawSearchParam;
  status?: RawSearchParam;
  price?: RawSearchParam;
  min?: RawSearchParam;
  max?: RawSearchParam;
  sort?: RawSearchParam;
  page?: RawSearchParam;
}

export interface ShopQuery {
  categories: Category[];
  collections: CollectionFilterSlug[];
  statuses: StatusSlug[];
  priceBands: PriceBandSlug[];
  priceRange: PriceRange;
  sort: SortSlug;
  page: number;
}

const CATEGORY_ORDER = new Map(
  SURFACED_CATEGORIES.map((category, index) => [category.slug, index] as const),
);

const COLLECTION_ORDER = new Map(
  COLLECTIONS.map((collection, index) => [collection.slug, index] as const),
);

const PRICE_BAND_ORDER = new Map(
  PRICE_BANDS.map((band, index) => [band.slug, index] as const),
);

const STATUS_ORDER = new Map(
  STATUS_FILTERS.map((option, index) => [option.slug, index] as const),
);

/**
 * Accepts both repeated params (`?category=a&category=b`) and the comma-separated form
 * (`?category=a,b`), since the chrome mega-nav emits single values and the filter panel
 * emits lists. Case and surrounding whitespace are forgiving; unknown tokens are dropped
 * by the caller's type guard rather than raising.
 */
function toTokens(raw: RawSearchParam): string[] {
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => value.split(","))
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

function uniqueInOrder<T>(values: T[], rank: Map<T, number>): T[] {
  return Array.from(new Set(values)).sort(
    (left, right) => (rank.get(left) ?? 0) - (rank.get(right) ?? 0),
  );
}

/**
 * A bound the shopper typed, or `null` for anything that is not a whole number of rupees at
 * least zero. Silently dropping a bad bound rather than raising is the same forgiveness every
 * other param gets: a hand-edited `?min=abc` widens the results, it does not break the page.
 */
function parsePriceBoundToken(token: string | undefined): number | null {
  if (token === undefined) return null;
  const parsed = Number(token);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

/**
 * A range whose bounds have been read, with an inverted pair dropped entirely.
 *
 * `min=900&max=100` describes no price, and honouring it would render the empty state with two
 * chips that each look reasonable on their own. Dropping both says "that range matched
 * nothing" by not applying it, which is the reading a shopper who fat-fingered a field means.
 */
function parsePriceRange(params: ShopSearchParams): PriceRange {
  const min = parsePriceBoundToken(toTokens(params.min)[0]);
  const max = parsePriceBoundToken(toTokens(params.max)[0]);

  if (min !== null && max !== null && min > max) return EMPTY_PRICE_RANGE;
  return { min, max };
}

function parsePageToken(token: string | undefined): number {
  if (token === undefined) return 1;
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) return 1;
  const whole = Math.floor(parsed);
  return whole < 1 ? 1 : whole;
}

export function parseShopQuery(params: ShopSearchParams): ShopQuery {
  const categories = uniqueInOrder(
    toTokens(params.category).filter(isSurfacedCategory),
    CATEGORY_ORDER,
  );
  const collections = uniqueInOrder(
    toTokens(params.collection).filter(isCollectionFilterSlug),
    COLLECTION_ORDER,
  );
  const statuses = uniqueInOrder(
    toTokens(params.status).filter(isStatusSlug),
    STATUS_ORDER,
  );
  const priceBands = uniqueInOrder(
    toTokens(params.price).filter(isPriceBandSlug),
    PRICE_BAND_ORDER,
  );

  const sortToken = toTokens(params.sort)[0];
  const sort =
    sortToken !== undefined && isSortSlug(sortToken) ? sortToken : DEFAULT_SORT;

  return {
    categories,
    collections,
    statuses,
    priceBands,
    priceRange: parsePriceRange(params),
    sort,
    page: parsePageToken(toTokens(params.page)[0]),
  };
}

export function emptyShopQuery(): ShopQuery {
  return {
    categories: [],
    collections: [],
    statuses: [],
    priceBands: [],
    priceRange: EMPTY_PRICE_RANGE,
    sort: DEFAULT_SORT,
    page: 1,
  };
}

/**
 * Canonical: params always appear in the same order, defaults are omitted, and selections
 * are ordered by the constant tables rather than by click order — so the same filter state
 * always produces the same URL.
 */
export function buildShopHref(query: ShopQuery): string {
  const parts: string[] = [];

  if (query.categories.length > 0) {
    parts.push(`category=${query.categories.join(",")}`);
  }
  if (query.collections.length > 0) {
    parts.push(`collection=${query.collections.join(",")}`);
  }
  if (query.statuses.length > 0) {
    parts.push(`status=${query.statuses.join(",")}`);
  }
  if (query.priceBands.length > 0) {
    parts.push(`price=${query.priceBands.join(",")}`);
  }
  if (query.priceRange.min !== null) {
    parts.push(`min=${query.priceRange.min}`);
  }
  if (query.priceRange.max !== null) {
    parts.push(`max=${query.priceRange.max}`);
  }
  if (query.sort !== DEFAULT_SORT) {
    parts.push(`sort=${query.sort}`);
  }
  if (query.page > 1) {
    parts.push(`page=${query.page}`);
  }

  return parts.length === 0 ? SHOP_PATH : `${SHOP_PATH}?${parts.join("&")}`;
}

/**
 * The URL a listing should declare as its own, which is not always the URL it was reached by.
 * Sort order rearranges a set of results without changing which results they are, so
 * `?sort=price-asc` is the same page as the unsorted one and must not compete with it in an
 * index. Filters and page number are not stripped: each of those genuinely selects a
 * different set of products, and folding them together would point a crawler at a page that
 * does not contain what it just read. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 */
export function buildCanonicalShopHref(query: ShopQuery): string {
  return buildShopHref({ ...query, sort: DEFAULT_SORT });
}

function toggle<T>(values: T[], value: T, rank: Map<T, number>): T[] {
  const next = values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
  return uniqueInOrder(next, rank);
}

export function toggleCategory(query: ShopQuery, slug: Category): ShopQuery {
  return {
    ...query,
    categories: toggle(query.categories, slug, CATEGORY_ORDER),
    page: 1,
  };
}

export function toggleCollection(
  query: ShopQuery,
  slug: CollectionFilterSlug,
): ShopQuery {
  return {
    ...query,
    collections: toggle(query.collections, slug, COLLECTION_ORDER),
    page: 1,
  };
}

export function togglePriceBand(query: ShopQuery, slug: PriceBandSlug): ShopQuery {
  return {
    ...query,
    priceBands: toggle(query.priceBands, slug, PRICE_BAND_ORDER),
    page: 1,
  };
}

export function toggleStatus(query: ShopQuery, slug: StatusSlug): ShopQuery {
  return {
    ...query,
    statuses: toggle(query.statuses, slug, STATUS_ORDER),
    page: 1,
  };
}

export function withPriceRange(query: ShopQuery, priceRange: PriceRange): ShopQuery {
  return { ...query, priceRange, page: 1 };
}

export function withoutPriceRange(query: ShopQuery): ShopQuery {
  return withPriceRange(query, EMPTY_PRICE_RANGE);
}

export function withSort(query: ShopQuery, sort: SortSlug): ShopQuery {
  return { ...query, sort, page: 1 };
}

export function withPage(query: ShopQuery, page: number): ShopQuery {
  return { ...query, page };
}

/**
 * How many filters the shopper has applied, which is what the mobile Filters button counts.
 * The custom range is one filter however many of its two bounds are filled: it is one chip and
 * one clearing action, and counting a min and a max separately would say "2" for one control.
 */
export function countActiveFilters(query: ShopQuery): number {
  return (
    query.categories.length +
    query.collections.length +
    query.statuses.length +
    query.priceBands.length +
    (hasPriceRange(query.priceRange) ? 1 : 0)
  );
}

export type PaginationSlot = number | "ellipsis";

const PAGINATION_WINDOW = 1;
const PAGINATION_MAX_SLOTS = 7;

/**
 * First page, last page, and the pages adjacent to the current one, with ellipses standing
 * in for the runs between. Below the slot ceiling every page is listed instead.
 */
export function buildPaginationRange(
  page: number,
  totalPages: number,
): PaginationSlot[] {
  if (totalPages <= PAGINATION_MAX_SLOTS) {
    return Array.from({ length: totalPages }, (_unused, index) => index + 1);
  }

  const pageNumbers = new Set<number>([1, totalPages]);
  for (let offset = -PAGINATION_WINDOW; offset <= PAGINATION_WINDOW; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) pageNumbers.add(candidate);
  }

  const ordered = Array.from(pageNumbers).sort((left, right) => left - right);
  const slots: PaginationSlot[] = [];

  ordered.forEach((pageNumber, index) => {
    const previous = ordered[index - 1];
    if (previous !== undefined && pageNumber - previous > 1) slots.push("ellipsis");
    slots.push(pageNumber);
  });

  return slots;
}
