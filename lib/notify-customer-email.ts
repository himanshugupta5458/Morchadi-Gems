import "server-only";
import { Resend } from "resend";
import type { VerifiedOrderState } from "@/types/order";
import {
  composeCodOrderConfirmationEmail,
  composePaidOrderConfirmationEmail,
  type PaidOrderConfirmationEmailInput,
} from "@/lib/customer-email-message";
import type { CodOrderMessageInput } from "@/lib/notify-message";

const LOG_PREFIX = "[notify-customer-email]";

/**
 * Resend's own default base URL, restated here only so a test can recognise the request the
 * SDK makes on our behalf — the same role `CALLMEBOT_ENDPOINT` plays in `lib/notify.ts`. This
 * project never passes `baseUrl` to the `Resend` constructor, so this is always where a real
 * send actually goes.
 */
export const RESEND_API_ENDPOINT = "https://api.resend.com/emails";

/**
 * The address this project's transactional email is sent from. `updates.morchadijewels.com`
 * is verified in Resend (SPF and DKIM), so it is written once here rather than assembled from
 * `SITE_CONFIG.brandName` plus an environment variable — nothing about it is deployment-
 * specific the way `CASHFREE_ENV` or `ADMIN_HOSTNAME` are.
 */
export const ORDER_CONFIRMATION_FROM_ADDRESS =
  "Morchadi Gems <orders@updates.morchadijewels.com>";

/**
 * Eight seconds, against five for CallMeBot. Neither send is ever awaited by a shopper — the
 * COD branch fires this without a Cashfree redirect to hide behind, and the paid branch fires
 * it from the same browser call that already sends the owner's WhatsApp — so there is no UX
 * pressure keeping this as tight as `CALLMEBOT_TIMEOUT_MS`. It is still short and still finite:
 * an unbounded call would hold a promise open indefinitely on a path nothing ever awaits.
 */
export const RESEND_TIMEOUT_MS = 8_000;

/**
 * The owner's Resend key, or null when unset. Optional exactly like `CALLMEBOT_APIKEY`: this
 * is a convenience layered on top of a working checkout, and a deployment without it must sell
 * exactly as well as one with it.
 */
export function readResendApiKey(): string | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  return apiKey.length === 0 ? null : apiKey;
}

export interface ResendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface ResendSendResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

/** The one call this module makes to Resend, injectable so a send can be tested without a network. */
export type ResendSendFn = (payload: ResendEmailPayload) => Promise<ResendSendResult>;

function defaultResendSend(apiKey: string): ResendSendFn {
  const client = new Resend(apiKey);
  return (payload) => client.emails.send(payload);
}

/**
 * Resend's SDK does not accept an abort signal, so the timeout is enforced here instead of at
 * the request: whichever of the send or the timer settles first decides the outcome, and the
 * loser's timer (or its now-irrelevant response) is simply left to resolve on its own. This
 * gives the caller the same bounded wait `AbortSignal.timeout` gives `sendOwnerWhatsApp`,
 * without controlling a request this module cannot reach into.
 */
async function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("RESEND_TIMEOUT")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timedOut]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Every outcome of an email send. Mirrors `NotifyOutcome`, plus the one failure unique to email: no address to send to. */
export type EmailSendOutcome =
  | "SENT"
  | "SKIPPED_NO_EMAIL"
  | "SKIPPED_NOT_CONFIGURED"
  | "FAILED";

export interface SendCustomerEmailInput {
  to: string;
  subject: string;
  html: string;
  apiKey: string | null;
  /** Injected so a send can be tested without a network, and mocked in tests. */
  sendImpl?: ResendSendFn;
}

/**
 * The send itself, once something else has decided the email is warranted — the customer-email
 * sibling of `sendOwnerWhatsApp` in `lib/notify.ts`. It knows nothing about *why* it is being
 * called, only that it has been.
 *
 * Nothing here throws. A timeout, a refused connection, an error Resend reports and a missing
 * address all land on a logged, non-throwing outcome, because the one thing this function must
 * never do is turn a placed or paid order into an error somewhere up the stack.
 */
export async function sendCustomerEmail({
  to,
  subject,
  html,
  apiKey,
  sendImpl,
}: SendCustomerEmailInput): Promise<EmailSendOutcome> {
  if (apiKey === null) return "SKIPPED_NOT_CONFIGURED";
  if (to.trim().length === 0) return "SKIPPED_NO_EMAIL";

  const send = sendImpl ?? defaultResendSend(apiKey);

  try {
    const result = await raceTimeout(
      send({ from: ORDER_CONFIRMATION_FROM_ADDRESS, to, subject, html }),
      RESEND_TIMEOUT_MS,
    );
    return result.error === null ? "SENT" : "FAILED";
  } catch {
    return "FAILED";
  }
}

export interface CustomerEmailDependencies {
  /** Where the tracking link points, or null when it cannot be built. */
  trackingUrl: string | null;
  /** When the order was captured in Postgres, for the email's order-placed timestamp. Null when the captured row could not be read. */
  createdAt: Date | null;
  /** Defaults to `readResendApiKey()`. Overridden in tests so no environment variable is needed. */
  apiKey?: string | null;
  sendImpl?: ResendSendFn;
}

function logOutcome(orderName: string, outcome: EmailSendOutcome): void {
  if (outcome === "FAILED") {
    console.error(`${LOG_PREFIX} ${orderName} was placed but the confirmation email failed`);
  }
  if (outcome === "SKIPPED_NOT_CONFIGURED") {
    console.error(`${LOG_PREFIX} ${orderName} was placed but RESEND_API_KEY is not set`);
  }
  if (outcome === "SKIPPED_NO_EMAIL") {
    console.error(`${LOG_PREFIX} ${orderName} was placed but no customer email was on file`);
  }
  if (outcome === "SENT") {
    console.log(`${LOG_PREFIX} ${orderName} sent the customer a confirmation email`);
  }
}

/**
 * Emails the customer that a cash-on-delivery order has been placed. Fired from the same
 * branch of `/api/create-order` that calls `notifyOwnerOfCodOrder`, immediately after
 * `captureOrder` succeeds — the write is the warrant here exactly as it is for the owner's
 * WhatsApp, and for the same reason: no browser is involved, and the row's existence *is* the
 * verification. See [ADR-060](/docs/decisions/ADR-060-cod-order-notification.md).
 *
 * **Never throws.** Composition faults, a missing key, a Resend timeout and a reported error
 * all become a logged outcome. The caller does not await the result, for the same reason it
 * does not await the WhatsApp send: a cash-on-delivery checkout has already been written to
 * Postgres by the time this runs, and a notification is not permitted to become a new way for
 * a placed order to fail.
 */
export async function sendCodOrderConfirmationEmail(
  order: CodOrderMessageInput,
  { trackingUrl, createdAt, apiKey, sendImpl }: CustomerEmailDependencies = {
    trackingUrl: null,
    createdAt: null,
  },
): Promise<EmailSendOutcome> {
  try {
    const { subject, html } = composeCodOrderConfirmationEmail({ order, trackingUrl, createdAt });

    const outcome = await sendCustomerEmail({
      to: order.address.email,
      subject,
      html,
      apiKey: apiKey === undefined ? readResendApiKey() : apiKey,
      ...(sendImpl === undefined ? {} : { sendImpl }),
    });

    logOutcome(order.trackingId, outcome);
    return outcome;
  } catch (composeError) {
    console.error(
      `${LOG_PREFIX} ${order.trackingId} could not be turned into a confirmation email`,
      composeError,
    );
    return "FAILED";
  }
}

export interface DispatchOrderConfirmationEmailInput
  extends Omit<PaidOrderConfirmationEmailInput, "trackingUrl" | "createdAt"> {
  /** The status the *server* verified with Cashfree. Never a status the client asserted. */
  verifiedStatus: VerifiedOrderState;
}

/** Every outcome `sendCustomerEmail` can reach, plus the one guard that comes before it. */
export type DispatchEmailOutcome = EmailSendOutcome | "SKIPPED_NOT_PAID";

/**
 * Emails the customer for a **paid** order (prepaid in full, or the prepayment floor on a
 * partial-payment order) — the customer-email sibling of `dispatchAdminNotification`. It
 * shares that function's `PAID` guard and, deliberately, its warrant: this is called from
 * `/api/notify-admin` after the same Cashfree re-verification that authorises the owner's
 * WhatsApp, rather than building a second warrant mechanism for a second channel. See the
 * reasoning in [ADR-060](/docs/decisions/ADR-060-cod-order-notification.md) for why a second
 * warrant was rejected for the COD case; the same reasoning applies here.
 */
export async function dispatchOrderConfirmationEmail(
  { verifiedStatus, ...rest }: DispatchOrderConfirmationEmailInput,
  { trackingUrl, createdAt, apiKey, sendImpl }: CustomerEmailDependencies = {
    trackingUrl: null,
    createdAt: null,
  },
): Promise<DispatchEmailOutcome> {
  if (verifiedStatus !== "PAID") return "SKIPPED_NOT_PAID";

  try {
    const { subject, html } = composePaidOrderConfirmationEmail({ ...rest, trackingUrl, createdAt });
    const to = rest.bundle?.address.email ?? "";

    const outcome = await sendCustomerEmail({
      to,
      subject,
      html,
      apiKey: apiKey === undefined ? readResendApiKey() : apiKey,
      ...(sendImpl === undefined ? {} : { sendImpl }),
    });

    logOutcome(rest.trackingId ?? rest.cashfreeOrderId, outcome);
    return outcome;
  } catch (composeError) {
    console.error(
      `${LOG_PREFIX} ${rest.trackingId ?? rest.cashfreeOrderId} could not be turned into a confirmation email`,
      composeError,
    );
    return "FAILED";
  }
}
