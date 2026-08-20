import type {
  AdminOrderActionResponseBody,
  AdminOrderActionResult,
} from "@/types/admin-order";

const NETWORK_FAILURE_MESSAGE =
  "That change did not reach the server. Check the connection and try again.";

const UNEXPECTED_FAILURE_MESSAGE = "That change was refused, and the server did not say why.";

/**
 * Posts one order action and reduces every way it can go to two: it worked, or here is the
 * sentence to show.
 *
 * JSON rather than a form submission — see `readJsonObject` in `lib/admin-order-api.ts` for
 * why the content type is part of the CSRF story. A 401 is the interesting failure: a session
 * expires after seven days and the operator will be looking at a page that rendered while it
 * was still alive, so the message says to sign in again rather than reporting a validation
 * error that never happened.
 *
 * Not `server-only` and not `"use client"`: it is a plain module that only client components
 * import, and it touches nothing but `fetch`.
 */
export async function submitAdminOrderAction(
  href: string,
  payload: Record<string, unknown>,
): Promise<AdminOrderActionResult> {
  let response: Response;

  try {
    response = await fetch(href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: NETWORK_FAILURE_MESSAGE };
  }

  let body: AdminOrderActionResponseBody;

  try {
    body = (await response.json()) as AdminOrderActionResponseBody;
  } catch {
    body = { status: "REJECTED" };
  }

  if (response.ok && body.status !== "REJECTED") return { ok: true };

  return { ok: false, message: body.message ?? UNEXPECTED_FAILURE_MESSAGE };
}
