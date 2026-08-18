import {
  getCategoryLabel,
  getCollection,
  getCollectionLabel,
  isCollectionTag,
  type Category,
  type CollectionFilterSlug,
  type Product,
} from "@/types/product";
import { getAllProducts } from "@/lib/products";
import {
  PER_PAGE,
  getPriceBand,
  getPriceBandLabel,
  isPriceInBand,
  parseShopQuery,
  type PriceBandSlug,
  type ShopQuery,
  type ShopSearchParams,
  type SortSlug,
} from "@/lib/shop-query";

export * from "@/lib/shop-query";

/**
 * Discriminated so a chip can build its own removal link without casting a bare string
 * back into a `Category` or a `PriceBandSlug`.
 */
export type AppliedFilter =
  | { kind: "category"; slug: Category; label: string }
  | { kind: "collection"; slug: CollectionFilterSlug; label: string }
  | { kind: "price"; slug: PriceBandSlug; label: string };

export interface ShopResults {
  items: Product[];
  total: number;
  totalPages: number;
  page: number;
  /** 1-based inclusive display range; both are 0 when nothing matched. */
  rangeStart: number;
  rangeEnd: number;
  query: ShopQuery;
  appliedFilters: AppliedFilter[];
}

/**
 * The catalogue carries no timestamp, so "newest" is the `isNew` flag with rating as the
 * tiebreak rather than a true recency order — see ADR-008. Every comparator ends on `id`
 * so ordering is total and pagination cannot drop or repeat a product across pages.
 */
const sortComparators: Record<SortSlug, (left: Product, right: Product) => number> = {
  newest: (left, right) =>
    Number(right.flags.isNew) - Number(left.flags.isNew) ||
    right.rating.average - left.rating.average ||
    left.id.localeCompare(right.id),
  "rating-desc": (left, right) =>
    right.rating.average - left.rating.average ||
    right.rating.count - left.rating.count ||
    left.id.localeCompare(right.id),
  "price-asc": (left, right) =>
    left.pricing.price - right.pricing.price || left.id.localeCompare(right.id),
  "price-desc": (left, right) =>
    right.pricing.price - left.pricing.price || left.id.localeCompare(right.id),
};

function matchesCategories(product: Product, categories: ShopQuery["categories"]): boolean {
  return categories.length === 0 || categories.includes(product.category);
}

/**
 * A collection reads whichever field its `source` names: the hand-written tag list, or one
 * of the two flags. Adding a collection is a row in `COLLECTIONS`; nothing here needs a new
 * branch unless a genuinely new *kind* of source appears.
 */
export function isProductInCollection(
  product: Product,
  slug: CollectionFilterSlug,
): boolean {
  const { source } = getCollection(slug);

  switch (source.kind) {
    case "tag":
      return isCollectionTag(slug) && (product.collections ?? []).includes(slug);
    case "featured-flag":
      return product.flags.featured;
    case "new-flag":
      return product.flags.isNew;
  }
}

function matchesCollections(
  product: Product,
  collections: CollectionFilterSlug[],
): boolean {
  if (collections.length === 0) return true;
  return collections.some((slug) => isProductInCollection(product, slug));
}

function matchesPriceBands(product: Product, priceBands: PriceBandSlug[]): boolean {
  if (priceBands.length === 0) return true;
  return priceBands.some((slug) =>
    isPriceInBand(product.pricing.price, getPriceBand(slug)),
  );
}

/**
 * Selections within a facet are OR-ed; the three facets are AND-ed. Pure — it reads the
 * product and the query and nothing else, which is what lets the tests drive it with
 * fixtures instead of the real catalogue.
 */
export function matchesShopQuery(product: Product, query: ShopQuery): boolean {
  return (
    matchesCategories(product, query.categories) &&
    matchesCollections(product, query.collections) &&
    matchesPriceBands(product, query.priceBands)
  );
}

function toAppliedFilters(query: ShopQuery): AppliedFilter[] {
  const categoryFilters: AppliedFilter[] = query.categories.map((slug) => ({
    kind: "category",
    slug,
    label: getCategoryLabel(slug),
  }));

  const collectionFilters: AppliedFilter[] = query.collections.map((slug) => ({
    kind: "collection",
    slug,
    label: getCollectionLabel(slug),
  }));

  const priceFilters: AppliedFilter[] = query.priceBands.map((slug) => ({
    kind: "price",
    slug,
    label: getPriceBandLabel(slug),
  }));

  return [...categoryFilters, ...collectionFilters, ...priceFilters];
}

/**
 * Pure and side-effect-free: the same params always produce the same result, and nothing
 * outside this call is mutated. Selections within a facet are OR-ed, the facets are
 * AND-ed, and an out-of-range page is clamped rather than treated as an error.
 */
export function getShopResults(params: ShopSearchParams): ShopResults {
  const requested = parseShopQuery(params);

  const matched = getAllProducts().filter((product) =>
    matchesShopQuery(product, requested),
  );

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(requested.page, totalPages);

  const offset = (page - 1) * PER_PAGE;
  const items = matched
    .sort(sortComparators[requested.sort])
    .slice(offset, offset + PER_PAGE);

  return {
    items,
    total,
    totalPages,
    page,
    rangeStart: total === 0 ? 0 : offset + 1,
    rangeEnd: total === 0 ? 0 : offset + items.length,
    query: { ...requested, page },
    appliedFilters: toAppliedFilters(requested),
  };
}
