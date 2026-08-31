import type { Metadata } from "next";
import { SURFACED_CATEGORIES, getCategoryLabel, getCollectionLabel } from "@/types/product";
import {
  FREE_SHIPPING_THRESHOLD,
  PRODUCT_DESCRIPTOR,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import {
  buildCanonicalShopHref,
  buildShopHref,
  getShopResults,
  hasSearchTerm,
  withPage,
  type ShopQuery,
  type ShopResults,
} from "@/lib/shop";
import { buildCollectionPageSchemaGraph } from "@/lib/structured-data";
import { ButtonLink } from "@/components/ButtonLink";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { ShopActiveFilters } from "@/components/ShopActiveFilters";
import { ShopFilterDrawer } from "@/components/ShopFilterDrawer";
import { ShopFilterPanel } from "@/components/ShopFilterPanel";
import { ShopSortSelect } from "@/components/ShopSortSelect";

interface ShopPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * A single selection in exactly one facet is what earns a page its own name — the category
 * it is, or the collection it is. Anything broader or narrower stays the generic shop
 * listing, so no combination of filters can mint a title that misdescribes the results.
 */
function singleFacetLabelOf(query: ShopQuery): string | null {
  /**
   * A searched listing is never a named page, whatever else is ticked. "Rings" as a title over
   * the four rings that matched the word "star" describes a page that does not exist.
   */
  if (hasSearchTerm(query)) return null;

  const isSingleCategory =
    query.categories.length === 1 && query.collections.length === 0;
  if (isSingleCategory) return getCategoryLabel(query.categories[0]);

  const isSingleCollection =
    query.collections.length === 1 && query.categories.length === 0;
  if (isSingleCollection) return getCollectionLabel(query.collections[0]);

  return null;
}

function listingTitleOf(query: ShopQuery): string {
  if (hasSearchTerm(query)) return `Search: ${query.search}`;
  const facetLabel = singleFacetLabelOf(query);
  return facetLabel === null ? "Shop All Jewellery" : facetLabel;
}

function listingDescriptionOf(query: ShopQuery): string {
  const facetLabel = singleFacetLabelOf(query);
  const subject = facetLabel === null ? "the full collection" : facetLabel.toLowerCase();

  return `Shop ${subject} at ${SITE_CONFIG.brandName}: ${PRODUCT_DESCRIPTOR}, hand-finished and quality-checked, with free shipping over ${formatRupees(FREE_SHIPPING_THRESHOLD)} across India and easy ${RETURN_WINDOW_DAYS}-day returns.`;
}

/**
 * A filter combination that matches nothing still renders — a shopper who lands on it gets
 * the empty state and a way out — but it is not a page worth putting in an index. Left
 * indexable, an empty facet is a thin page a crawler spends budget on and a searcher lands
 * on to find nothing, which is what a soft 404 is. `follow` stays on so the links out of it
 * are still crawled. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 */
export function generateMetadata({ searchParams }: ShopPageProps): Metadata {
  const { query, total } = getShopResults(searchParams);

  const title = listingTitleOf(query);
  const description = listingDescriptionOf(query);
  const canonical = buildCanonicalShopHref(query);

  return {
    title,
    description,
    alternates: { canonical },
    /**
     * A searched listing is `noindex` however many products it found. `?q=` accepts arbitrary
     * text, so leaving it indexable would mint an unbounded set of near-duplicate pages for a
     * crawler to spend its budget on — the classic internal-search trap — and the useful page
     * for any of those terms is the category or collection listing that already exists.
     * `follow` stays on, as it does for an empty facet, so the products found are still crawled.
     */
    ...(total === 0 || hasSearchTerm(query) ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_CONFIG.brandName,
      locale: "en_IN",
      url: canonical,
      title: `${title} · ${SITE_CONFIG.brandName}`,
      description,
      images: [SITE_CONFIG.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_CONFIG.brandName}`,
      description,
      images: [SITE_CONFIG.ogImage.url],
    },
  };
}

/**
 * No `ItemList` for a page with nothing on it: an empty list is not a smaller list, it is a
 * claim about a collection that has no members, on a page already marked `noindex`.
 */
function ListingSchema({ results }: { results: ShopResults }): JSX.Element | null {
  if (results.total === 0) return null;

  return (
    <JsonLd
      id="shop-collection-schema"
      graph={buildCollectionPageSchemaGraph({
        path: buildCanonicalShopHref(results.query),
        name: listingTitleOf(results.query),
        description: listingDescriptionOf(results.query),
        products: results.items,
        total: results.total,
        rangeStart: results.rangeStart,
      })}
    />
  );
}

function EmptyResults(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 border border-line bg-ivory px-4 py-12 text-center sm:gap-6 sm:px-6 sm:py-20">
      <h2 className="font-display text-heading-sm text-ink">
        Nothing matches those filters
      </h2>
      <p className="max-w-prose text-body-sm text-muted">
        Every piece is made in small batches, so some combinations come up empty. Widening
        the price range or clearing a category usually finds something close.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <ButtonLink href="/shop">Clear filters</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Continue shopping
        </ButtonLink>
      </div>
    </div>
  );
}

export default function ShopPage({ searchParams }: ShopPageProps): JSX.Element {
  const results = getShopResults(searchParams);
  const { query } = results;
  const facetLabel = singleFacetLabelOf(query);
  const isSearched = hasSearchTerm(query);

  return (
    <div className="container py-8 sm:py-12 lg:py-16">
      <ListingSchema results={results} />

      <header className="flex flex-col gap-4">
        {isSearched ? (
          <SectionHeading
            as="h1"
            align="left"
            roman="Search"
            accent={`“${query.search}”`}
            subtitle={
              results.total === 0
                ? "Nothing in the collection matches those words."
                : `${results.total} ${results.total === 1 ? "piece matches" : "pieces match"} those words. Narrow them further with the filters.`
            }
          />
        ) : (
          <SectionHeading
            as="h1"
            align="left"
            roman={facetLabel === null ? "The" : "Shop"}
            accent={facetLabel === null ? "Collection" : facetLabel}
            subtitle={
              facetLabel === null
                ? `Every piece we make, anti-tarnish and hand-finished, across ${SURFACED_CATEGORIES.length} categories.`
                : `Every ${facetLabel.toLowerCase()} piece in the collection, anti-tarnish and hand-finished.`
            }
          />
        )}
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-10 sm:gap-10 lg:mt-14 lg:grid-cols-[15rem_1fr] lg:gap-14">
        <aside className="hidden lg:block">
          <h2 className="sr-only">Filters</h2>
          <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto pb-4 pr-1">
            <ShopFilterPanel query={query} categoryCounts={results.categoryCounts} />
          </div>
        </aside>

        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4 sm:pb-5">
            <div className="flex items-center gap-4">
              <ShopFilterDrawer
                query={query}
                categoryCounts={results.categoryCounts}
              />
              <p className="text-body-sm text-muted">
                {results.total === 0
                  ? "No pieces match"
                  : `Showing ${results.rangeStart}–${results.rangeEnd} of ${results.total} pieces`}
              </p>
            </div>
            <ShopSortSelect query={query} />
          </div>

          <ShopActiveFilters query={query} filters={results.appliedFilters} />

          {results.total === 0 ? (
            <EmptyResults />
          ) : (
            <>
              <ProductGrid products={results.items} priorityCount={4} />
              <Pagination
                page={results.page}
                totalPages={results.totalPages}
                hrefForPage={(page) => buildShopHref(withPage(query, page))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
