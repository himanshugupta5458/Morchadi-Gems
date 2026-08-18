import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import { getPrimaryImage, toCatalogueEntry } from "@/lib/products";
import { AddToCartButton } from "@/components/AddToCartButton";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { StarRating } from "@/components/StarRating";

/**
 * Two lines of `text-body-sm` at its 22px line height, reserved whether the name needs them
 * or not. A one-line name and a two-line name therefore push the rating, the price and the
 * button to the same offset, so a row of cards shares one baseline. Names longer than two
 * lines are clamped rather than allowed to reflow the row.
 */
const NAME_HEIGHT_CLASSES = "line-clamp-2 min-h-[2.75rem]";

export interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

/**
 * A Server Component. The only thing it ships to the browser is `AddToCartButton`, and that
 * receives the lean `CatalogueEntry` rather than the whole product record.
 */
export function ProductCard({
  product,
  priority = false,
}: ProductCardProps): JSX.Element {
  const primaryImage = getPrimaryImage(product);

  return (
    <article className="group relative flex h-full flex-col border border-line bg-white transition duration-250 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative aspect-square w-full overflow-hidden bg-ivory">
        {primaryImage === null ? (
          <ProductImagePlaceholder />
        ) : (
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-4 transition-transform duration-250 group-hover:scale-[1.03]"
          />
        )}

        {product.flags.isNew && product.stock.inStock ? (
          <span className="absolute left-3 top-3 bg-white px-2.5 py-1 text-eyebrow uppercase text-maroon ring-1 ring-line">
            New
          </span>
        ) : null}

        {product.stock.inStock ? null : (
          <span className="absolute left-3 top-3 bg-charcoal px-2.5 py-1 text-eyebrow uppercase text-ivory">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link
          href={`/product/${product.id}`}
          className={`${NAME_HEIGHT_CLASSES} text-body-sm text-muted transition-colors duration-250 after:absolute after:inset-0 after:content-[''] hover:text-ink`}
        >
          {product.name}
        </Link>

        <StarRating value={product.rating.average} count={product.rating.count} />

        <PriceDisplay mrp={product.pricing.mrp} price={product.pricing.price} />

        <div className="relative z-10 mt-auto pt-1">
          <AddToCartButton item={toCatalogueEntry(product)} fullWidth />
        </div>
      </div>
    </article>
  );
}
