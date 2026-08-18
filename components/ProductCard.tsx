import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import { toCatalogueEntry } from "@/lib/products";
import { AddToCartButton } from "@/components/AddToCartButton";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { StarRating } from "@/components/StarRating";

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
  const primaryImage = product.images.length > 0 ? product.images[0] : null;

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

        {product.isNew && product.inStock ? (
          <span className="absolute left-3 top-3 bg-white px-2.5 py-1 text-eyebrow uppercase text-maroon ring-1 ring-line">
            New
          </span>
        ) : null}

        {product.inStock ? null : (
          <span className="absolute left-3 top-3 bg-charcoal px-2.5 py-1 text-eyebrow uppercase text-ivory">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link
          href={`/product/${product.id}`}
          className="text-body-sm text-muted transition-colors duration-250 after:absolute after:inset-0 after:content-[''] hover:text-ink"
        >
          {product.name}
        </Link>

        <StarRating value={product.rating} count={product.reviewCount} />

        <PriceDisplay mrp={product.mrp} price={product.price} />

        <div className="relative z-10 mt-auto pt-1">
          <AddToCartButton item={toCatalogueEntry(product)} fullWidth />
        </div>
      </div>
    </article>
  );
}
