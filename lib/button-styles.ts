export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md";

export interface ButtonAppearance {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
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
 * Two scales, one style. `md` is the page-level call to action: 22px of vertical padding
 * around an 18px line box lands a 64px tall button, so the label sits in open space rather
 * than against the edges. `sm` is the in-card scale at 38px, small enough that a product
 * card reads as a product first and a button second. See
 * [ADR-024](/docs/decisions/ADR-024-funnel-ui-polish.md).
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2.5 text-[0.6875rem] leading-4",
  md: "px-12 py-[1.375rem] text-label",
};

/**
 * Shared by `Button` (a `<button>`, Client Component) and `ButtonLink` (an `<a>`), so the
 * two cannot drift apart. Appearance is chosen by variant and size only — there is no
 * `className` escape hatch on either component.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: ButtonAppearance): string {
  const widthClass = fullWidth ? "w-full" : "";
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass}`;
}
