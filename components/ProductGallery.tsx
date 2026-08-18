"use client";

import Image from "next/image";
import { useState } from "react";
import type { VariantImages } from "@/types/product";
import { useProductSelection } from "@/lib/product-selection";
import { resolveVariantImage } from "@/lib/variant-images";
import { ProductImagePanel } from "@/components/ProductImagePanel";

export interface ProductGalleryProps {
  images: string[];
  variantImages?: VariantImages;
  productName: string;
}

/**
 * The product page's picture, for the products that have more than one of them — several
 * views, a per-variant photograph, or both. A product with a single image and no variant
 * mapping never reaches here: the page renders `ProductImagePanel` directly, so the common
 * case still ships no client JavaScript for its image. See ADR-009 and ADR-027.
 *
 * Two things can change the main image and they are deliberately ranked. Choosing an option
 * wins, because the shopper just said which finish they want and showing them the other one
 * would be a lie; clicking a thumbnail wins after that, until the next option change. That is
 * what `manualImage` records, and why it is cleared the moment the variant photograph
 * changes underneath it.
 *
 * The thumbnail strip lists `images` and only `images`. A variant photograph is not a view of
 * the piece to browse between, it is what the current choice looks like, so it is reached by
 * making the choice.
 */
export function ProductGallery({
  images,
  variantImages,
  productName,
}: ProductGalleryProps): JSX.Element {
  const { selectedOptions } = useProductSelection();
  const variantImage = resolveVariantImage(variantImages, selectedOptions);

  const [manualImage, setManualImage] = useState<string | null>(null);
  const [shownVariantImage, setShownVariantImage] = useState<string | null>(variantImage);

  if (shownVariantImage !== variantImage) {
    setShownVariantImage(variantImage);
    setManualImage(null);
  }

  const mainImage = manualImage ?? variantImage ?? images[0];

  return (
    <div className="flex flex-col gap-4">
      <ProductImagePanel src={mainImage} alt={productName} priority />

      {images.length > 1 ? (
        <ul className="grid grid-cols-5 gap-3">
          {images.map((image, index) => {
            const isActive = image === mainImage;

            return (
              <li key={image}>
                <button
                  type="button"
                  onClick={() => setManualImage(image)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-current={isActive}
                  className={`relative block aspect-square w-full overflow-hidden border bg-ivory transition-colors duration-250 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep ${
                    isActive ? "border-charcoal" : "border-line hover:border-muted"
                  }`}
                >
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="12vw"
                    className="object-contain p-2"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
