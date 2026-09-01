import { COLLECTIONS, type CollectionFilterSlug, type Product } from "@/types/product";
import { buildCollectionHref } from "@/lib/navigation";
import { getPrimaryImage } from "@/lib/products";
import { isProductInCollection } from "@/lib/shop";

/** One collection tile: where it goes, what it is called, and the cover it is shown behind. */
export interface CollectionCover {
  slug: CollectionFilterSlug;
  label: string;
  href: string;
  /**
   * The collection's own commissioned cover. Typed as nullable because the tile still renders a
   * placeholder for the absent case, though `COLLECTION_COVER_IMAGES` supplies every slug today.
   */
  image: string | null;
  alt: string;
}

/**
 * The commissioned cover each collection is shown behind, one fixed file per slug.
 *
 * A collection cuts across categories, and the tile is a piece of art direction rather than a
 * shop window onto one product: the four images are made for these four tiles and change only
 * when somebody replaces the file. Keyed by `CollectionFilterSlug` rather than by string, so a
 * new collection fails to compile until it has been given a cover instead of quietly rendering
 * a placeholder.
 */
const COLLECTION_COVER_IMAGES: Record<CollectionFilterSlug, string> = {
  gifting: "/collections/gifting-fallback.jpg",
  "anti-tarnish": "/collections/anti-tarnish-fallback.jpg",
  "best-sellers": "/collections/best-sellers-fallback.jpg",
  "new-arrivals": "/collections/new-arrivals-fallback.jpg",
};

/**
 * The piece whose photograph would stand for a collection: a member that carries the `featured`
 * flag if the collection has one, otherwise its first member with a photograph.
 *
 * **No tile is derived this way any more** — every collection shows its own commissioned cover
 * from `COLLECTION_COVER_IMAGES`. The derivation is kept because the rule it encodes is still
 * the honest one for any surface that wants to show a *product* standing for a collection:
 * membership is asked of `isProductInCollection`, the same function the shop's `?collection=`
 * facet filters with, so such a surface can only ever show a piece its own link will list.
 */
export function coverProductFor(
  slug: CollectionFilterSlug,
  products: readonly Product[],
): Product | undefined {
  const members = products.filter(
    (product) => isProductInCollection(product, slug) && getPrimaryImage(product) !== null,
  );

  return members.find((product) => product.flags.featured) ?? members[0];
}

/**
 * What a screen reader is told about a commissioned cover.
 *
 * It describes the collection rather than naming a product, because the image no longer *is* a
 * product: sourcing this from a member's `seo.imageAlt` would describe a piece that is not the
 * one on screen.
 */
function describeCollectionCover(label: string): string {
  return `A curated piece from the ${label} collection`;
}

/**
 * Every collection, with the cover commissioned for it.
 *
 * The path is looked up rather than derived, so a tile no longer changes when the catalogue's
 * membership does — which is the point: the four covers are art-directed for these four tiles,
 * and a collection is a theme rather than a shelf with a best piece on it.
 */
export function getCollectionCovers(): CollectionCover[] {
  return COLLECTIONS.map((collection) => ({
    slug: collection.slug,
    label: collection.label,
    href: buildCollectionHref(collection.slug),
    image: COLLECTION_COVER_IMAGES[collection.slug],
    alt: describeCollectionCover(collection.label),
  }));
}

