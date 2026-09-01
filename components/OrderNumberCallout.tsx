"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONTACT_CONFIG } from "@/lib/config";
import { buildTrackOrderHref } from "@/lib/navigation";
import { CheckIcon, CopyIcon } from "@/components/icons";

/** How long the button reads "Copied" before returning to its resting label. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * The order number, given the weight it is worth. It is the one thing on a confirmation
 * screen a shopper may need to copy down, and it is set at heading size and spaced so the
 * unambiguous alphabet `lib/order-id.ts` chose survives being read off a phone screen.
 *
 * **And now it can actually be copied.** Ten characters transcribed by hand off a phone is
 * where an order number goes wrong, and the alphabet was chosen to survive that rather than to
 * make it unnecessary. The button writes the number to the clipboard and says so in place — not
 * through the toast, because this screen may have no toast host above it in a future shell and
 * because the confirmation of a copy belongs beside the thing that was copied.
 *
 * A blocked or absent clipboard is not an error to report. The number is on the screen in
 * heading type; the button is a convenience over a value that is already legible, so a refusal
 * leaves the label where it was and nothing else happens.
 *
 * The tracking link carries the number with it, so the shopper who follows it now sees their
 * order immediately, and the one who bookmarks it has the number in the URL rather than only
 * on this screen.
 *
 * Shared by both confirmation screens — a paid order and a cash-on-delivery one — because the
 * order number means the same thing on each and is the same thing to write down.
 *
 * **Quiet, and quieter than the balance beside it.** Both panels were gold-tinted and the same
 * weight, which made a reference the shopper may never use look as urgent as the cash they have
 * to find before the courier arrives. This one is a hairline on white now; `AmountDueNotice`
 * keeps the gold. The sentence below is also the only place this screen says to keep the
 * number — it used to say so again in the footnote under the buttons. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function OrderNumberCallout({ trackingId }: { trackingId: string }): JSX.Element {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const resetTimer = window.setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(resetTimer);
  }, [isCopied]);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(trackingId);
      setIsCopied(true);
    } catch {
      /* A blocked clipboard is "nothing happened"; the number is already on screen. */
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 border border-line bg-white px-6 py-6">
      <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
        Your order number
      </span>

      <div className="flex items-center gap-3">
        <strong className="font-display text-heading tracking-caps text-ink">
          {trackingId}
        </strong>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={`Copy order number ${trackingId}`}
          className="inline-flex items-center gap-1.5 border border-line bg-white px-2.5 py-1.5 text-eyebrow uppercase tracking-caps text-muted transition-colors duration-250 hover:text-ink"
        >
          {isCopied ? (
            <CheckIcon className="h-3.5 w-3.5 text-gold-deep" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>

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
