import {
  CATEGORY_SLUGS,
  getCategoryLabel,
  getCollection,
  getCollectionLabel,
  isCollectionTag,
  type Category,
  type CollectionFilterSlug,
  type Product,
} from "@/types/product";
import { getAllProducts } from "@/lib/products";
import { selectProductBadge } from "@/lib/product-badge";
import { matchesSearchTerm } from "@/lib/product-search";
import {
  PER_PAGE,
  formatPriceRange,
  getPriceBand,
  getPriceBandLabel,
  getStatusLabel,
  hasPriceRange,
  isPriceInBand,
  isPriceInRange,
  parseShopQuery,
  type PriceBandSlug,
  type ShopQuery,
  type ShopSearchParams,
  type SortSlug,
  type StatusSlug,
} from "@/lib/shop-query";

export * from "@/lib/shop-query";

/**
 * Discriminated so a chip can build its own removal link without casting a bare string
 * back into a `Category` or a `PriceBandSlug`.
 */
export type AppliedFilter =
  /** The free-text term, as one chip whose × drops the words and keeps every tick-box. */
  | { kind: "search"; label: string }
  | { kind: "category"; slug: Category; label: string }
  | { kind: "collection"; slug: CollectionFilterSlug; label: string }
  | { kind: "status"; slug: StatusSlug; label: string }
  | { kind: "price"; slug: PriceBandSlug; label: string }
  /** The custom range is one chip with no slug — clearing it clears both bounds. */
  | { kind: "price-range"; label: string };

/** How many products each category would show, keyed by slug. */
export type CategoryCounts = Record<Category, number>;

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
  /**
   * One count per surfaced category, computed with **every facet except category applied**.
   *
   * Counting against the whole catalogue would have been simpler and would have lied by one
   * step: with "Under ₹99" ticked, a static "Watches (14)" promises fourteen watches and
   * delivers none. Counting against the *current* results instead would have zeroed every
   * category the shopper has not ticked, since a category filter excludes the others by
   * definition. Excluding only its own facet is the reading that makes the number mean what a
   * shopper takes it to mean: what ticking this box would give them.
   */
  categoryCounts: CategoryCounts;
}

/**
 * Every comparator ends on `id`, so the ordering is total and pagination cannot drop or repeat
 * a product across pages — two pieces at the same price, or two sharing a name, still have one
 * fixed order.
 *
 * Names are compared with `localeCompare` rather than `<`, so "Émeraude" files under E and
 * casing does not split the alphabet in two the way a code-point compare does.
 */
const sortComparators: Record<SortSlug, (left: Product, right: Product) => number> = {
  "name-asc": (left, right) =>
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  "name-desc": (left, right) =>
    right.name.localeCompare(left.name) || left.id.localeCompare(right.id),
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
 * The status facet asks the badge cascade, not the fields under it, so the facet and the card
 * cannot disagree: a piece filed under "Only a few left" is one whose card says exactly that.
 * A product showing no badge matches no status, which is why an unbadged product disappears
 * the moment any status is ticked.
 */
function matchesStatuses(product: Product, statuses: StatusSlug[]): boolean {
  if (statuses.length === 0) return true;
  const badge = selectProductBadge(product.stock, product.flags);
  return badge !== null && statuses.includes(badge.kind);
}

/**
 * Selections within a facet are OR-ed; the facets are AND-ed. Pure — it reads the product and
 * the query and nothing else, which is what lets the tests drive it with fixtures instead of
 * the real catalogue.
 */
export function matchesShopQuery(product: Product, query: ShopQuery): boolean {
  return (
    matchesSearchTerm(product, query.search) &&
    matchesCategories(product, query.categories) &&
    matchesCollections(product, query.collections) &&
    matchesStatuses(product, query.statuses) &&
    matchesPriceBands(product, query.priceBands) &&
    isPriceInRange(product.pricing.price, query.priceRange)
  );
}

function toAppliedFilters(query: ShopQuery): AppliedFilter[] {
  const searchFilters: AppliedFilter[] =
    query.search.length === 0 ? [] : [{ kind: "search", label: `“${query.search}”` }];

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

  const statusFilters: AppliedFilter[] = query.statuses.map((slug) => ({
    kind: "status",
    slug,
    label: getStatusLabel(slug),
  }));

  const priceFilters: AppliedFilter[] = query.priceBands.map((slug) => ({
    kind: "price",
    slug,
    label: getPriceBandLabel(slug),
  }));

  const rangeFilters: AppliedFilter[] = hasPriceRange(query.priceRange)
    ? [{ kind: "price-range", label: formatPriceRange(query.priceRange) }]
    : [];

  return [
    ...searchFilters,
    ...categoryFilters,
    ...collectionFilters,
    ...statusFilters,
    ...priceFilters,
    ...rangeFilters,
  ];
}

/**
 * What each category box would show if it were the only one ticked, given everything else the
 * shopper has already chosen. The category facet is emptied before counting rather than the
 * counts being taken over the current results — see `ShopResults.categoryCounts`.
 */
function countByCategory(query: ShopQuery, products: Product[]): CategoryCounts {
  const withoutCategoryFacet: ShopQuery = { ...query, categories: [] };
  const counts = Object.fromEntries(
    CATEGORY_SLUGS.map((slug) => [slug, 0]),
  ) as CategoryCounts;

  for (const product of products) {
    if (!matchesShopQuery(product, withoutCategoryFacet)) continue;
    counts[product.category] += 1;
  }

  return counts;
}

/**
 * Pure and side-effect-free: the same params always produce the same result, and nothing
 * outside this call is mutated. Selections within a facet are OR-ed, the facets are
 * AND-ed, and an out-of-range page is clamped rather than treated as an error.
 */
export function getShopResults(params: ShopSearchParams): ShopResults {
  const requested = parseShopQuery(params);

  const everyProduct = getAllProducts();
  const matched = everyProduct.filter((product) =>
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
    categoryCounts: countByCategory(requested, everyProduct),
  };
}
