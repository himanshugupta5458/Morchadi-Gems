import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryLabel } from "@/types/product";
import { describeProductCodAvailability } from "@/lib/cod";
import { SITE_CONFIG } from "@/lib/config";
import { splitDescriptionForPreview } from "@/lib/product-description";
import { buildProductOpenGraphTypeMeta } from "@/lib/metadata";
import {
  getAllProducts,
  getDescriptionParagraphs,
  getImageAlts,
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
import { ProductBadgeTag } from "@/components/ProductBadgeTag";
import { ProductDescription } from "@/components/ProductDescription";
import { ProductDetailsList } from "@/components/ProductDetailsList";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductImageZoom } from "@/components/ProductImageZoom";
import { ProductPurchaseActions } from "@/components/ProductPurchaseActions";
import { ProductShareButton } from "@/components/ProductShareButton";
import { SectionHeading } from "@/components/SectionHeading";
import { TrustStripCompact } from "@/components/TrustStrip";

interface ProductPageProps {
  params: { id: string };
}

const RELATED_PRODUCT_COUNT = 4;

/**
 * The dimensions a share card is declared at. The product photographs are square rather than
 * 1.91:1, so this is what the card is rendered *into* rather than the file's own size, and
 * the crop is the unfurler's to make. Stated because a card with no declared size is the one
 * WhatsApp is most likely to drop, and its preview cache makes a first miss expensive. See
 * ADR-036.
 */
const OPEN_GRAPH_IMAGE_WIDTH = 1200;
const OPEN_GRAPH_IMAGE_HEIGHT = 630;

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
  const { seo } = product;
  const openGraphImage = {
    url: seo.ogImage,
    width: OPEN_GRAPH_IMAGE_WIDTH,
    height: OPEN_GRAPH_IMAGE_HEIGHT,
    alt: seo.imageAlt,
  };

  return {
    /**
     * Absolute so the layout's `%s · Morchadi Gems` template does not append a second brand
     * to a title that was already sized against the pixel budget a search result renders.
     * `seo.metaTitle` is the whole title, brand included where it earned the space.
     */
    title: { absolute: seo.metaTitle },
    description: seo.metaDescription,
    alternates: { canonical },
    other: buildProductOpenGraphTypeMeta(),
    openGraph: {
      siteName: SITE_CONFIG.brandName,
      locale: "en_IN",
      url: canonical,
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: [openGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.ogTitle,
      description: seo.ogDescription,
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
  const description = splitDescriptionForPreview(
    getDescriptionParagraphs(product.description),
  );
  const imageAlts = getImageAlts(product);

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
              imageAlts={imageAlts}
              variantImages={product.media.variantImages}
            />
          ) : (
            <ProductImageZoom src={primaryImage} alt={product.seo.imageAlt} priority />
          )}

          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-eyebrow uppercase text-gold-deep">
                {categoryLabel}
              </span>
              {/**
               * The same cascade the card runs, with the same component. A page that computed
               * "Only 2 left" for itself would be a second implementation of a rule whose whole
               * point is that availability outranks merchandising everywhere. See ADR-067.
               */}
              <ProductBadgeTag stock={product.stock} flags={product.flags} />
            </div>

            <h1 className="font-display text-heading-sm sm:text-heading-lg">
              {product.name}
            </h1>

            <div className="flex flex-col gap-1.5">
              <PriceDisplay
                mrp={product.pricing.mrp}
                price={product.pricing.price}
                size="lg"
              />
              <p className="text-body-sm text-muted">
                Inclusive of all taxes ·{" "}
                {describeProductCodAvailability(product.pricing.minPrepaidAmount)}
              </p>
            </div>

            <ProductDescription description={description} />

            <div className="border-t border-line pt-5 sm:pt-6">
              <ProductPurchaseActions item={toCatalogueEntry(product)} />
            </div>

            <div className="flex flex-col gap-4 border-t border-line pt-5 sm:pt-6">
              <TrustStripCompact />
              <ProductShareButton title={product.name} />
            </div>

            <ProductDetailsList specs={product.specs} />
          </div>
        </div>
      </ProductSelectionProvider>

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
