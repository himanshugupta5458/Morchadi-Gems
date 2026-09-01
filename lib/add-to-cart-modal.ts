import type { ProductOption, SelectedOptions } from "@/types/product";

/**
 * The rules the add-to-cart modal's confirm button is governed by, in a module with no React in
 * it so they can be asserted directly rather than through a rendered dialog.
 *
 * There is one rule and it has no exceptions: a draft selection is complete when every group
 * the product carries holds a value the catalogue currently offers. Nothing seeds that draft —
 * not `option.default`, not the first listed value, not the value a previous product's modal
 * happened to leave behind. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */

/** The draft a modal opens with. Empty, for every product, every time. */
export function emptySelection(): SelectedOptions {
  return {};
}

export function isGroupAnswered(
  option: ProductOption,
  draft: SelectedOptions,
): boolean {
  const chosen = draft[option.name];
  return chosen !== undefined && option.values.includes(chosen);
}

/**
 * The first group still waiting on an answer, in the order the catalogue lists them, or null
 * once every group has one. It is both what disables the confirm button and what the helper
 * text names, so the sentence and the button can never disagree about which is missing.
 */
export function firstUnansweredGroup(
  options: readonly ProductOption[],
  draft: SelectedOptions,
): ProductOption | null {
  return options.find((option) => !isGroupAnswered(option, draft)) ?? null;
}

export function isSelectionComplete(
  options: readonly ProductOption[],
  draft: SelectedOptions,
): boolean {
  return firstUnansweredGroup(options, draft) === null;
}

/** `SELECT SIZE FOR BANGLES` — the label over one group's controls, uppercased in CSS. */
export function buildGroupLabel(option: ProductOption): string {
  return `Select ${option.name}`;
}

/** `Choose a Letter to continue` — shown only while that group is still unanswered. */
export function buildUnansweredPrompt(option: ProductOption): string {
  return `Choose a ${option.name} to continue`;
}

/**
 * The draft narrowed to the groups the product actually has, which is what reaches the cart.
 *
 * A modal cannot produce a stray key today, but the cart's own `resolveSelectedOptions` fills
 * missing groups from `option.default`, and handing it a record with a key it does not
 * recognise would be the one way a value nobody chose could still get in. Narrowing here means
 * the only thing the cart is ever told is what the shopper actually answered.
 */
export function toConfirmedSelection(
  options: readonly ProductOption[],
  draft: SelectedOptions,
): SelectedOptions {
  return Object.fromEntries(
    options
      .filter((option) => isGroupAnswered(option, draft))
      .map((option) => [option.name, draft[option.name]]),
  );
}
