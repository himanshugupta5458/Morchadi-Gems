import type { ProductCardView } from "@/types/product";
import { ProductCard } from "@/components/ProductCard";

export interface ProductGridProps {
  products: ProductCardView[];
  priorityCount?: number;
  mobileLimit?: number;
}

/**
 * Page-agnostic: it renders whatever products it is handed and decides nothing about
 * which ones those are. Home, Shop, and the product page all compose it.
 *
 * `mobileLimit` caps how many are *shown* below `sm`; the rest stay in the markup and are
 * revealed by CSS at the breakpoint. Slicing the array instead would need the viewport
 * width at render time, which a Server Component does not have — the alternatives are a
 * client component that renders the wrong count until it hydrates, or shipping the phone's
 * count to desktop. A capped card is `display:none`, so its lazily-loaded image is never
 * fetched on a phone. See ADR-033.
 */
export function ProductGrid({
  products,
  priorityCount = 0,
  mobileLimit,
}: ProductGridProps): JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((product, index) => (
        <li
          key={product.id}
          className={
            mobileLimit !== undefined && index >= mobileLimit
              ? "hidden h-full sm:list-item"
              : "h-full"
          }
        >
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
