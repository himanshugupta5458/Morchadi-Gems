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
 * Padding alone defines the height of both scales. Nothing here sets `h-*`, and nothing
 * overrides the line box `text-label` brings, so the only way to change how tall a button is
 * is to change these two numbers.
 *
 * `md` is the page-level call to action: 20px above and below an 18px line box, a 60px
 * button, with 40px either side so the label never reaches the border. `sm` is the in-card
 * scale at roughly 38px, small enough that a product card reads as a product first and a
 * button second. See [ADR-027](/docs/decisions/ADR-027-button-padding-tailwind-content.md)
 * and [ADR-026](/docs/decisions/ADR-026-paired-cta-equal-width.md).
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-5 py-2.5 text-[0.6875rem]",
  md: "px-10 py-5 text-label",
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
