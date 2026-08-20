/**
 * The one response shape every admin order action answers with, shared by the route handlers
 * that produce it and the client components that read it.
 *
 * It lives in `/types` rather than beside the handlers because `lib/admin-order-api.ts` is
 * `server-only` — importing a type from it into a `"use client"` file would be a build error,
 * and the panel's forms need to know what a rejection looks like.
 */
export interface AdminOrderActionResponseBody {
  status: "UPDATED" | "UNCHANGED" | "REJECTED";
  error?: string;
  message?: string;
}

/** What a submitted action did, as a form needs to know it. */
export type AdminOrderActionResult =
  | { ok: true }
  | { ok: false; message: string };
