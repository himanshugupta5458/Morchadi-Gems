import type { VerifiedOrderState } from "@/types/order";

export const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";

/**
 * Five seconds, against fifteen for Cashfree. CallMeBot is a free hobby service with no
 * uptime commitment, and this request happens while a shopper is looking at their
 * confirmation screen. A slow third party must not become a slow route, so the timeout is
 * short enough that giving up is the normal outcome rather than an incident.
 */
export const CALLMEBOT_TIMEOUT_MS = 5_000;

export interface CallMeBotCredentials {
  phone: string;
  apiKey: string;
}

/**
 * The owner's own WhatsApp number and key, or null when either is unset.
 *
 * Neither is `NEXT_PUBLIC_`, so neither can reach a client bundle. Null is a supported state,
 * not an error: the notification is an operational convenience layered on top of a working
 * checkout, and a deployment without the keys must sell exactly as well as one with them.
 */
export function readCallMeBotCredentials(): CallMeBotCredentials | null {
  const phone = process.env.CALLMEBOT_PHONE?.trim() ?? "";
  const apiKey = process.env.CALLMEBOT_APIKEY?.trim() ?? "";

  if (phone.length === 0 || apiKey.length === 0) return null;
  return { phone, apiKey };
}

/**
 * The CallMeBot GET, with the message percent-encoded. `encodeURIComponent` turns each newline
 * into `%0A`, which is what WhatsApp renders as a line break, so the composer writes ordinary
 * `\n` and the encoding is decided in exactly one place.
 */
export function buildCallMeBotUrl(
  credentials: CallMeBotCredentials,
  message: string,
): string {
  const params = new URLSearchParams({
    phone: credentials.phone,
    text: message,
    apikey: credentials.apiKey,
  });

  return `${CALLMEBOT_ENDPOINT}?${params.toString()}`;
}

/**
 * Why a notification did or did not go out. Every one of these is a normal, non-failing
 * outcome as far as the caller is concerned — the route reports whichever happened and always
 * answers 200.
 */
export type NotifyOutcome =
  | "SENT"
  | "SKIPPED_NOT_PAID"
  | "SKIPPED_NOT_CONFIGURED"
  | "FAILED";

export interface DispatchAdminNotificationInput {
  /** The status the *server* verified with Cashfree. Never a status the client asserted. */
  verifiedStatus: VerifiedOrderState;
  message: string;
  credentials: CallMeBotCredentials | null;
  /** Injected so the guard can be tested without a network, and mocked in tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Sends the admin WhatsApp, or explains why it did not.
 *
 * Two guards, in this order and for different reasons. The status guard is the security one:
 * the client tells this route which order to look at, and nothing else, so a request naming
 * somebody else's unpaid order produces no message. Checking it first also means a spoofed
 * request never reaches the third party at all.
 *
 * The credentials guard is the degradation one, and it comes second so that an unconfigured
 * deployment still distinguishes "not paid" from "no keys" in its logs.
 *
 * Nothing here throws. A timeout, a refused connection, a 500 from CallMeBot and a body that
 * cannot be read all land on `FAILED`, because the one thing this function must never do is
 * turn a successful payment into an error somewhere up the stack.
 */
export async function dispatchAdminNotification({
  verifiedStatus,
  message,
  credentials,
  fetchImpl = fetch,
}: DispatchAdminNotificationInput): Promise<NotifyOutcome> {
  if (verifiedStatus !== "PAID") return "SKIPPED_NOT_PAID";
  if (credentials === null) return "SKIPPED_NOT_CONFIGURED";

  try {
    const response = await fetchImpl(buildCallMeBotUrl(credentials, message), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(CALLMEBOT_TIMEOUT_MS),
    });

    return response.ok ? "SENT" : "FAILED";
  } catch {
    return "FAILED";
  }
}
