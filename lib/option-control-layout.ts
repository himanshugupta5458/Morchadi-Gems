/**
 * The two ways a choose-one-of-a-few option control sizes its values.
 *
 * `flow` is the product page's: each value sized to its own label, which is what lets "Antique
 * Gold" and "Cream Shimmer" read as words rather than as truncated stubs.
 *
 * `compact` is the add-to-cart modal's. The modal is 360px wide and the values it usually holds
 * are two or three characters — `2.4`, `6`, `A` — so its controls sit on a fixed 38px baseline
 * and four or five fit a row before they wrap. A long value takes the width it needs and wraps
 * the row earlier rather than being squeezed into an equal column, because a grid sized for
 * `February Purple` would leave a size chip 90px wide.
 *
 * Both layouts wrap rather than scroll, and both keep the same border, checked state and focus
 * ring: `compact` changes how much room a value gets and nothing about what it is.
 *
 * Written as class strings in `lib/` because Tailwind reads this directory as content and
 * generates the utilities from these literals — see
 * [ADR-025](/docs/decisions/ADR-025-button-padding-tailwind-content.md) and
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export type OptionControlLayout = "flow" | "compact";

/** 38px square minimum, the modal's chip baseline. */
export const COMPACT_OPTION_CONTROL_CLASSES = "h-[2.375rem] min-w-[2.375rem] px-3";

export function optionControlSizeClasses(
  layout: OptionControlLayout,
  flowClasses: string,
): string {
  return layout === "compact" ? COMPACT_OPTION_CONTROL_CLASSES : flowClasses;
}
