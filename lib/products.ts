import catalogue from "@/data/products.json";
import type { CatalogueEntry, Category, Product } from "@/types/product";
import { hasProductOptions } from "@/lib/options";
import type { OrderPricingEntry } from "@/lib/order";
import type { OrderOptionEntry } from "@/lib/order-options";

/**
 * The one place the catalogue JSON becomes typed. TypeScript infers a union of object
 * literals from the file, and `specs` being an open index signature means several of those
 * branches are not comparable to `Product` however the record is written — so the assertion
 * goes through `unknown` rather than being papered over with an optional field that does not
 * exist. What actually guarantees the shape is `scripts/validate-products.mjs`, which runs in
 * the gate and checks every field of every product against the schema. See ADR-027.
 */
const products = catalogue as unknown as Product[];

/** The photograph every listing shows, or null for a product with no photograph yet. */
export function getPrimaryImage(product: Product): string | null {
  return product.media.images.length > 0 ? product.media.images[0] : null;
}

/**
 * One alt string per entry in `media.images`, in the same order, so a gallery can label each
 * thumbnail with what that photograph actually shows. `seo.imageAlt` covers the first image
 * and `seo.additionalImageAlts` the rest; a product whose extra images have no alt written
 * yet falls back to the main one rather than to an empty string, because a missing alt is
 * worse for a screen reader than an approximate one.
 */
export function getImageAlts(product: Product): string[] {
  const additional = product.seo.additionalImageAlts ?? [];
  return product.media.images.map(
    (_image, index) => (index === 0 ? product.seo.imageAlt : additional[index - 1]) ?? product.seo.imageAlt,
  );
}

/**
 * Narrows a product to the fields a cart line needs. Server Components call this before
 * handing anything to a client cart component, so a full product record — description,
 * specs, reviews — never crosses the boundary.
 *
 * `options` is part of that minimum: the client cart re-validates a persisted selection and
 * fills in defaults, and it cannot do either without knowing what is currently offered.
 * `variantImages` is the other: a cart line shows the photograph of the variant it records,
 * and that mapping lives nowhere else on the client.
 */
export function toCatalogueEntry(product: Product): CatalogueEntry {
  return {
    id: product.id,
    name: product.name,
    price: product.pricing.price,
    mrp: product.pricing.mrp,
    image: getPrimaryImage(product),
    inStock: product.stock.inStock,
    ...(hasProductOptions(product.options) ? { options: product.options } : {}),
    ...(product.media.variantImages === undefined
      ? {}
      : { variantImages: product.media.variantImages }),
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
  return products.filter((product) => product.flags.featured);
}

export function getNewArrivals(): Product[] {
  return products.filter((product) => product.flags.isNew);
}

export function getRelatedProducts(product: Product, limit: number): Product[] {
  return products
    .filter(
      (candidate) =>
        candidate.category === product.category && candidate.id !== product.id,
    )
    .slice(0, limit);
}

/**
 * The catalogue as the pricing core is allowed to see it: an id, a name, the charged amount
 * and whether it can be sold. `mrp` is not merely unreadable through `OrderPricingEntry`, it
 * is not in the object at all — a compare-at price cannot reach an amount even through a
 * cast. See ADR-011 and ADR-027.
 */
export function getOrderPricingCatalogue(): OrderPricingEntry[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.pricing.price,
    inStock: product.stock.inStock,
  }));
}

/**
 * The mirror of `getOrderPricingCatalogue` for fulfilment: what a line may have chosen, with
 * no amount in the object to read. See ADR-019.
 */
export function getOrderOptionCatalogue(): OrderOptionEntry[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    ...(hasProductOptions(product.options) ? { options: product.options } : {}),
  }));
}

/**
 * A catalogue description is written as prose in several paragraphs, stored in one JSON
 * string with a blank line between them. Splitting here rather than in the page keeps the
 * storage convention in one place, and tolerates a record that runs two paragraphs together
 * or leaves a stray blank line at the end.
 */
export function getDescriptionParagraphs(description: string): string[] {
  return description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
