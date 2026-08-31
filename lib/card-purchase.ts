import type { ProductOption } from "@/types/product";
import { hasProductOptions } from "@/lib/options";

/**
 * The most values a group may hold before the card stops asking the question and sends the
 * shopper to the page that can ask it properly.
 *
 * Three, because a fourth chip does not fit a card at the two-abreast phone width without
 * either wrapping to a second row — which breaks the fixed height a grid row depends on — or
 * shrinking past the point where the label is readable. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
export const CARD_OPTION_VALUE_LIMIT = 3;

/**
 * What the bottom of a card does, decided from the product's option groups alone.
 *
 * - `add` — no groups. One tap, nothing to choose, unchanged from before options existed.
 * - `choose-on-card` — exactly one group of at most three values, shown as chips. A default is
 *   pre-selected and Add to cart adds whatever is selected.
 * - `choose-on-page` — anything else: one group with more values, or more than one group. The
 *   button links to the product page and adds nothing.
 *
 * The line between the last two is the whole point of ADR-067. A card that silently added an
 * option group's declared default was choosing on the shopper's behalf with no visible signal
 * a choice had been made at all, and `/api/create-order`'s `INVALID_OPTION` guard could never
 * catch it because the value sent was always a legal one — just one nobody picked.
 */
export type CardPurchaseMode =
  | { kind: "add" }
  | { kind: "choose-on-card"; option: ProductOption }
  | { kind: "choose-on-page" };

export function selectCardPurchaseMode(
  options: ProductOption[] | undefined,
): CardPurchaseMode {
  if (!hasProductOptions(options)) return { kind: "add" };

  const [option] = options;
  const isSingleShortGroup =
    options.length === 1 && option.values.length <= CARD_OPTION_VALUE_LIMIT;

  return isSingleShortGroup ? { kind: "choose-on-card", option } : { kind: "choose-on-page" };
}

/** What the card's button says when it is a link to the product page rather than an add. */
export const CHOOSE_OPTIONS_LABEL = "Choose Your Options";
