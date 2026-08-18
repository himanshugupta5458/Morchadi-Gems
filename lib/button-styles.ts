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

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[0.6875rem]",
  md: "px-7 py-3.5 text-label",
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
