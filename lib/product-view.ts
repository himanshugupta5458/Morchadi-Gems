import type { CatalogueEntry, ProductCardView } from "@/types/product";
import { hasProductOptions } from "@/lib/options";
import { isStockAvailable } from "@/lib/product-badge";

/**
 * The three projections of a catalogue record that a **card** needs, in the one module that
 * holds no catalogue.
 *
 * They used to live in `lib/products.ts` beside every accessor that reads
 * `data/products.json`, which was fine while the only thing rendering a card was a Server
 * Component. The cross-sell rails changed that: `CrossSellRow` is a Client Component and
 * renders `ProductGrid`, so every module `ProductCard` imports is now compiled into a browser
 * bundle too — and importing `lib/products.ts` there would have shipped the whole 1.4MB
 * catalogue to the browser to render four cards.
 *
 * So the functions moved and the data did not. `lib/products.ts` re-exports all three, which is
 * why every existing server-side caller reads unchanged; `components/ProductCard.tsx` imports
 * them from here, and `lib/catalogue-client-boundary.test.ts` fails if it ever stops.
 */

/** The photograph every listing shows, or null for a product with no photograph yet. */
export function getPrimaryImage(product: ProductCardView): string | null {
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
export function getSecondaryImage(product: ProductCardView): string | null {
  return product.media.images.length > 1 ? product.media.images[1] : null;
}

/**
 * Narrows a product to the fields a cart line needs. Server Components call this before
 * handing anything to a client cart component, so a full product record — description,
 * specs, cost — never crosses the boundary.
 *
 * `options` is part of that minimum: the client cart re-validates a persisted selection and
 * fills in defaults, and it cannot do either without knowing what is currently offered.
 * `variantImages` is the other: a cart line shows the photograph of the variant it records,
 * and that mapping lives nowhere else on the client. `category` is the third, and the newest:
 * the cross-sell rails ask what shelf a basket's pieces came from, and asking the server would
 * have meant a second catalogue in the browser to answer it.
 */
export function toCatalogueEntry(product: ProductCardView): CatalogueEntry {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
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

/**
 * A product record reduced to exactly what a card renders, and to nothing a browser may not
 * hold. It is the shape the cross-sell shortlists are serialised as — see `ProductCardView`
 * for why a whole `Product` is not.
 */
export function toProductCardView(product: ProductCardView): ProductCardView {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    pricing: { price: product.pricing.price, mrp: product.pricing.mrp },
    media: {
      images: product.media.images.slice(0, 2),
      ...(product.media.variantImages === undefined
        ? {}
        : { variantImages: product.media.variantImages }),
    },
    seo: { imageAlt: product.seo.imageAlt },
    stock: product.stock,
    flags: product.flags,
    ...(hasProductOptions(product.options) ? { options: product.options } : {}),
  };
}
