import Link from "next/link";
import { CONTACT_CONFIG } from "@/lib/config";
import { buildTrackOrderHref } from "@/lib/navigation";

/**
 * The order number, given the weight it is worth. It is the one thing on a confirmation
 * screen a shopper may need to copy down, and it is set at heading size and spaced so the
 * unambiguous alphabet `lib/order-id.ts` chose survives being read off a phone screen.
 *
 * The tracking link carries the number with it, so the shopper who follows it now sees their
 * order immediately, and the one who bookmarks it has the number in the URL rather than only
 * on this screen.
 *
 * Shared by both confirmation screens — a paid order and a cash-on-delivery one — because the
 * order number means the same thing on each and is the same thing to write down.
 */
export function OrderNumberCallout({ trackingId }: { trackingId: string }): JSX.Element {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 border border-gold/40 bg-gold/5 px-6 py-6">
      <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
        Your order number
      </span>
      <strong className="font-display text-heading tracking-caps text-ink">
        {trackingId}
      </strong>
      <span className="text-body-sm text-muted">
        Keep this. It is what we will ask for if you message us about this order, and what you
        type in to{" "}
        <Link
          href={buildTrackOrderHref(trackingId)}
          className="text-ink underline decoration-gold underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
        >
          check where it has got to
        </Link>
        .
      </span>
    </div>
  );
}

/** A sentence handing the shopper the support address, so the address is written once. */
export function SupportLine({ children }: { children: string }): JSX.Element {
  return (
    <>
      {children}{" "}
      <a
        href={`mailto:${CONTACT_CONFIG.supportEmail}`}
        className="text-ink underline underline-offset-4 transition-colors duration-250 hover:text-gold"
      >
        {CONTACT_CONFIG.supportEmail}
      </a>
    </>
  );
}
