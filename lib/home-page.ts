/**
 * The numbers the home page is composed from.
 *
 * They live here rather than at the top of `app/(storefront)/page.tsx` so they can be asserted
 * directly: a page file's only exports are the ones Next.js recognises, so a cap written there
 * can be checked only by reading the file as text or by counting elements in rendered markup —
 * and counting cards cannot tell two strips of the same length apart.
 */

/**
 * How many pieces each home strip shows on a phone. Two rows of two, plus the link to the
 * rest, is the amount that still reads as a taste of the collection rather than as the
 * collection — whatever the strip holds above `sm`. See ADR-033.
 */
export const HOME_MOBILE_PRODUCT_COUNT = 4;

/**
 * How many new arrivals the home strip previews.
 *
 * `flags.isNew` is carried by 408 of the 449 records, so the strip has to say how much of that
 * it wants: unbounded, it rendered the near-whole flagged catalogue into this page's HTML.
 * Eight is two clean rows of the grid's four columns from `lg` and four rows of two on a phone,
 * of which `HOME_MOBILE_PRODUCT_COUNT` shows the first two. It was twelve, which made a third
 * desktop row between the shopper and everything below it. See
 * [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
export const HOME_NEW_ARRIVALS_COUNT = 8;

/**
 * The padding of a band whose neighbour already introduced it.
 *
 * Roughly a third off `HOME_STANDARD_SECTION_PADDING`, applied to the two gaps measured as
 * close to a full empty screen at desktop width: above the collection tiles, which follow the
 * category grid and are the same question asked a second way, and above the promise band, which
 * follows the best-seller strip. Both still clear their neighbours; neither is a screen of
 * nothing any more.
 *
 * Written as class strings rather than as numbers because Tailwind reads this file as text —
 * `lib/**` is in the `content` globs — so the utilities are generated from these literals. See
 * [ADR-025](/docs/decisions/ADR-025-button-padding-tailwind-content.md).
 */
export const HOME_TIGHT_SECTION_PADDING = "py-7 sm:py-11 lg:py-16";

export const HOME_STANDARD_SECTION_PADDING = "py-10 sm:py-16 lg:py-24";
