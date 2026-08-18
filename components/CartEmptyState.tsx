import { SHOP_PATH } from "@/lib/shop-query";
import { ButtonLink } from "@/components/ButtonLink";
import { GemOutlineIcon } from "@/components/icons";

/**
 * An empty cart is a browsing state, not an error, so it reads as an invitation and keeps
 * the page's brand furniture rather than dropping to a bare line of text.
 */
export function CartEmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-7 border border-line bg-ivory px-6 py-20 text-center lg:py-24">
      <GemOutlineIcon className="h-12 w-12 text-gold" />

      <h2 className="font-display text-heading sm:text-heading-lg">
        <span className="uppercase tracking-caps text-ink">Your cart is</span>{" "}
        <span className="italic text-gold">empty</span>
      </h2>

      <span aria-hidden className="block h-px w-16 bg-gold" />

      <p className="max-w-prose text-body text-muted">
        Nothing chosen yet. The collection runs from everyday studs to statement pieces
        made for the front row. Start anywhere.
      </p>

      <ButtonLink href={SHOP_PATH}>Continue shopping</ButtonLink>
    </div>
  );
}
