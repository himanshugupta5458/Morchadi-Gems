import {
  readCallMeBotCredentials,
  sendOwnerWhatsApp,
  type CallMeBotCredentials,
  type SendOutcome,
} from "@/lib/notify";
import { composeCodOrderMessage, type CodOrderMessageInput } from "@/lib/notify-message";

const LOG_PREFIX = "[notify-cod]";

/**
 * The two things this module talks to, injectable so a test can watch a send without a network
 * and without the owner's real number in the environment.
 */
export interface CodNotificationDependencies {
  credentials?: CallMeBotCredentials | null;
  fetchImpl?: typeof fetch;
}

/**
 * Tells the shop owner, over WhatsApp, that a cash-on-delivery order has been placed.
 *
 * **The warrant is the write, not a lookup.** `/api/notify-admin` asks Cashfree whether the
 * order a browser named was really paid, because there the caller is a browser and the id it
 * sends is the only thing it is trusted with. Here the caller is `/api/create-order` itself,
 * one statement after `captureOrder` returned `CAPTURED`, holding the order number Postgres
 * just assigned and the amounts this same request computed from `data/products.json`. There is
 * nothing to re-verify: the row's existence *is* the verification, and no request from outside
 * this server can reach this function at all. See
 * [ADR-060](/docs/decisions/ADR-060-cod-order-notification.md).
 *
 * **Never throws, and never rejects.** Composition faults, missing keys, a CallMeBot timeout
 * and a non-2xx from CallMeBot all become a logged outcome, exactly as they do for a paid
 * order. A cash-on-delivery checkout has already been written to Postgres by the time this
 * runs, and a notification is not permitted to become a new way for a placed order to fail.
 * The caller does not await the result for the same reason: CallMeBot's five seconds are five
 * seconds a shopper would otherwise spend watching a spinner on an order that is already
 * placed.
 */
export async function notifyOwnerOfCodOrder(
  order: CodOrderMessageInput,
  { credentials, fetchImpl }: CodNotificationDependencies = {},
): Promise<SendOutcome> {
  try {
    const outcome = await sendOwnerWhatsApp({
      message: composeCodOrderMessage(order),
      credentials: credentials === undefined ? readCallMeBotCredentials() : credentials,
      ...(fetchImpl === undefined ? {} : { fetchImpl }),
    });

    if (outcome === "FAILED") {
      console.error(
        `${LOG_PREFIX} ${order.codOrderReference} was placed but the WhatsApp send failed`,
      );
    }
    if (outcome === "SKIPPED_NOT_CONFIGURED") {
      console.error(
        `${LOG_PREFIX} ${order.codOrderReference} was placed but CALLMEBOT_PHONE or CALLMEBOT_APIKEY is not set`,
      );
    }
    if (outcome === "SENT") {
      console.log(
        `${LOG_PREFIX} ${order.codOrderReference} notified the owner of order ${order.trackingId}`,
      );
    }

    return outcome;
  } catch (notifyError) {
    console.error(
      `${LOG_PREFIX} ${order.codOrderReference} could not be turned into a notification`,
      notifyError,
    );
    return "FAILED";
  }
}
