import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";
import { SITE_CONFIG } from "@/lib/config";

export type WordmarkTone = "ink" | "ivory";

/**
 * `image` is the real logo and the default — it is what every light-ground surface shows.
 * `text` is the two-tone type lockup, kept for the charcoal footer: the logo's script is
 * dark green and measures 1.65:1 against `charcoal`, which is not legible at any size.
 * See [ADR-022](/docs/decisions/ADR-022-logo-integration.md).
 */
export type WordmarkVariant = "image" | "text";

/**
 * 44px tall on mobile and 64px from `lg`, inside a header row that is a fixed 64px and 96px
 * — so the logo can never be what makes the header taller. The upper end is deliberate: the
 * artwork carries roughly 12% transparent margin top and bottom (294px of ink in 388px), so
 * a 64px box renders a 48px mark, which is the size the header whitespace wants.
 */
const LOGO_HEIGHT_CLASSES = "h-11 w-auto lg:h-16";

/**
 * Those two heights turned into widths at the logo's 642:388 ratio. Without them next/image
 * sizes the srcset off the intrinsic 642px and ships a 750px render into a 106px slot.
 */
const LOGO_SIZES = "(min-width: 1024px) 106px, 73px";

export interface WordmarkProps {
  variant?: WordmarkVariant;
  /** Applies to the `text` variant only; the logo carries its own colour. */
  tone?: WordmarkTone;
  /** Set on the header, which renders above the fold on every route. */
  priority?: boolean;
  onNavigate?: () => void;
}

const romanToneClasses: Record<WordmarkTone, string> = {
  ink: "text-ink",
  ivory: "text-ivory",
};

export function Wordmark({
  variant = "image",
  tone = "ink",
  priority = false,
  onNavigate,
}: WordmarkProps): JSX.Element {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={`${SITE_CONFIG.brandName}, home`}
      className="inline-flex items-center leading-none"
    >
      {variant === "image" ? (
        <Image
          src={logo}
          alt={SITE_CONFIG.brandName}
          priority={priority}
          sizes={LOGO_SIZES}
          className={LOGO_HEIGHT_CLASSES}
        />
      ) : (
        <span className="font-display text-heading-sm">
          <span className={`uppercase tracking-caps ${romanToneClasses[tone]}`}>
            {SITE_CONFIG.brandNameLead}
          </span>{" "}
          <span className="italic text-gold">{SITE_CONFIG.brandNameAccent}</span>
        </span>
      )}
    </Link>
  );
}
