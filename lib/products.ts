import catalogue from "@/data/products.json";
import type { CatalogueEntry, Category, Product } from "@/types/product";

const products = catalogue as Product[];

/**
 * Narrows a product to the fields a cart line needs. Server Components call this before
 * handing anything to a client cart component, so a full product record — descriptions,
 * details, reviews — never crosses the boundary.
 */
export function toCatalogueEntry(product: Product): CatalogueEntry {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    mrp: product.mrp,
    image: product.images.length > 0 ? product.images[0] : null,
    inStock: product.inStock,
  };
}

/** The whole catalogue as lean entries — what `CartProvider` is given to reconcile against. */
export function getCatalogueIndex(): CatalogueEntry[] {
  return products.map(toCatalogueEntry);
}

export function getAllProducts(): Product[] {
  return products;
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getProductsByCategory(slug: Category): Product[] {
  return products.filter((product) => product.category === slug);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((product) => product.featured);
}

export function getNewArrivals(): Product[] {
  return products.filter((product) => product.isNew);
}

export function getRelatedProducts(product: Product, limit: number): Product[] {
  return products
    .filter(
      (candidate) =>
        candidate.category === product.category && candidate.id !== product.id,
    )
    .slice(0, limit);
}
