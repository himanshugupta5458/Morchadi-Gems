import catalogue from "@/data/products.json";
import type { CatalogueEntry, Category, Product } from "@/types/product";
import { hasProductOptions } from "@/lib/options";
import { isStockAvailable } from "@/lib/product-badge";
import type { OrderPricingEntry } from "@/lib/order";
import type { CodEligibilityEntry } from "@/lib/cod";
import type { OrderCaptureEntry } from "@/lib/order-capture";
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

/**
 * Whether a record may be shown, linked, priced or sold. Only an explicit `"draft"` withholds
 * a product: a record written before the field existed reads as published, which is the
 * backward-compatible default and the one `scripts/validate-products.mjs` stops anything from
 * relying on, because it requires the field on every product in the gate.
 */
export function isActiveProduct(product: Product): boolean {
  return product.status !== "draft";
}

/**
 * The catalogue as every public surface is allowed to see it. Every accessor below reads this
 * rather than `products`, so filtering by status is a property of the module rather than a
 * line each consumer has to remember: the shop listing, the facets, the sitemap, the
 * structured data, the related-products rail, the prerendered route list, the cart's
 * catalogue and all three order catalogues inherit it for free, and a surface added tomorrow
 * inherits it without being told. See
 * [ADR-052](/docs/decisions/ADR-052-product-status-field.md).
 */
const activeProducts = products.filter(isActiveProduct);

/**
 * The unfiltered catalogue, drafts included. Its readers are the tools that check the file
 * rather than the surfaces that publish it — a validator has to see a draft to validate it.
 * No route, page, component or order path may call this.
 */
export function getAllProductsIncludingDrafts(): Product[] {
  return products;
}

/** The photograph every listing shows, or null for a product with no photograph yet. */
export function getPrimaryImage(product: Product): string | null {
  return product.media.images.length > 0 ? product.media.images[0] : null;
}

/**
 * The second photograph a card reveals on hover, or null.
 *
 * Null for all but thirteen of the 449 records, and that is the point of the accessor: a
 * product with one photograph gets **no** hover behaviour at all rather than a fade to a
 * placeholder or a flash of the same picture. A swap the shopper cannot predict is worse than
 * no swap, and a swap to nothing is worse than both. See
 * [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
export function getSecondaryImage(product: Product): string | null {
  return product.media.images.length > 1 ? product.media.images[1] : null;
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
    inStock: isStockAvailable(product.stock),
    ...(hasProductOptions(product.options) ? { options: product.options } : {}),
    ...(product.media.variantImages === undefined
      ? {}
      : { variantImages: product.media.variantImages }),
  };
}

/** The whole catalogue as lean entries — what `CartProvider` is given to reconcile against. */
export function getCatalogueIndex(): CatalogueEntry[] {
  return activeProducts.map(toCatalogueEntry);
}

export function getAllProducts(): Product[] {
  return activeProducts;
}

/**
 * Undefined for a draft as well as for an id that was never in the catalogue, so the product
 * page's existing `notFound()` turns a draft into a 404 without knowing what a draft is.
 */
export function getProductById(id: string): Product | undefined {
  return activeProducts.find((product) => product.id === id);
}

export function getProductsByCategory(slug: Category): Product[] {
  return activeProducts.filter((product) => product.category === slug);
}

export function getFeaturedProducts(): Product[] {
  return activeProducts.filter((product) => product.flags.featured);
}

/**
 * How many new arrivals a caller gets when it does not say. `isNew` is a merchandising flag
 * rather than a window — 408 of the 449 records carry it — so an unbounded call renders the
 * near-whole catalogue into whatever page asked, which is what put 1.87 MB of HTML on the home
 * page. Twelve is the preview size the four-column grid reads as three full rows, and three at
 * `md`, and six at the two-abreast phone width. A caller that genuinely wants every flagged
 * product passes `Number.POSITIVE_INFINITY` and says so.
 */
const DEFAULT_NEW_ARRIVALS_LIMIT = 12;

export function getNewArrivals(limit: number = DEFAULT_NEW_ARRIVALS_LIMIT): Product[] {
  return activeProducts.filter((product) => product.flags.isNew).slice(0, limit);
}

export function getRelatedProducts(product: Product, limit: number): Product[] {
  return activeProducts
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
  return activeProducts.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.pricing.price,
    inStock: isStockAvailable(product.stock),
  }));
}

/**
 * The catalogue as *capture* is allowed to see it: the name and photograph an order line
 * snapshots, and `pricing.cost` — which is why this is a third accessor rather than two fields
 * added to `getOrderPricingCatalogue`.
 *
 * Cost is margin data. It is barred from the pricing core, where an amount is decided, and it
 * is barred from `toCatalogueEntry`, which is the only catalogue shape that crosses into a
 * client bundle. Its one legitimate reader is the code that writes `order_line_items.unit_cost`
 * at the moment an order is captured, so that profit stays answerable after the catalogue's
 * figures move. Keeping it in an object of its own means no caller acquires it by accident.
 * See ADR-040 and ADR-042.
 *
 * `image` cannot in practice be empty: `scripts/validate-products.mjs` requires at least one
 * photograph per product and runs in the gate.
 */
export function getOrderCaptureCatalogue(): OrderCaptureEntry[] {
  return activeProducts.map((product) => ({
    id: product.id,
    name: product.name,
    image: getPrimaryImage(product) ?? "",
    cost: product.pricing.cost,
  }));
}

/**
 * The catalogue as a *cash-on-delivery* decision is allowed to see it: an id and the amount
 * per unit that must be paid online. A fourth accessor rather than a field added to
 * `getOrderPricingCatalogue`, for the same reason `pricing.cost` got its own: the pricing
 * core decides what a cart is worth, and whether COD is offered is a different question
 * asked of the same catalogue.
 *
 * Keeping them apart means `buildOrderFromCart` cannot begin to read `minPrepaidAmount` into
 * a total, and `isCartCodEligible` cannot begin to read `price` into an eligibility rule —
 * neither field is in the other's object to reach for. See ADR-011 and ADR-058.
 */
export function getCodEligibilityCatalogue(): CodEligibilityEntry[] {
  return activeProducts.map((product) => ({
    id: product.id,
    minPrepaidAmount: product.pricing.minPrepaidAmount,
  }));
}

/**
 * The mirror of `getOrderPricingCatalogue` for fulfilment: what a line may have chosen, with
 * no amount in the object to read. See ADR-019.
 */
export function getOrderOptionCatalogue(): OrderOptionEntry[] {
  return activeProducts.map((product) => ({
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
