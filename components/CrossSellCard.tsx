"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProductCardView } from "@/types/product";
import { useAddToCartFlow } from "@/lib/add-to-cart-flow";
import { formatRupees } from "@/lib/format";
import { getPrimaryImage, toCatalogueEntry } from "@/lib/product-view";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { CheckIcon, PlusIcon } from "@/components/icons";

export interface CrossSellCardProps {
  product: ProductCardView;
}

const THUMBNAIL_PIXELS = 68;

/**
 * One suggestion in a cross-sell rail: a tightly cropped thumbnail, a name, a price, and a `+`.
 *
 * Horizontal rather than a scaled-down `ProductCard`, and that is the decision worth stating. A
 * rail on the cart and the confirmation screen is not a shelf to browse; it is four lines of
 * "and this". The vertical card gave each suggestion a 200px photograph, a discount badge and a
 * full-width button, which is a shop page rendered under a basket — three of the four
 * suggestions were below the fold on a phone and the row competed with the checkout button it
 * sits above.
 *
 * **The price is plain here.** The strikethrough and the "40% off" chip belong on a shelf where
 * a shopper is comparing pieces; beside a basket they are a second sale being pitched during
 * the first. The number is the same number `ProductCard` shows.
 *
 * The thumbnail is `object-cover`, not `object-contain`. A catalogue photograph is a piece on a
 * lot of white, and at 68px the contained version is a speck in an empty square.
 *
 * The `+` is the only action, on every card, whatever the product carries: it adds outright
 * when there is nothing to ask and opens `AddToCartModal` when there is. There is no
 * "Choose Your Options" path here and there is not meant to be — see
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function CrossSellCard({ product }: CrossSellCardProps): JSX.Element {
  const item = toCatalogueEntry(product);
  const { isJustAdded, requestAdd, modal } = useAddToCartFlow(item);
  const image = getPrimaryImage(product);
  const href = `/product/${product.id}`;

  return (
    <div className="flex items-center gap-3 border border-line bg-white p-2">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden border border-line bg-ivory"
      >
        {image === null ? (
          <ProductImagePlaceholder />
        ) : (
          <Image
            src={image}
            alt=""
            fill
            sizes={`${THUMBNAIL_PIXELS}px`}
            className="object-cover"
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={href}
          title={product.name}
          className="truncate text-body-sm text-ink transition-colors duration-250 hover:text-gold-deep"
        >
          {product.name}
        </Link>
        <span className="font-sans text-body-sm font-medium text-ink">
          {formatRupees(product.pricing.price)}
        </span>
      </div>

      <button
        type="button"
        onClick={requestAdd}
        aria-label={`Add ${product.name} to cart`}
        className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center border border-charcoal bg-white text-charcoal transition-colors duration-250 hover:bg-charcoal hover:text-ivory"
      >
        {isJustAdded ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : (
          <PlusIcon className="h-3.5 w-3.5" />
        )}
      </button>

      {modal}
    </div>
  );
}
