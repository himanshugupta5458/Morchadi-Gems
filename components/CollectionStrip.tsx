import Image from "next/image";
import Link from "next/link";
import { getCollectionCovers } from "@/lib/collection-cover";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { RevealOnScroll } from "@/components/RevealOnScroll";

/** How far each tile trails the one before it as the row reveals. */
const REVEAL_STAGGER_MS = 70;

/**
 * The second tier, as photographed tiles.
 *
 * It was a row of text links, on the reasoning that "collections cut across categories, so
 * they have no single image that could honestly stand for one". That held for an image chosen
 * by hand. It does not hold for one derived from the collection's own membership rule:
 * `getCollectionCovers` asks `isProductInCollection` — the same function the `?collection=`
 * facet filters with — so every tile shows a piece the tile's own link will actually list.
 * See [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 *
 * A collection with no photographed member yet keeps the plain treatment rather than borrowing
 * somebody else's picture.
 */
export function CollectionStrip(): JSX.Element {
  const covers = getCollectionCovers();

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
      {covers.map((cover, index) => (
        <li key={cover.slug} className="h-full">
          <RevealOnScroll delayMs={index * REVEAL_STAGGER_MS}>
            <Link
              href={cover.href}
              className="group relative block h-full overflow-hidden border border-line bg-ivory shadow-card transition duration-250 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="relative block aspect-[4/3] w-full overflow-hidden sm:aspect-[3/2]">
                {cover.image === null ? (
                  <ProductImagePlaceholder />
                ) : (
                  <Image
                    src={cover.image}
                    alt={cover.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-charcoal/90 via-charcoal/45 to-transparent"
                />
              </span>

              <span className="absolute inset-x-0 bottom-0 px-3 py-3 text-center text-eyebrow uppercase tracking-caps text-ivory sm:px-4 sm:py-4 sm:text-label">
                {cover.label}
              </span>
            </Link>
          </RevealOnScroll>
        </li>
      ))}
    </ul>
  );
}
