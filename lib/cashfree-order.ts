import "server-only";
import type { VerifyOrderResult } from "@/types/order";
import {
  CASHFREE_API_VERSION,
  getCashfreeOrderUrl,
  readCashfreeCredentials,
} from "@/lib/cashfree-config";
import { normaliseCashfreeOrder } from "@/lib/verify";

const CASHFREE_TIMEOUT_MS = 15_000;

/**
 * What asking Cashfree about one order can produce.
 *
 * `ok` covers every answer Cashfree actually gave, including "no such order" — that arrives
 * as a `NOT_FOUND` result rather than as a failure, because it is information. The two other
 * branches are the cases where we never got an answer at all, and they are kept apart because
 * they need different handling: a missing credential is a deployment fault that retrying will
 * not fix, while an unreachable gateway is worth asking about again.
 */
export type CashfreeOrderLookup =
  | { kind: "ok"; result: VerifyOrderResult }
  | { kind: "not-configured" }
  | { kind: "unreachable" };

/**
 * The single place this project asks Cashfree what happened to an order, shared by
 * `/api/verify-order` and `/api/notify-admin`.
 *
 * It is shared deliberately. The notification route has to answer the same question the
 * confirmation page asks — "was this genuinely paid?" — and a second implementation of that
 * question is a second thing that can drift into answering it more loosely. Both callers get
 * the same normalisation, the same timeout and the same treatment of a malformed body.
 *
 * `logPrefix` names the caller in the server log, so a failure is attributable to the route
 * that hit it.
 */
export async function lookupCashfreeOrder(
  orderId: string,
  logPrefix: string,
): Promise<CashfreeOrderLookup> {
  const credentials = readCashfreeCredentials();
  if (credentials === null) {
    console.error(`${logPrefix} CASHFREE_APP_ID or CASHFREE_SECRET_KEY is not set`);
    return { kind: "not-configured" };
  }

  let cashfreeResponse: Response;
  try {
    cashfreeResponse = await fetch(getCashfreeOrderUrl(orderId), {
      method: "GET",
      headers: {
        "X-Client-Id": credentials.appId,
        "X-Client-Secret": credentials.secretKey,
        "x-api-version": CASHFREE_API_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(CASHFREE_TIMEOUT_MS),
    });
  } catch (networkError) {
    console.error(`${logPrefix} ${orderId} could not reach Cashfree`, networkError);
    return { kind: "unreachable" };
  }

  const responseText = await cashfreeResponse.text();

  if (cashfreeResponse.status === 404) {
    console.error(`${logPrefix} ${orderId} is unknown to Cashfree`);
    return { kind: "ok", result: { orderId, status: "NOT_FOUND", amount: null } };
  }

  if (!cashfreeResponse.ok) {
    console.error(
      `${logPrefix} ${orderId} lookup rejected by Cashfree with ${cashfreeResponse.status}: ${responseText}`,
    );
    return { kind: "unreachable" };
  }

  let cashfreePayload: unknown;
  try {
    cashfreePayload = JSON.parse(responseText);
  } catch {
    console.error(`${logPrefix} ${orderId} came back from Cashfree unparseable: ${responseText}`);
    return { kind: "unreachable" };
  }

  const result = normaliseCashfreeOrder(cashfreePayload, orderId);

  /**
   * `PENDING` is not logged — the confirmation page polls, and a shopper on a slow bank page
   * would otherwise write ten lines per checkout. `FAILED` is, because an unrecognised
   * `order_status` also lands there and that is worth seeing.
   */
  if (result.status === "FAILED") {
    console.error(
      `${logPrefix} ${orderId} normalised to FAILED from order_status ${JSON.stringify(
        (cashfreePayload as Record<string, unknown> | null)?.order_status,
      )}`,
    );
  }

  return { kind: "ok", result };
}
