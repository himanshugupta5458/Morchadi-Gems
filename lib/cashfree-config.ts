import "server-only";
import type { CashfreeMode } from "@/types/order";
import { CHECKOUT_CONFIRMATION_PATH } from "@/lib/navigation";

/**
 * The Cashfree API version this project is written against, sent as `x-api-version` on every
 * request. Cashfree versions its API by date and changes response shapes between versions,
 * so it is pinned here rather than left to a default.
 *
 * Importing this module from a `"use client"` file is a build error rather than a
 * code-review catch — that is what the `server-only` import above buys, and it is why the
 * Cashfree credentials live here instead of in `lib/config.ts`, which client components
 * import freely.
 */
export const CASHFREE_API_VERSION = "2025-01-01";

const CASHFREE_BASE_URLS: Record<CashfreeMode, string> = {
  sandbox: "https://sandbox.cashfree.com",
  production: "https://api.cashfree.com",
};

const LOCAL_BASE_URL = "http://localhost:3000";

/**
 * Anything other than the exact string `production` resolves to sandbox. A typo, a blank
 * value, or a forgotten variable therefore fails towards test money rather than towards real
 * charges; going live is an explicit act.
 */
export function resolveCashfreeMode(): CashfreeMode {
  const configuredMode = process.env.CASHFREE_ENV?.trim().toLowerCase();
  return configuredMode === "production" ? "production" : "sandbox";
}

export function getCashfreeBaseUrl(): string {
  return CASHFREE_BASE_URLS[resolveCashfreeMode()];
}

export function getCashfreeOrdersUrl(): string {
  return `${getCashfreeBaseUrl()}/pg/orders`;
}

/**
 * The read-back URL for one order. The id becomes a path segment, so it is encoded here as
 * well as validated by the caller — two independent guards on the one value that reaches this
 * URL from a query string.
 */
export function getCashfreeOrderUrl(orderId: string): string {
  return `${getCashfreeOrdersUrl()}/${encodeURIComponent(orderId)}`;
}

export interface CashfreeCredentials {
  appId: string;
  secretKey: string;
}

/**
 * Null when either credential is missing, so the caller reports "payments are not
 * configured" instead of sending an unauthenticated request and relaying whatever Cashfree
 * says about it. The values are never logged and never returned to the browser.
 */
export function readCashfreeCredentials(): CashfreeCredentials | null {
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim();

  if (appId === undefined || appId.length === 0) return null;
  if (secretKey === undefined || secretKey.length === 0) return null;

  return { appId, secretKey };
}

function normaliseBaseUrl(candidate: string): string | null {
  const trimmed = candidate.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * The origin Cashfree sends the customer back to. It has to be absolute and it has to be
 * *this* deployment, so a configured value wins over the request's own origin: behind a
 * proxy the request host can be an internal name the shopper's browser cannot reach.
 *
 * `APP_BASE_URL` is preferred over `NEXT_PUBLIC_BASE_URL` because the return URL is a
 * server-side concern; the public variable is the fallback so a project that only sets that
 * one still works. The request origin is the last resort, and localhost the one after that.
 */
export function resolveAppBaseUrl(requestUrl: string): string {
  const configuredBaseUrl =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "";

  return (
    normaliseBaseUrl(configuredBaseUrl) ??
    normaliseBaseUrl(requestUrl) ??
    LOCAL_BASE_URL
  );
}

export function buildReturnUrl(requestUrl: string, orderId: string): string {
  const baseUrl = resolveAppBaseUrl(requestUrl);
  const orderIdParameter = encodeURIComponent(orderId);
  return `${baseUrl}${CHECKOUT_CONFIRMATION_PATH}?order_id=${orderIdParameter}`;
}
