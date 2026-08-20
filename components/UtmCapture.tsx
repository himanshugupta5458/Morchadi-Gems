"use client";

import { useEffect } from "react";
import { captureUtmParams } from "@/lib/utm";

/**
 * Records the campaign a visitor arrived on, once per browser, and renders nothing.
 *
 * It is its own component rather than a branch of `GoogleAnalytics` because the two answer to
 * different things: attribution is recorded whether or not a measurement id exists, and it is
 * what puts the campaign on the order and in the owner's WhatsApp. Deleting the GA tag must
 * not quietly delete that.
 *
 * The URL is read from `window.location` inside an effect rather than through
 * `useSearchParams`, which would pull the root layout, and with it every statically
 * prerendered page, into a dynamic render for a value only the browser needs. The effect runs
 * once on mount, which is the first page of the visit and therefore the first touch.
 */
export function UtmCapture(): null {
  useEffect(() => {
    captureUtmParams();
  }, []);

  return null;
}
