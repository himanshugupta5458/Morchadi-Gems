import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";
import { buildCollectionHref } from "@/lib/navigation";
import { getFeaturedProducts, getNewArrivals } from "@/lib/products";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CollectionStrip } from "@/components/CollectionStrip";
import { Hero } from "@/components/Hero";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { TestimonialBand } from "@/components/TestimonialBand";
import { TrustStrip } from "@/components/TrustStrip";
import { ViewAllLink } from "@/components/ViewAllLink";

const CATEGORY_SECTION_ID = "shop-by-category";

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
};

export default function HomePage(): JSX.Element {
  const newArrivals = getNewArrivals();
  const bestSellers = getFeaturedProducts();

  return (
    <>
      <Hero categoryAnchorId={CATEGORY_SECTION_ID} />

      <section
        id={CATEGORY_SECTION_ID}
        className="scroll-mt-20 bg-white lg:scroll-mt-32"
      >
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
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
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <SectionHeading
              roman="New Arrivals"
              accent="Collection"
              align="left"
              subtitle="The most recent pieces off the bench, before they settle into the main collection."
            />
            <ViewAllLink href={buildCollectionHref("new-arrivals")} />
          </div>
          <ProductGrid products={newArrivals} />
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <SectionHeading
              roman="Shop"
              accent="Best Sellers"
              align="left"
              subtitle="The pieces our customers keep coming back for, rated highest across the store."
            />
            <ViewAllLink href={buildCollectionHref("best-sellers")} />
          </div>
          <ProductGrid products={bestSellers} />
        </div>
      </section>

      <section className="bg-ivory">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            roman="The Morchadi"
            accent="Promise"
            subtitle="Every order is inspected, insured in transit, and returnable for seven days."
          />
          <TrustStrip />
        </div>
      </section>

      <TestimonialBand />
    </>
  );
}
