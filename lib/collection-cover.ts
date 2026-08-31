import { COLLECTIONS, type CollectionFilterSlug, type Product } from "@/types/product";
import { buildCollectionHref } from "@/lib/navigation";
import { getAllProducts, getPrimaryImage } from "@/lib/products";
import { isProductInCollection } from "@/lib/shop";

/** One collection tile: where it goes, what it is called, and the piece standing for it. */
export interface CollectionCover {
  slug: CollectionFilterSlug;
  label: string;
  href: string;
  /** A photograph of a piece genuinely in this collection, or null when it has none yet. */
  image: string | null;
  alt: string;
}

/**
 * The piece whose photograph stands for a collection: a member that carries the `featured`
 * flag if the collection has one, otherwise its first member with a photograph.
 *
 * Membership is asked of `isProductInCollection`, the same function the shop's `?collection=`
 * facet filters with, so a tile can only ever show a piece the tile's own link will list.
 * That is the whole of the honesty rule the flat strip was written to respect — its comment
 * said collections "have no single image that could honestly stand for one", which was true
 * of an image chosen by hand and is not true of one derived from the collection's own
 * membership. Preferring a featured member is a merchandising nicety on top: given a choice
 * of 408 new arrivals, the one the owner already picked out is the better shop window.
 */
function coverProductFor(
  slug: CollectionFilterSlug,
  products: readonly Product[],
): Product | undefined {
  const members = products.filter(
    (product) => isProductInCollection(product, slug) && getPrimaryImage(product) !== null,
  );

  return members.find((product) => product.flags.featured) ?? members[0];
}

/**
 * Every collection, with the photograph that represents it. Derived at render time from the
 * catalogue rather than written down, so a collection whose membership changes gets a new
 * cover without anybody remembering to swap a file path.
 */
export function getCollectionCovers(): CollectionCover[] {
  const products = getAllProducts();

  return COLLECTIONS.map((collection) => {
    const cover = coverProductFor(collection.slug, products);

    return {
      slug: collection.slug,
      label: collection.label,
      href: buildCollectionHref(collection.slug),
      image: cover === undefined ? null : getPrimaryImage(cover),
      /**
       * The tile's own label is already read out by the link, so the photograph is described
       * rather than named — a screen reader hearing "Gifting, Gifting" has been told nothing
       * twice.
       */
      alt: cover === undefined ? "" : cover.seo.imageAlt,
    };
  });
}
