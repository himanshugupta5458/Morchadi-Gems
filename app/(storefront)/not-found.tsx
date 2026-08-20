import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { GemOutlineIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * The shop's 404. It sits inside the storefront route group, so it renders within the shop's
 * own layout and inherits the header, the footer and the rest of the chrome rather than
 * reassembling them.
 *
 * Reaching it for a *completely* unmatched address takes `[...unmatched]/page.tsx` beside this
 * file — see the note there.
 */
export default function NotFound(): JSX.Element {
  return (
    <div className="container flex flex-col items-center gap-7 py-24 text-center lg:py-32">
      <GemOutlineIcon className="h-12 w-12 text-gold" />

      <h1 className="font-display text-heading sm:text-heading-lg">
        <span className="uppercase tracking-caps text-ink">Page</span>{" "}
        <span className="italic text-gold">not found</span>
      </h1>

      <span aria-hidden className="block h-px w-16 bg-gold" />

      <p className="max-w-prose text-body text-muted">
        The page you were looking for has moved or never existed. The collection is all
        still here.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <ButtonLink href="/shop">Back to Shop</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Go to homepage
        </ButtonLink>
      </div>
    </div>
  );
}
