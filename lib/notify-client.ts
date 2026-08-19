import type { CheckoutData } from "@/types/cart";
import type { VerifyOrderResult } from "@/types/order";
import { NOTIFY_ADMIN_API_PATH } from "@/lib/navigation";

/**
 * One key per order, so two different orders in one tab both notify. `sessionStorage` rather
 * than `localStorage`: the flag only needs to outlive a refresh of the confirmation page, and
 * a `localStorage` entry would linger on the device forever for no further benefit.
 */
export function buildNotifiedFlagKey(orderId: string): string {
  return `morchadi-notified:${orderId}`;
}

export function hasNotifiedAdmin(orderId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(buildNotifiedFlagKey(orderId)) !== null;
  } catch {
    return false;
  }
}

export function markAdminNotified(orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(buildNotifiedFlagKey(orderId), "1");
  } catch {
    return;
  }
}

/**
 * Asks the server to WhatsApp the owner about a paid order, and returns immediately.
 *
 * **Nothing about this call is awaited by the confirmation screen and nothing it returns is
 * read.** No promise is handed back, so a caller cannot accidentally block on it; the response
 * is discarded rather than parsed, so a failing or absent body cannot throw into React; and
 * the whole thing sits inside a `try`, so even a `fetch` that rejects synchronously in a
 * hostile environment cannot interrupt clearing the cart.
 *
 * The flag is written **before** the request goes out, not after it succeeds. That ordering is
 * deliberate: a duplicate WhatsApp costs the owner a moment's confusion, while a second send
 * racing the first, or a re-send on every refresh, is a genuine annoyance. Exactly-once is not
 * achievable without a database ([ADR-001](/docs/decisions/ADR-001-tech-stack.md)) and is not
 * worth reaching for — a send that silently fails is recoverable from the Cashfree dashboard,
 * which the message itself points at.
 *
 * A different tab, a cleared session or a second device will notify again. That is accepted.
 * See [ADR-031](/docs/decisions/ADR-031-admin-whatsapp-notification.md).
 */
export function notifyAdminOfPaidOrder(
  verified: VerifyOrderResult,
  bundle: CheckoutData | null,
): void {
  if (verified.status !== "PAID") return;
  if (hasNotifiedAdmin(verified.orderId)) return;

  markAdminNotified(verified.orderId);

  try {
    void fetch(NOTIFY_ADMIN_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify({
        orderId: verified.orderId,
        ...(bundle === null ? {} : { summary: bundle }),
      }),
    }).catch(() => undefined);
  } catch {
    return;
  }
}
