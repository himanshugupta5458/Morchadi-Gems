export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md";

export interface ButtonAppearance {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * Fill the height of the box the button was put in, instead of standing it up out of its own
   * padding.
   *
   * The one caller is the product card, and the reason is alignment rather than taste: a card
   * row holds "Add to cart" beside "Choose Your Options", and the second label wraps to two
   * lines at every width below a desktop column. Left to their padding the two buttons would be
   * different heights in the same row, which is the misalignment the fixed title block and the
   * reserved chip row already exist to prevent. The card reserves one height for the action and
   * both buttons take it, whether their label runs to one line or two.
   *
   * Padding still defines the height of every other button on the site, which is what ADR-025
   * settled — this replaces that rule only where a caller has already decided the height. See
   * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
   */
  fillHeight?: boolean;
}

const baseClasses =
  "inline-flex items-center justify-center border font-sans font-medium uppercase tracking-caps transition-colors duration-250 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-charcoal bg-charcoal text-ivory hover:border-maroon hover:bg-maroon disabled:border-line disabled:bg-line disabled:text-muted",
  secondary:
    "border-charcoal bg-transparent text-charcoal hover:border-maroon hover:bg-maroon hover:text-ivory disabled:border-line disabled:bg-transparent disabled:text-muted",
};

/**
 * Padding alone defines the height of both scales. Nothing here sets `h-*`, and nothing
 * overrides the line box `text-label` brings, so the only way to change how tall a button is
 * is to change these two numbers.
 *
 * `md` is the page-level call to action: 20px above and below an 18px line box, a 60px
 * button, with 40px either side so the label never reaches the border. `sm` is the in-card
 * scale at roughly 38px, small enough that a product card reads as a product first and a
 * button second. See [ADR-025](/docs/decisions/ADR-025-button-padding-tailwind-content.md)
 * and [ADR-026](/docs/decisions/ADR-026-paired-cta-equal-width.md).
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2.5 text-[0.6875rem]",
  md: "px-10 py-5 text-label",
};

/**
 * The same horizontal scale with the vertical padding dropped rather than overridden, because
 * two padding utilities in one class string are settled by the order Tailwind emits them in
 * and not by the order they are written. `leading-tight` is what lets a two-line label sit
 * inside the height its caller reserved.
 */
const fillHeightSizeClasses: Record<ButtonSize, string> = {
  sm: "h-full px-3 text-[0.6875rem] leading-tight",
  md: "h-full px-10 text-label leading-tight",
};

/**
 * Shared by `Button` (a `<button>`, Client Component) and `ButtonLink` (an `<a>`), so the
 * two cannot drift apart. Appearance is chosen by the four named fields above and nothing
 * else — there is no `className` escape hatch on either component.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  fillHeight = false,
}: ButtonAppearance): string {
  const widthClass = fullWidth ? "w-full" : "";
  const scaleClasses = fillHeight ? fillHeightSizeClasses[size] : sizeClasses[size];

  return `${baseClasses} ${variantClasses[variant]} ${scaleClasses} ${widthClass}`;
}
