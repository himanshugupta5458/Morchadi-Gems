import Image from "next/image";
import Link from "next/link";
import type { ProductCardView } from "@/types/product";
import {
  getPrimaryImage,
  getSecondaryImage,
  toCatalogueEntry,
} from "@/lib/product-view";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductBadgeTag } from "@/components/ProductBadgeTag";
import { ProductCardPurchase } from "@/components/ProductCardPurchase";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";

/**
 * Two lines of `text-body-sm` at its 22px line height, reserved whether the name needs them
 * or not. A one-line name and a two-line name therefore push the price and the button to the
 * same offset, so a row of cards shares one baseline. Names longer than two lines are clamped
 * rather than allowed to reflow the row.
 */
const NAME_HEIGHT_CLASSES = "line-clamp-2 min-h-[2.75rem]";

export interface ProductCardProps {
  /**
   * `ProductCardView`, not `Product`. A whole record carries `pricing.cost` and, on migrated
   * pieces, another shop's identifiers; the shop listing and the home page still hand one in
   * and lose nothing by it, because they render on the server. The cross-sell rails render in
   * the browser and hand in the narrowed shape instead — see `ProductCardView`.
   */
  product: ProductCardView;
  priority?: boolean;
}

/**
 * A Server Component wherever a Server Component renders it — which is the shop listing, the
 * home page and the product page. The cross-sell rails render it inside a Client Component
 * instead, so this module is compiled into a browser bundle as well, and that is why it takes
 * `ProductCardView` and imports its projections from `lib/product-view.ts` rather than from
 * `lib/products.ts`: the latter carries `data/products.json` with it.
 *
 * A product with a **second** photograph reveals it on hover, and on a phone when the card's
 * link takes focus. One with a single photograph — 436 of the 449 records — gets no second
 * image element at all, so there is nothing to fade to and no placeholder flashes. The swap is
 * two stacked `next/image` fills crossfading in CSS, which keeps the card a Server Component.
 *
 * **Everything below the photograph is height-reserved**: the name block, the option row and
 * the action. A grid row holds cards with no options beside cards showing chips beside cards
 * whose button carries a two-line label, and each of those reserves the same space as the
 * others so the row keeps one baseline in every combination. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
export function ProductCard({
  product,
  priority = false,
}: ProductCardProps): JSX.Element {
  const primaryImage = getPrimaryImage(product);
  const hoverImage = getSecondaryImage(product);

  return (
    <article className="group relative flex h-full flex-col border border-line bg-white transition duration-250 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-ivory sm:aspect-square">
        {primaryImage === null ? (
          <ProductImagePlaceholder />
        ) : (
          <>
            <Image
              src={primaryImage}
              alt={product.seo.imageAlt}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={`object-contain p-4 transition-all duration-250 group-hover:scale-[1.03] ${
                hoverImage === null
                  ? ""
                  : "group-hover:opacity-0 group-focus-within:opacity-0"
              }`}
            />
            {hoverImage === null ? null : (
              <Image
                src={hoverImage}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-contain p-4 opacity-0 transition-opacity duration-250 group-hover:opacity-100 group-focus-within:opacity-100"
              />
            )}
          </>
        )}

        <div className="absolute left-3 top-3">
          <ProductBadgeTag stock={product.stock} flags={product.flags} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <Link
          href={`/product/${product.id}`}
          className={`${NAME_HEIGHT_CLASSES} text-body-sm text-muted transition-colors duration-250 after:absolute after:inset-0 after:content-[''] hover:text-ink`}
        >
          {product.name}
        </Link>

        <PriceDisplay mrp={product.pricing.mrp} price={product.pricing.price} />

        <div className="relative z-10 mt-auto pt-1">
          <ProductCardPurchase item={toCatalogueEntry(product)} />
        </div>
      </div>
    </article>
  );
}
