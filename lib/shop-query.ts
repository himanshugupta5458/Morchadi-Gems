import { CATEGORIES, isCategory, type Category } from "@/types/product";

export const SHOP_PATH = "/shop";
export const PER_PAGE = 12;

export type PriceBandSlug = "under-999" | "1000-4999" | "5000-plus";

export interface PriceBand {
  slug: PriceBandSlug;
  label: string;
  min: number;
  /** `null` is unbounded above. Bounds are inclusive at both ends. */
  max: number | null;
}

export const PRICE_BANDS: readonly PriceBand[] = [
  { slug: "under-999", label: "Under ₹999", min: 0, max: 999 },
  { slug: "1000-4999", label: "₹1,000 – ₹4,999", min: 1000, max: 4999 },
  { slug: "5000-plus", label: "₹5,000 & above", min: 5000, max: null },
];

export type SortSlug = "newest" | "rating-desc" | "price-asc" | "price-desc";

export interface SortOption {
  slug: SortSlug;
  label: string;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  { slug: "newest", label: "Newest first" },
  { slug: "rating-desc", label: "Top rated" },
  { slug: "price-asc", label: "Price: low to high" },
  { slug: "price-desc", label: "Price: high to low" },
];

export const DEFAULT_SORT: SortSlug = "newest";

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

export function getSortLabel(slug: SortSlug): string {
  const match = SORT_OPTIONS.find((option) => option.slug === slug);
  return match ? match.label : slug;
}

export function isPriceInBand(price: number, band: PriceBand): boolean {
  if (price < band.min) return false;
  return band.max === null || price <= band.max;
}

export type RawSearchParam = string | string[] | undefined;

export interface ShopSearchParams {
  category?: RawSearchParam;
  price?: RawSearchParam;
  sort?: RawSearchParam;
  page?: RawSearchParam;
}

export interface ShopQuery {
  categories: Category[];
  priceBands: PriceBandSlug[];
  sort: SortSlug;
  page: number;
}

const CATEGORY_ORDER = new Map(
  CATEGORIES.map((category, index) => [category.slug, index] as const),
);

const PRICE_BAND_ORDER = new Map(
  PRICE_BANDS.map((band, index) => [band.slug, index] as const),
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

function parsePageToken(token: string | undefined): number {
  if (token === undefined) return 1;
  const parsed = Number(token);
  if (!Number.isFinite(parsed)) return 1;
  const whole = Math.floor(parsed);
  return whole < 1 ? 1 : whole;
}

export function parseShopQuery(params: ShopSearchParams): ShopQuery {
  const categories = uniqueInOrder(
    toTokens(params.category).filter(isCategory),
    CATEGORY_ORDER,
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
    priceBands,
    sort,
    page: parsePageToken(toTokens(params.page)[0]),
  };
}

export function emptyShopQuery(): ShopQuery {
  return { categories: [], priceBands: [], sort: DEFAULT_SORT, page: 1 };
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
  if (query.priceBands.length > 0) {
    parts.push(`price=${query.priceBands.join(",")}`);
  }
  if (query.sort !== DEFAULT_SORT) {
    parts.push(`sort=${query.sort}`);
  }
  if (query.page > 1) {
    parts.push(`page=${query.page}`);
  }

  return parts.length === 0 ? SHOP_PATH : `${SHOP_PATH}?${parts.join("&")}`;
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

export function togglePriceBand(query: ShopQuery, slug: PriceBandSlug): ShopQuery {
  return {
    ...query,
    priceBands: toggle(query.priceBands, slug, PRICE_BAND_ORDER),
    page: 1,
  };
}

export function withSort(query: ShopQuery, sort: SortSlug): ShopQuery {
  return { ...query, sort, page: 1 };
}

export function withPage(query: ShopQuery, page: number): ShopQuery {
  return { ...query, page };
}

export function countActiveFilters(query: ShopQuery): number {
  return query.categories.length + query.priceBands.length;
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
