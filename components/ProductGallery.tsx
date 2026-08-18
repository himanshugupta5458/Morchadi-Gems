"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImagePanel } from "@/components/ProductImagePanel";

export interface ProductGalleryProps {
  images: string[];
  productName: string;
}

/**
 * Only rendered when a product carries more than one image. Every product currently has
 * exactly one, so the page renders `ProductImagePanel` directly and this path stays
 * dormant — which keeps the common case free of client JavaScript. See ADR-009.
 */
export function ProductGallery({
  images,
  productName,
}: ProductGalleryProps): JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <ProductImagePanel src={images[activeIndex]} alt={productName} priority />

      <ul className="grid grid-cols-5 gap-3">
        {images.map((image, index) => (
          <li key={image}>
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={index === activeIndex}
              className={`relative block aspect-square w-full overflow-hidden border bg-ivory transition-colors duration-250 ${
                index === activeIndex
                  ? "border-charcoal"
                  : "border-line hover:border-muted"
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
        ))}
      </ul>
    </div>
  );
}
