import Image from "next/image";
import Link from "next/link";
import type { ProductCardView } from "@/types/product";
import {
  getPrimaryImage,
  getSecondaryImage,
  toCatalogueEntry,
} from "@/lib/product-view";
import { describeOptionGroups } from "@/lib/card-purchase";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductBadgeTag } from "@/components/ProductBadgeTag";
import { ProductCardPurchase } from "@/components/ProductCardPurchase";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";

/**
 * One line, truncated, with the whole name kept in the DOM and in the `title`.
 *
 * It was two lines with the second reserved whether it was needed or not, which is what kept a
 * grid row on one baseline while the space below the name varied. Nothing below it varies any
 * more — every card carries the same price row and the same 40px button — so the reserved
 * second line was 22px of blank space on most cards, bought to solve a problem that no longer
 * exists. Truncating rather than wrapping is what keeps the guarantee: a name cannot reflow a
 * row it cannot reach a second line of.
 */
const NAME_CLASSES = "truncate";

/**
 * The one line the options tag occupies, reserved on every card whether or not the product has
 * anything to tag.
 *
 * It is exactly the line box `text-eyebrow` brings, and it is the last reserved slot on the card.
 * ADR-067's two boxes together came to 76px and existed because a card's *controls* varied; this
 * one is 16px and exists because a card's *label* does.
 *
 * **What the measurement actually found is worth stating, because it is not what was assumed.**
 * Cards within one row are the same height with or without this slot: `ProductGrid` stretches
 * its grid items and `mt-auto` bottom-aligns the action, so the row is level either way. What
 * the slot buys is *row-to-row* uniformity — removing it makes a row with no tagged card in it
 * 24px shorter than a row with one, so the listing's rhythm would depend on which products
 * happened to land in which row, and change with the sort order. The numbers are in
 * `docs/testing/PLAN-universal-add-to-cart-modal.md`. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
const OPTIONS_TAG_HEIGHT_CLASSES = "flex h-4 items-center";

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
 * **Every card below the photograph is the same card.** A single-line name, a price row, and a
 * 40px button — no option row, no second button label, nothing whose presence depends on what
 * the product carries. Where [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md) kept
 * a row aligned by reserving space for its chips and its two-line button label, one 16px line
 * is left: a product with options says so in a muted tag under the price, and asks its question
 * in a modal rather than on the card. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function ProductCard({
  product,
  priority = false,
}: ProductCardProps): JSX.Element {
  const primaryImage = getPrimaryImage(product);
  const hoverImage = getSecondaryImage(product);
  const optionsTag = describeOptionGroups(product.options);

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

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          href={`/product/${product.id}`}
          title={product.name}
          className={`${NAME_CLASSES} text-body-sm text-muted transition-colors duration-250 after:absolute after:inset-0 after:content-[''] hover:text-ink`}
        >
          {product.name}
        </Link>

        <PriceDisplay mrp={product.pricing.mrp} price={product.pricing.price} />

        <div className={OPTIONS_TAG_HEIGHT_CLASSES}>
          {optionsTag === null ? null : (
            <span className="truncate text-eyebrow uppercase tracking-caps text-muted">
              {optionsTag}
            </span>
          )}
        </div>

        <div className="relative z-10 mt-auto">
          <ProductCardPurchase item={toCatalogueEntry(product)} />
        </div>
      </div>
    </article>
  );
}
