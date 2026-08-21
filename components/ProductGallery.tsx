"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { VariantImages } from "@/types/product";
import { useProductSelection } from "@/lib/product-selection";
import {
  buildGalleryImages,
  galleryIndexOf,
  resolveVariantImage,
  type GalleryImage,
} from "@/lib/variant-images";
import { ProductImagePanel } from "@/components/ProductImagePanel";
import { ArrowRightIcon } from "@/components/icons";

export interface ProductGalleryProps {
  images: string[];
  /** One alt per entry in `images`, in the same order. Built by `getImageAlts`. */
  imageAlts: string[];
  variantImages?: VariantImages;
}

const THUMBNAIL_WINDOW_SIZE = 5;

const arrowClasses =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center border border-line text-muted transition-colors duration-250 hover:border-charcoal hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-line disabled:hover:text-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep";

function clampWindowStart(start: number, total: number): number {
  const lastPossibleStart = Math.max(0, total - THUMBNAIL_WINDOW_SIZE);
  return Math.min(Math.max(start, 0), lastPossibleStart);
}

/**
 * The window the arrows are showing, nudged only as far as it takes to keep `shownIndex`
 * inside it. Called when the shown photograph changes rather than on every render, so paging
 * the strip away from the photograph on screen stays possible — the strip is for browsing,
 * and a window that snapped back each render would make the arrows useless.
 */
function windowStartShowing(start: number, shownIndex: number, total: number): number {
  const withinRange = clampWindowStart(start, total);

  if (shownIndex < withinRange) return shownIndex;
  if (shownIndex >= withinRange + THUMBNAIL_WINDOW_SIZE) {
    return clampWindowStart(shownIndex - THUMBNAIL_WINDOW_SIZE + 1, total);
  }

  return withinRange;
}

/**
 * The product page's picture, for the products that have more than one of them — several
 * views, a per-variant photograph, or both. A product with a single image and no variant
 * mapping never reaches here: the page renders `ProductImagePanel` directly, so the common
 * case still ships no client JavaScript for its image. See ADR-009 and ADR-027.
 *
 * The strip lists every photograph the product has, mapped and unmapped alike, so each one
 * is reachable by clicking it. Clicking a mapped photograph also records its option value,
 * which is what keeps the swatch and the picture from ever disagreeing about which finish is
 * on screen — and a disagreement there is not cosmetic, because the recorded choice is what
 * a cart line carries. See [ADR-050](/docs/decisions/ADR-050-unified-gallery-strip.md),
 * which replaced the earlier arrangement where a choice silently overrode a clicked
 * thumbnail and mapped photographs had no thumbnail of their own.
 *
 * Choosing a value still moves the picture, because the shopper just said which finish they
 * want. What changed is that the reverse also holds.
 *
 * Alt text follows the photograph. A variant image has no alt written for it, so it falls
 * back to the product's main alt rather than describing the wrong finish. See ADR-036.
 */
export function ProductGallery({
  images,
  imageAlts,
  variantImages,
}: ProductGalleryProps): JSX.Element {
  const { selectedOptions, chooseOptionValue } = useProductSelection();
  const gallery = useMemo(
    () => buildGalleryImages(images, variantImages),
    [images, variantImages],
  );
  const variantImage = resolveVariantImage(variantImages, selectedOptions);

  const [shownVariantImage, setShownVariantImage] = useState<string | null>(variantImage);
  const [shownImage, setShownImage] = useState<string>(variantImage ?? images[0]);
  const [windowStart, setWindowStart] = useState(() =>
    windowStartShowing(
      0,
      galleryIndexOf(gallery, variantImage ?? images[0]),
      gallery.length,
    ),
  );
  const thumbnailRefs = useRef(new Map<string, HTMLButtonElement>());
  const imageAwaitingFocus = useRef<string | null>(null);

  if (shownVariantImage !== variantImage) {
    const nextImage = variantImage ?? images[0];
    setShownVariantImage(variantImage);
    setShownImage(nextImage);
    setWindowStart(
      windowStartShowing(
        windowStart,
        galleryIndexOf(gallery, nextImage),
        gallery.length,
      ),
    );
  }

  const shownIndex = galleryIndexOf(gallery, shownImage);
  const visibleStart = clampWindowStart(windowStart, gallery.length);
  const hasWindowNavigation = gallery.length > THUMBNAIL_WINDOW_SIZE;
  const visibleThumbnails = hasWindowNavigation
    ? gallery.slice(visibleStart, visibleStart + THUMBNAIL_WINDOW_SIZE)
    : gallery;

  const showImage = useCallback(
    (entry: GalleryImage): void => {
      setShownImage(entry.src);
      if (entry.variant !== null) {
        chooseOptionValue(entry.variant.optionName, entry.variant.value);
      }
    },
    [chooseOptionValue],
  );

  const showImageAtIndex = useCallback(
    (index: number): void => {
      const entry = gallery[index];
      if (entry === undefined) return;
      imageAwaitingFocus.current = entry.src;
      setWindowStart((current) => windowStartShowing(current, index, gallery.length));
      showImage(entry);
    },
    [gallery, showImage],
  );

  useEffect(() => {
    const pending = imageAwaitingFocus.current;
    if (pending === null) return;
    imageAwaitingFocus.current = null;
    thumbnailRefs.current.get(pending)?.focus();
  }, [shownImage]);

  const handleStripKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showImageAtIndex(event.key === "ArrowRight" ? shownIndex + 1 : shownIndex - 1);
  };

  const mainImageIndex = images.indexOf(shownImage);
  const mainImageAlt = mainImageIndex === -1 ? imageAlts[0] : imageAlts[mainImageIndex];

  return (
    <div className="flex flex-col gap-4">
      <ProductImagePanel src={shownImage} alt={mainImageAlt} priority />

      {gallery.length > 1 ? (
        <div className="flex items-center gap-3">
          {hasWindowNavigation ? (
            <button
              type="button"
              onClick={() =>
                setWindowStart(visibleStart - THUMBNAIL_WINDOW_SIZE)
              }
              disabled={visibleStart === 0}
              aria-label="Show earlier thumbnails"
              className={arrowClasses}
            >
              <ArrowRightIcon className="h-4 w-4 rotate-180" />
            </button>
          ) : null}

          <ul
            onKeyDown={handleStripKeyDown}
            className="grid flex-1 grid-cols-5 gap-3"
          >
            {visibleThumbnails.map((entry) => {
              const position = galleryIndexOf(gallery, entry.src) + 1;
              const label =
                entry.variant === null
                  ? `Show image ${position} of ${gallery.length}`
                  : `Show image ${position} of ${gallery.length}, ${entry.variant.optionName} ${entry.variant.value}`;

              return (
                <li key={entry.src}>
                  <button
                    type="button"
                    ref={(node) => {
                      if (node === null) thumbnailRefs.current.delete(entry.src);
                      else thumbnailRefs.current.set(entry.src, node);
                    }}
                    onClick={() => showImage(entry)}
                    aria-label={label}
                    aria-current={entry.src === shownImage}
                    className={`relative block aspect-square w-full overflow-hidden border bg-ivory transition-colors duration-250 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep ${
                      entry.src === shownImage
                        ? "border-charcoal"
                        : "border-line hover:border-muted"
                    }`}
                  >
                    <Image
                      src={entry.src}
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

          {hasWindowNavigation ? (
            <button
              type="button"
              onClick={() =>
                setWindowStart(visibleStart + THUMBNAIL_WINDOW_SIZE)
              }
              disabled={visibleStart >= gallery.length - THUMBNAIL_WINDOW_SIZE}
              aria-label="Show later thumbnails"
              className={arrowClasses}
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
