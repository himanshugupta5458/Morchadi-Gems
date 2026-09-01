"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/lib/toast-context";
import { LinkIcon, ShareIcon } from "@/components/icons";

export interface ProductShareButtonProps {
  /** What the share sheet titles the card. The product's own name. */
  title: string;
}

const SHARE_LABEL = "Share";
const COPY_LABEL = "Copy link";

export const LINK_COPIED_MESSAGE = "Link copied";

/**
 * Share this piece — the phone's own share sheet where there is one, the clipboard where
 * there is not.
 *
 * `navigator.share` is behind a capability check rather than a user-agent test, and the
 * fallback is not a lesser feature: on a desktop browser copying the link *is* what sharing
 * means. The URL comes from `window.location.href` at click time rather than being passed in,
 * so it carries whatever the page is actually at.
 *
 * An abandoned share sheet rejects with `AbortError`, which is a shopper changing their mind
 * and not a failure to report. Every rejection is swallowed for that reason: there is no
 * message this button could show that would help.
 *
 * **Icon only, in the corner beside the badge.** It was a labelled control on a line of its own
 * under the trust strip, which gave a secondary action the same weight as Add to cart and put
 * it below the fold on a phone. The label survives as the accessible name and as the tooltip,
 * so nothing is lost to anyone who needs it. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function ProductShareButton({ title }: ProductShareButtonProps): JSX.Element {
  const { showToast } = useToast();
  /**
   * Settled after mount, never during it. The server has no `navigator`, so deciding the label
   * while rendering would make the first client render disagree with the server's and React
   * would report a hydration mismatch. Starting at the fallback and correcting in an effect is
   * the same order the page is actually usable in: the click handler picks its route at click
   * time regardless of what the label says.
   */
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function handleShare(): Promise<void> {
    const url = window.location.href;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast(LINK_COPIED_MESSAGE);
    } catch {
      /* A dismissed share sheet and a blocked clipboard are both "nothing happened". */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      aria-label={canShare ? SHARE_LABEL : COPY_LABEL}
      title={canShare ? SHARE_LABEL : COPY_LABEL}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-white text-muted transition-colors duration-250 hover:border-charcoal hover:text-ink"
    >
      {canShare ? (
        <ShareIcon className="h-4 w-4" />
      ) : (
        <LinkIcon className="h-4 w-4" />
      )}
    </button>
  );
}
