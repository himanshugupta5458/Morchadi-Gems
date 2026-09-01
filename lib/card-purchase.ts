import type { ProductOption } from "@/types/product";
import { hasProductOptions } from "@/lib/options";

/**
 * What the bottom of a product card does, decided from the product's option groups alone.
 *
 * Two modes now, where [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md) had three.
 * A card either adds in one tap because there is nothing to ask, or it opens the add-to-cart
 * modal because there is — however many groups the product carries and however many values
 * each of them lists. The value ceiling that used to split "chips on the card" from "choose on
 * the product page" is gone with the chips, and so is the pre-selected default that ceiling was
 * an argument about: the modal starts with nothing chosen in any group.
 *
 * The property ADR-067 existed to protect is unchanged and is now unconditional. A card can
 * never record a choice nobody made, because a card with options no longer records a choice at
 * all — it asks. See [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export type CardPurchaseMode =
  | { kind: "add" }
  | { kind: "choose"; options: ProductOption[] };

export function selectCardPurchaseMode(
  options: ProductOption[] | undefined,
): CardPurchaseMode {
  return hasProductOptions(options) ? { kind: "choose", options } : { kind: "add" };
}

/**
 * A group whose name is about size gets counted in sizes rather than in options, because
 * "3 sizes" answers a question a shopper is already asking and "3 options" does not.
 */
const SIZE_GROUP_PATTERN = /\bsizes?\b/i;

/**
 * The muted tag beside a card's price — `3 sizes`, `25 options`, `2 options` — or null for a
 * product with nothing to choose.
 *
 * **What is counted depends on how many groups there are, and that is deliberate.** With one
 * group the useful number is how many values it offers, because that is the whole of the
 * question the modal will ask. With several, the useful number is how many questions there are:
 * a piece with a design group and a size group is "2 options" to a shopper, and summing its
 * values into "5 options" would describe a list that never appears anywhere.
 *
 * It is a tag about the *shape* of the choice, never about the choice itself. The card renders
 * no values; that is the modal's job.
 */
export function describeOptionGroups(
  options: ProductOption[] | undefined,
): string | null {
  if (!hasProductOptions(options)) return null;

  if (options.length > 1) return `${options.length} options`;

  const [option] = options;
  const noun = SIZE_GROUP_PATTERN.test(option.name) ? "sizes" : "options";
  return `${option.values.length} ${noun}`;
}
