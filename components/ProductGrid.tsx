import type { Product } from "@/types/product";
import { ProductCard } from "@/components/ProductCard";

export interface ProductGridProps {
  products: Product[];
  priorityCount?: number;
}

/**
 * Page-agnostic: it renders whatever products it is handed and decides nothing about
 * which ones those are. Home, Shop, and the product page all compose it.
 */
export function ProductGrid({
  products,
  priorityCount = 0,
}: ProductGridProps): JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((product, index) => (
        <li key={product.id} className="h-full">
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
