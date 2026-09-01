import type { Metadata } from "next";
import { HOME_CATEGORIES } from "@/types/product";
import { SITE_CONFIG } from "@/lib/config";
import {
  HOME_MOBILE_PRODUCT_COUNT,
  HOME_NEW_ARRIVALS_COUNT,
  HOME_STANDARD_SECTION_PADDING,
  HOME_TIGHT_SECTION_PADDING,
} from "@/lib/home-page";
import { buildCollectionHref } from "@/lib/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { getFeaturedProducts, getNewArrivals } from "@/lib/products";
import { getSocialProof } from "@/lib/social-proof";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CollectionStrip } from "@/components/CollectionStrip";
import { Hero } from "@/components/Hero";
import { OrderTrackingForm } from "@/components/OrderTrackingForm";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { SocialProofSection } from "@/components/SocialProofSection";
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
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage.url],
  },
};

export default function HomePage(): JSX.Element {
  const newArrivals = getNewArrivals(HOME_NEW_ARRIVALS_COUNT);
  const bestSellers = getFeaturedProducts();
  const socialProof = getSocialProof();

  return (
    <>
      <Hero categoryAnchorId={CATEGORY_SECTION_ID} />

      <section
        id={CATEGORY_SECTION_ID}
        className="scroll-mt-32 bg-white lg:scroll-mt-36"
      >
        <div className={`container flex flex-col gap-6 sm:gap-10 lg:gap-14 ${HOME_STANDARD_SECTION_PADDING}`}>
          <SectionHeading
            roman="Shop by"
            accent="Category"
            subtitle={`${HOME_CATEGORIES.length} categories, each finished in the same workshop and held to the same standard.`}
          />
          <CategoryGrid />
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className={`container flex flex-col gap-6 sm:gap-8 lg:gap-10 ${HOME_TIGHT_SECTION_PADDING}`}>
          <SectionHeading
            roman="Shop by"
            accent="Collection"
            subtitle="Four ways to cut across the categories, each one showing a piece it actually holds."
          />
          <CollectionStrip />
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className={`container flex flex-col gap-6 sm:gap-10 lg:gap-14 ${HOME_STANDARD_SECTION_PADDING}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <SectionHeading
              roman="New Arrivals"
              accent="Collection"
              align="left"
              subtitle="The most recent pieces off the bench, before they settle into the main collection."
            />
            <div className="hidden shrink-0 sm:flex">
              <ViewAllLink href={buildCollectionHref("new-arrivals")} label="See all" />
            </div>
          </div>
          <ProductGrid products={newArrivals} mobileLimit={HOME_MOBILE_PRODUCT_COUNT} />
          <div className="sm:hidden">
            <ButtonLink href={buildCollectionHref("new-arrivals")} variant="secondary" fullWidth>
              View all new arrivals
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className={`container flex flex-col gap-6 sm:gap-10 lg:gap-14 ${HOME_STANDARD_SECTION_PADDING}`}>
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
          <ProductGrid products={bestSellers} mobileLimit={HOME_MOBILE_PRODUCT_COUNT} />
          <div className="sm:hidden">
            <ButtonLink href={buildCollectionHref("best-sellers")} variant="secondary" fullWidth>
              View all best sellers
            </ButtonLink>
          </div>
        </div>
      </section>

      <SocialProofSection entries={socialProof} />

      <section className="bg-ivory">
        <div className={`container flex flex-col gap-6 sm:gap-8 lg:gap-10 ${HOME_TIGHT_SECTION_PADDING}`}>
          <SectionHeading
            roman={`The ${SITE_CONFIG.brandNameLead}`}
            accent="Promise"
            subtitle="Every order is inspected, insured in transit, and returnable for seven days."
          />
          <TrustStrip />
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col items-center gap-6 py-10 sm:gap-10 sm:py-16 lg:gap-12 lg:py-20">
          <SectionHeading
            roman="Already"
            accent="Ordered?"
            subtitle="Enter the ten-character order number from your confirmation and we will tell you where your parcel has got to. No account, no password."
          />
          <div className="w-full max-w-xl">
            <OrderTrackingForm submittedOrderId="" />
          </div>
        </div>
      </section>
    </>
  );
}
