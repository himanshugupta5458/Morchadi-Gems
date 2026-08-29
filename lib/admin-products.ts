import {
  CATEGORIES,
  getCategoryLabel,
  isCategory,
  isProductStatus,
  type Category,
  type Product,
} from "@/types/product";
import {
  PRICE_BANDS,
  getPriceBand,
  isPriceBandSlug,
  isPriceInBand,
  type PriceBandSlug,
} from "@/lib/shop-query";

/**
 * The product list's own query language — what the URL may say, and what that means.
 *
 * Pure, and deliberately not `server-only`: it reads a `Product` and a query object and touches
 * neither the filesystem nor the catalogue. The repository is what fetches records; this decides
 * which of them a page shows. That split is what lets the whole of this file be tested without a
 * catalogue on disk, and it is the same shape `lib/shop-query.ts` has for the storefront.
 *
 * It reuses `lib/shop-query.ts`'s price bands rather than inventing admin ones, because a band is
 * a fact about this shop's prices and not about who is looking. It does **not** reuse
 * `lib/shop.ts`, which imports `getAllProducts` — that would put the storefront's compiled
 * catalogue behind an admin page and defeat the repository boundary
 * ([ADR-064](/docs/decisions/ADR-064-admin-product-management.md)).
 */

/**
 * The four views, and why these four.
 *
 * `live`, `out-of-stock` and `draft` **partition** the catalogue: every record is in exactly one
 * of them, because the question they answer together is "can a shopper buy this right now, and if
 * not, why not". That is the same property `ADMIN_ORDER_VIEWS` has — Active and Resolved are work
 * outstanding and work finished, not two overlapping filters — and it is what makes a tab
 * meaningful rather than decorative.
 *
 * Featured is **not** a view for that reason. It is an attribute a live product may also carry,
 * so a Featured tab would overlap `live` and answer a merchandising question rather than a
 * sellability one. It is a filter instead, alongside New.
 */
export const ADMIN_PRODUCT_VIEWS = ["all", "live", "out-of-stock", "draft"] as const;

export type AdminProductView = (typeof ADMIN_PRODUCT_VIEWS)[number];

export const DEFAULT_ADMIN_PRODUCT_VIEW: AdminProductView = "all";

export const ADMIN_PRODUCT_VIEW_LABELS: Record<AdminProductView, string> = {
  all: "All",
  live: "Live",
  "out-of-stock": "Out of stock",
  draft: "Draft",
};

export const ADMIN_PRODUCT_SORTS = ["id", "name", "price-high", "price-low"] as const;

export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number];

/**
 * By id, because the id is the owner's P-code — the number on the invoice, the photograph and
 * every message about stock. An operator looking for a product knows its code far more often than
 * its position in any other order.
 */
export const DEFAULT_ADMIN_PRODUCT_SORT: AdminProductSort = "id";

export const ADMIN_PRODUCT_SORT_LABELS: Record<AdminProductSort, string> = {
  id: "Product code",
  name: "Name, A to Z",
  "price-high": "Price, high to low",
  "price-low": "Price, low to high",
};

/** The two merchandising flags, as one filter — a product is rarely being audited for both. */
export const ADMIN_PRODUCT_FLAGS = ["featured", "new"] as const;

export type AdminProductFlag = (typeof ADMIN_PRODUCT_FLAGS)[number];

export const ADMIN_PRODUCT_FLAG_LABELS: Record<AdminProductFlag, string> = {
  featured: "Featured",
  new: "New arrival",
};

/**
 * Twenty-five to a page, matching the order list. At 449 products that is eighteen pages, which
 * is more than anyone pages through — the filters are how you get somewhere specific, and the
 * count is what tells you whether you are looking at all of it.
 */
export const ADMIN_PRODUCTS_PAGE_SIZE = 25;

export const MAX_ADMIN_PRODUCT_SEARCH_LENGTH = 60;

export interface AdminProductQuery {
  view: AdminProductView;
  category: Category | null;
  priceBand: PriceBandSlug | null;
  flag: AdminProductFlag | null;
  search: string;
  sort: AdminProductSort;
  page: number;
}

/**
 * How one product reads in the list. Narrow on purpose, and `pricing.cost` is the field it is
 * narrow *about*: margin data has no business in a list that exists to help somebody find a
 * record, and a row shape that does not carry it cannot leak it into a page's serialised props.
 * The detail page reads cost from the repository when it needs it.
 */
export interface AdminProductRow {
  id: string;
  name: string;
  category: Category;
  categoryLabel: string;
  price: number;
  mrp: number;
  inStock: boolean;
  isDraft: boolean;
  featured: boolean;
  isNew: boolean;
  optionCount: number;
}

export interface AdminProductPage {
  rows: AdminProductRow[];
  totalCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export type AdminProductSearchParams = Record<string, string | string[] | undefined>;

function readParam(params: AdminProductSearchParams, key: string): string {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The URL reduced to a query, with every field defaulted rather than optional.
 *
 * Nothing here can fail, on the same reasoning `parseAdminOrderQuery` gives: a URL gets hand-
 * edited, bookmarked and truncated, so an unrecognised view, an impossible category or a page of
 * `-4` falls back to the default it replaces instead of producing an error page.
 */
export function parseAdminProductQuery(
  params: AdminProductSearchParams,
): AdminProductQuery {
  const requestedView = readParam(params, "view");
  const view =
    ADMIN_PRODUCT_VIEWS.find((candidate) => candidate === requestedView) ??
    DEFAULT_ADMIN_PRODUCT_VIEW;

  const requestedCategory = readParam(params, "category").toLowerCase();
  const category = isCategory(requestedCategory) ? requestedCategory : null;

  const requestedBand = readParam(params, "price");
  const priceBand = isPriceBandSlug(requestedBand) ? requestedBand : null;

  const requestedFlag = readParam(params, "flag");
  const flag = ADMIN_PRODUCT_FLAGS.find((candidate) => candidate === requestedFlag) ?? null;

  const requestedSort = readParam(params, "sort");
  const sort =
    ADMIN_PRODUCT_SORTS.find((candidate) => candidate === requestedSort) ??
    DEFAULT_ADMIN_PRODUCT_SORT;

  const requestedPage = Number.parseInt(readParam(params, "page"), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  return {
    view,
    category,
    priceBand,
    flag,
    search: readParam(params, "search").slice(0, MAX_ADMIN_PRODUCT_SEARCH_LENGTH),
    sort,
    page,
  };
}

/**
 * Whether a record belongs to a view. A draft is a draft whether or not it is in stock — the
 * field a shopper never reaches cannot describe why they cannot buy it — so the status question
 * is asked first.
 */
export function matchesAdminProductView(product: Product, view: AdminProductView): boolean {
  const isDraft = isProductStatus(product.status) && product.status === "draft";

  switch (view) {
    case "draft":
      return isDraft;
    case "live":
      return !isDraft && product.stock.inStock;
    case "out-of-stock":
      return !isDraft && !product.stock.inStock;
    default:
      return true;
  }
}

/**
 * The id and the name, both matched as substrings and case-insensitively, so `p04` finds P040
 * through P049 and `bow` finds every bow ring. There is no phone-number special case here of the
 * kind the order search needs: both fields are text a person reads off a screen.
 */
function matchesAdminProductSearch(product: Product, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (term.length === 0) return true;

  return (
    product.id.toLowerCase().includes(term) || product.name.toLowerCase().includes(term)
  );
}

function matchesAdminProductFlag(product: Product, flag: AdminProductFlag | null): boolean {
  if (flag === null) return true;
  return flag === "featured" ? product.flags.featured : product.flags.isNew;
}

export function matchesAdminProductQuery(
  product: Product,
  query: AdminProductQuery,
): boolean {
  return (
    matchesAdminProductView(product, query.view) &&
    (query.category === null || product.category === query.category) &&
    (query.priceBand === null ||
      isPriceInBand(product.pricing.price, getPriceBand(query.priceBand))) &&
    matchesAdminProductFlag(product, query.flag) &&
    matchesAdminProductSearch(product, query.search)
  );
}

/**
 * Every comparator ends on `id`, which is unique, so ordering is total and two products sharing a
 * price or a name cannot swap places between page one and page two and hide a row. It is the same
 * rule `lib/shop.ts` and `buildAdminOrderOrderBy` both follow.
 */
const ADMIN_PRODUCT_COMPARATORS: Record<
  AdminProductSort,
  (left: Product, right: Product) => number
> = {
  id: (left, right) => left.id.localeCompare(right.id),
  name: (left, right) =>
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  "price-high": (left, right) =>
    right.pricing.price - left.pricing.price || left.id.localeCompare(right.id),
  "price-low": (left, right) =>
    left.pricing.price - right.pricing.price || left.id.localeCompare(right.id),
};

export function toAdminProductRow(product: Product): AdminProductRow {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    categoryLabel: getCategoryLabel(product.category),
    price: product.pricing.price,
    mrp: product.pricing.mrp,
    inStock: product.stock.inStock,
    isDraft: product.status === "draft",
    featured: product.flags.featured,
    isNew: product.flags.isNew,
    optionCount: product.options?.length ?? 0,
  };
}

export function countPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/**
 * The page actually shown, which is not always the page asked for — a filter that narrows the
 * list while the operator is on page eight would otherwise leave them staring at nothing.
 */
export function resolvePage(requestedPage: number, pageCount: number): number {
  return Math.min(Math.max(1, requestedPage), pageCount);
}

/**
 * One page of products from the whole catalogue: filter, sort, then slice.
 *
 * In memory rather than in a query, because the repository hands over an array and 449 records
 * cost nothing to walk. When the catalogue moves to Postgres this is the function that becomes a
 * `where`/`orderBy`/`skip`/`take` — and the page above it will not know, because it already reads
 * `AdminProductPage` rather than an array.
 */
export function selectAdminProductPage(
  products: readonly Product[],
  query: AdminProductQuery,
): AdminProductPage {
  const matched = products
    .filter((product) => matchesAdminProductQuery(product, query))
    .sort(ADMIN_PRODUCT_COMPARATORS[query.sort]);

  const totalCount = matched.length;
  const pageCount = countPages(totalCount, ADMIN_PRODUCTS_PAGE_SIZE);
  const page = resolvePage(query.page, pageCount);
  const start = (page - 1) * ADMIN_PRODUCTS_PAGE_SIZE;

  return {
    rows: matched.slice(start, start + ADMIN_PRODUCTS_PAGE_SIZE).map(toAdminProductRow),
    totalCount,
    page,
    pageCount,
    pageSize: ADMIN_PRODUCTS_PAGE_SIZE,
  };
}

/**
 * The list's own URL, rebuilt with some of its query changed. Defaults are omitted, so the
 * unfiltered list stays at a clean `/products` and "am I looking at a filtered list?" is
 * answerable from the address bar.
 *
 * `page` resets to one on every change except a change of `page` itself, for the reason
 * `buildAdminOrdersHref` gives: narrowing a filter while on page three should show the first page
 * of the new list, not its third.
 */
export function buildAdminProductsHref(
  basePath: string,
  query: AdminProductQuery,
  changes: Partial<AdminProductQuery> = {},
): string {
  const next: AdminProductQuery = {
    ...query,
    ...changes,
    page: changes.page ?? (Object.keys(changes).length === 0 ? query.page : 1),
  };

  const params = new URLSearchParams();
  if (next.view !== DEFAULT_ADMIN_PRODUCT_VIEW) params.set("view", next.view);
  if (next.category !== null) params.set("category", next.category);
  if (next.priceBand !== null) params.set("price", next.priceBand);
  if (next.flag !== null) params.set("flag", next.flag);
  if (next.search !== "") params.set("search", next.search);
  if (next.sort !== DEFAULT_ADMIN_PRODUCT_SORT) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  const queryString = params.toString();
  return queryString === "" ? basePath : `${basePath}?${queryString}`;
}

/** Whether anything beyond the current view is narrowing the list. Drives "Clear filters". */
export function hasActiveAdminProductFilters(query: AdminProductQuery): boolean {
  return (
    query.category !== null ||
    query.priceBand !== null ||
    query.flag !== null ||
    query.search !== ""
  );
}

/**
 * Every category a product record may carry, not only the ones a shopper can browse. The admin
 * filter is a tool for finding a record, and a record filed under a category that is still
 * pending is exactly the record somebody needs to find. See ADR-055.
 */
export const ADMIN_PRODUCT_CATEGORY_OPTIONS: readonly { slug: Category; label: string }[] =
  CATEGORIES.map((category) => ({ slug: category.slug, label: category.label }));

export const ADMIN_PRODUCT_PRICE_BAND_OPTIONS = PRICE_BANDS;
