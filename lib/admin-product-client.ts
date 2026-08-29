import type {
  AdminProductActionResponseBody,
  AdminProductActionResult,
  ProductEdit,
} from "@/types/admin-product";

const NETWORK_FAILURE_MESSAGE =
  "That save did not reach the server. Check the connection and try again.";

const UNEXPECTED_FAILURE_MESSAGE = "That save was refused, and the server did not say why.";

/**
 * Sends one product edit and reduces every way it can go to two: it worked, or here is what to
 * show.
 *
 * `PATCH` rather than `POST`, and JSON rather than a form encoding. The content type is doing CSRF
 * work alongside the `SameSite=Lax` cookie, exactly as `submitAdminOrderAction` describes: a
 * cross-site `<form>` cannot send `application/json` without a preflight the browser will not
 * grant. `PATCH` is not reachable from a `<form>` at all, which is a second lock on the same door.
 *
 * A 401 is the interesting failure — a session expires after seven days and the operator will be
 * looking at a form that rendered while it was still alive — so the message says to sign in again
 * rather than reporting a validation error that never happened.
 *
 * Not `server-only` and not `"use client"`: a plain module that only client components import,
 * touching nothing but `fetch`.
 */
export async function submitAdminProductEdit(
  href: string,
  payload: { edit: ProductEdit; expectedVersion: string },
): Promise<AdminProductActionResult> {
  let response: Response;

  try {
    response = await fetch(href, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: NETWORK_FAILURE_MESSAGE, failures: [] };
  }

  let body: AdminProductActionResponseBody;

  try {
    body = (await response.json()) as AdminProductActionResponseBody;
  } catch {
    body = { status: "REJECTED" };
  }

  if (response.ok && body.status !== "REJECTED") {
    return {
      ok: true,
      status: body.status,
      version: body.version ?? null,
      advisories: body.advisories ?? [],
    };
  }

  return {
    ok: false,
    message: body.message ?? UNEXPECTED_FAILURE_MESSAGE,
    failures: body.failures ?? [],
  };
}
