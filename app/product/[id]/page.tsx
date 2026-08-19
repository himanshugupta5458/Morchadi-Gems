import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryLabel } from "@/types/product";
import { SITE_CONFIG } from "@/lib/config";
import {
  getAllProducts,
  getPrimaryImage,
  getProductById,
  getRelatedProducts,
  toCatalogueEntry,
} from "@/lib/products";
import { ProductSelectionProvider } from "@/lib/product-selection";
import { buildProductBreadcrumb } from "@/lib/breadcrumbs";
import { buildProductSchemaGraph } from "@/lib/structured-data";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
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
  const primaryImage = getPrimaryImage(product);
  const openGraphImage =
    primaryImage === null
      ? SITE_CONFIG.ogImage
      : { url: primaryImage, width: 1000, height: 1000, alt: product.name };

  return {
    title: product.name,
    description: product.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_CONFIG.brandName,
      locale: "en_IN",
      url: canonical,
      title: `${product.name} · ${SITE_CONFIG.brandName}`,
      description: product.description,
      images: [openGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · ${SITE_CONFIG.brandName}`,
      description: product.description,
      images: [openGraphImage.url],
    },
  };
}

export default function ProductPage({ params }: ProductPageProps): JSX.Element {
  const product = getProductById(params.id);
  if (product === undefined) notFound();

  const categoryLabel = getCategoryLabel(product.category);
  const relatedProducts = getRelatedProducts(product, RELATED_PRODUCT_COUNT);
  const primaryImage = getPrimaryImage(product);
  const hasGallery =
    product.media.images.length > 1 || product.media.variantImages !== undefined;
  const breadcrumbTrail = buildProductBreadcrumb(product);

  return (
    <div className="container py-6 sm:py-8 lg:py-12">
      <JsonLd
        id={`product-schema-${product.id}`}
        graph={buildProductSchemaGraph(product, breadcrumbTrail)}
      />

      <Breadcrumb trail={breadcrumbTrail} />

      <ProductSelectionProvider options={product.options}>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 sm:gap-10 lg:mt-12 lg:grid-cols-2 lg:gap-16">
          {hasGallery ? (
            <ProductGallery
              images={product.media.images}
              variantImages={product.media.variantImages}
              productName={product.name}
            />
          ) : (
            <ProductImagePanel src={primaryImage} alt={product.name} priority />
          )}

          <div className="flex flex-col gap-4 sm:gap-6">
            <span className="text-eyebrow uppercase text-gold-deep">
              {categoryLabel}
            </span>

            <h1 className="font-display text-heading-sm sm:text-heading-lg">
              {product.name}
            </h1>

            <a
              href={`#${REVIEWS_ANCHOR_ID}`}
              className="inline-flex w-fit items-center gap-2 text-body-sm text-muted transition-colors duration-250 hover:text-ink"
            >
              <StarRating value={product.rating.average} />
              <span>{product.rating.count} reviews</span>
            </a>

            <PriceDisplay
              mrp={product.pricing.mrp}
              price={product.pricing.price}
              size="lg"
            />

            <p className="max-w-prose text-body text-muted">{product.description}</p>

            <div className="border-t border-line pt-5 sm:pt-6">
              <ProductPurchaseActions item={toCatalogueEntry(product)} />
            </div>

            <ProductDetailsList specs={product.specs} />
          </div>
        </div>
      </ProductSelectionProvider>

      <section
        id={REVIEWS_ANCHOR_ID}
        className="mt-10 scroll-mt-24 border-t border-line pt-8 sm:mt-16 sm:pt-12 lg:mt-24 lg:scroll-mt-36 lg:pt-16"
      >
        <div className="flex flex-col gap-6 sm:gap-8">
          <SectionHeading as="h2" roman="Customer" accent="Reviews" align="left" />
          <ProductReviews
            reviews={product.reviews}
            rating={product.rating.average}
            reviewCount={product.rating.count}
          />
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="mt-10 border-t border-line pt-8 sm:mt-16 sm:pt-12 lg:mt-24 lg:pt-16">
          <div className="flex flex-col gap-6 sm:gap-10">
            <SectionHeading as="h2" roman="You May Also" accent="Like" align="left" />
            <ProductGrid products={relatedProducts} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
