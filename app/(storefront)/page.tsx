import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";
import { buildCollectionHref } from "@/lib/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { getFeaturedProducts, getNewArrivals } from "@/lib/products";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CollectionStrip } from "@/components/CollectionStrip";
import { Hero } from "@/components/Hero";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { TrustStrip } from "@/components/TrustStrip";
import { ViewAllLink } from "@/components/ViewAllLink";

const CATEGORY_SECTION_ID = "shop-by-category";

/**
 * How many pieces each home strip shows on a phone. Both strips hold eight, which is four
 * rows of two on a phone and one row of four from `lg` — the same set reads as a browsable
 * row on a laptop and as a scroll on a phone. Half of it, plus the link to the rest, is the
 * amount that still reads as a taste of the collection. See ADR-033.
 */
const MOBILE_PRODUCT_COUNT = 4;

/**
 * `openGraph` is replaced wholesale by a page, never merged into the layout's — so a page
 * that sets it must restate type, siteName, locale and images or silently lose them.
 */
export const metadata: Metadata = {
  title: { absolute: SITE_CONFIG.title },
  description: SITE_CONFIG.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_CONFIG.brandName,
    locale: "en_IN",
    url: "/",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage.url],
  },
};

export default function HomePage(): JSX.Element {
  const newArrivals = getNewArrivals();
  const bestSellers = getFeaturedProducts();

  return (
    <>
      <Hero categoryAnchorId={CATEGORY_SECTION_ID} />

      <section
        id={CATEGORY_SECTION_ID}
        className="scroll-mt-20 bg-white lg:scroll-mt-36"
      >
        <div className="container flex flex-col gap-6 py-10 sm:gap-10 sm:py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            roman="Shop by"
            accent="Category"
            subtitle="Ten categories, each finished in the same workshop and held to the same anti-tarnish standard."
          />
          <CategoryGrid />
          <CollectionStrip />
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col gap-6 py-10 sm:gap-10 sm:py-16 lg:gap-14 lg:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <SectionHeading
              roman="New Arrivals"
              accent="Collection"
              align="left"
              subtitle="The most recent pieces off the bench, before they settle into the main collection."
            />
            <div className="hidden shrink-0 sm:flex">
              <ViewAllLink href={buildCollectionHref("new-arrivals")} />
            </div>
          </div>
          <ProductGrid products={newArrivals} mobileLimit={MOBILE_PRODUCT_COUNT} />
          <div className="sm:hidden">
            <ButtonLink href={buildCollectionHref("new-arrivals")} variant="secondary" fullWidth>
              View all new arrivals
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col gap-6 py-10 sm:gap-10 sm:py-16 lg:gap-14 lg:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <SectionHeading
              roman="Shop"
              accent="Best Sellers"
              align="left"
              subtitle="The pieces we make most often, and the ones we restock first."
            />
            <div className="hidden shrink-0 sm:flex">
              <ViewAllLink href={buildCollectionHref("best-sellers")} />
            </div>
          </div>
          <ProductGrid products={bestSellers} mobileLimit={MOBILE_PRODUCT_COUNT} />
          <div className="sm:hidden">
            <ButtonLink href={buildCollectionHref("best-sellers")} variant="secondary" fullWidth>
              View all best sellers
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="bg-ivory">
        <div className="container flex flex-col gap-6 py-10 sm:gap-10 sm:py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            roman="The Morchadi"
            accent="Promise"
            subtitle="Every order is inspected, insured in transit, and returnable for seven days."
          />
          <TrustStrip />
        </div>
      </section>
    </>
  );
}
