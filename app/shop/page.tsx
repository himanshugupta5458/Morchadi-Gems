import type { Metadata } from "next";
import { getCategoryLabel } from "@/types/product";
import {
  FREE_SHIPPING_THRESHOLD,
  PRODUCT_DESCRIPTOR,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { buildShopHref, getShopResults, withPage, type ShopQuery } from "@/lib/shop";
import { ButtonLink } from "@/components/ButtonLink";
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

function singleCategoryOf(query: ShopQuery): string | null {
  return query.categories.length === 1 ? getCategoryLabel(query.categories[0]) : null;
}

export function generateMetadata({ searchParams }: ShopPageProps): Metadata {
  const { query } = getShopResults(searchParams);
  const categoryLabel = singleCategoryOf(query);

  const title = categoryLabel === null ? "Shop All Jewellery" : categoryLabel;
  const subject = categoryLabel === null ? "the full collection" : categoryLabel.toLowerCase();
  const description = `Shop ${subject} at ${SITE_CONFIG.brandName} — ${PRODUCT_DESCRIPTOR}, hand-finished and quality-checked, with free shipping over ${formatRupees(FREE_SHIPPING_THRESHOLD)} across India and easy ${RETURN_WINDOW_DAYS}-day returns.`;

  return {
    title,
    description,
    alternates: { canonical: buildShopHref(query) },
    openGraph: {
      type: "website",
      siteName: SITE_CONFIG.brandName,
      locale: "en_IN",
      url: buildShopHref(query),
      title: `${title} · ${SITE_CONFIG.brandName}`,
      description,
      images: [SITE_CONFIG.ogImage],
    },
  };
}

function EmptyResults(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6 border border-line bg-ivory px-6 py-20 text-center">
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
  const categoryLabel = singleCategoryOf(query);

  return (
    <div className="container py-12 lg:py-16">
      <header className="flex flex-col gap-4">
        <SectionHeading
          as="h1"
          align="left"
          roman={categoryLabel === null ? "The" : "Shop"}
          accent={categoryLabel === null ? "Collection" : categoryLabel}
          subtitle={
            categoryLabel === null
              ? "One hundred pieces, anti-tarnish and hand-finished, across eight collections."
              : `Every ${categoryLabel.toLowerCase()} piece in the collection, anti-tarnish and hand-finished.`
          }
        />
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:mt-14 lg:grid-cols-[15rem_1fr] lg:gap-14">
        <aside className="hidden lg:block">
          <h2 className="sr-only">Filters</h2>
          <ShopFilterPanel query={query} />
        </aside>

        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
            <div className="flex items-center gap-4">
              <ShopFilterDrawer query={query} />
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
