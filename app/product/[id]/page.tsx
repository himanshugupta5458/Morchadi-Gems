import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryLabel } from "@/types/product";
import { SITE_CONFIG } from "@/lib/config";
import {
  getAllProducts,
  getProductById,
  getRelatedProducts,
  toCatalogueEntry,
} from "@/lib/products";
import { buildCategoryHref } from "@/lib/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductDetailsList } from "@/components/ProductDetailsList";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductImagePanel } from "@/components/ProductImagePanel";
import { ProductPurchaseActions } from "@/components/ProductPurchaseActions";
import { ProductReviews } from "@/components/ProductReviews";
import { SectionHeading } from "@/components/SectionHeading";
import { StarRating } from "@/components/StarRating";

interface ProductPageProps {
  params: { id: string };
}

const REVIEWS_ANCHOR_ID = "reviews";
const RELATED_PRODUCT_COUNT = 4;

/** The catalogue is fixed and ships as code, so every product prerenders. */
export function generateStaticParams(): { id: string }[] {
  return getAllProducts().map((product) => ({ id: product.id }));
}

/** Anything not in `generateStaticParams` is a 404 rather than an on-demand render. */
export const dynamicParams = false;

export function generateMetadata({ params }: ProductPageProps): Metadata {
  const product = getProductById(params.id);

  if (product === undefined) {
    return { title: "Product not found", robots: { index: false, follow: true } };
  }

  const canonical = `/product/${product.id}`;
  const openGraphImage =
    product.images.length > 0
      ? { url: product.images[0], width: 1000, height: 1000, alt: product.name }
      : SITE_CONFIG.ogImage;

  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_CONFIG.brandName,
      locale: "en_IN",
      url: canonical,
      title: `${product.name} · ${SITE_CONFIG.brandName}`,
      description: product.shortDescription,
      images: [openGraphImage],
    },
  };
}

export default function ProductPage({ params }: ProductPageProps): JSX.Element {
  const product = getProductById(params.id);
  if (product === undefined) notFound();

  const categoryLabel = getCategoryLabel(product.category);
  const relatedProducts = getRelatedProducts(product, RELATED_PRODUCT_COUNT);
  const primaryImage = product.images.length > 0 ? product.images[0] : null;

  return (
    <div className="container py-8 lg:py-12">
      <Breadcrumb
        trail={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: categoryLabel, href: buildCategoryHref(product.category) },
          { label: product.name },
        ]}
      />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:mt-12 lg:grid-cols-2 lg:gap-16">
        {product.images.length > 1 ? (
          <ProductGallery images={product.images} productName={product.name} />
        ) : (
          <ProductImagePanel src={primaryImage} alt={product.name} priority />
        )}

        <div className="flex flex-col gap-6">
          <span className="text-eyebrow uppercase text-gold-deep">
            {categoryLabel}
          </span>

          <h1 className="font-display text-heading sm:text-heading-lg">
            {product.name}
          </h1>

          <a
            href={`#${REVIEWS_ANCHOR_ID}`}
            className="inline-flex w-fit items-center gap-2 text-body-sm text-muted transition-colors duration-250 hover:text-ink"
          >
            <StarRating value={product.rating} />
            <span>{product.reviewCount} reviews</span>
          </a>

          <PriceDisplay mrp={product.mrp} price={product.price} size="lg" />

          <p className="max-w-prose text-body text-muted">
            {product.shortDescription}
          </p>

          <div className="border-t border-line pt-6">
            <ProductPurchaseActions item={toCatalogueEntry(product)} />
          </div>
        </div>
      </div>

      <section className="mt-16 border-t border-line pt-12 lg:mt-24 lg:pt-16">
        <div className="flex flex-col gap-8">
          <SectionHeading as="h2" roman="The" accent="Details" align="left" />
          <ProductDetailsList details={product.details} />
        </div>
      </section>

      <section
        id={REVIEWS_ANCHOR_ID}
        className="mt-16 scroll-mt-24 border-t border-line pt-12 lg:mt-24 lg:scroll-mt-32 lg:pt-16"
      >
        <div className="flex flex-col gap-8">
          <SectionHeading as="h2" roman="Customer" accent="Reviews" align="left" />
          <ProductReviews
            reviews={product.reviews}
            rating={product.rating}
            reviewCount={product.reviewCount}
          />
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="mt-16 border-t border-line pt-12 lg:mt-24 lg:pt-16">
          <div className="flex flex-col gap-10">
            <SectionHeading as="h2" roman="You May Also" accent="Like" align="left" />
            <ProductGrid products={relatedProducts} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
