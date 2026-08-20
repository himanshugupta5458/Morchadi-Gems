import { notFound } from "next/navigation";

/**
 * The route that exists so the shop's 404 can be the *storefront's* 404.
 *
 * Next resolves an address matching no route against `app/not-found.tsx` — the root of the
 * file tree, above both route groups. A 404 written there is therefore outside the shop's
 * layout and has to reassemble the header, footer and cart itself; worse, whatever tree it
 * renders is serialised into the payload of **every** route in the application, including every
 * admin page, as the subtree to swap in should that page call `notFound()`. That is how the
 * shop's chrome and the whole catalogue index — 22 KB of the admin login page's 39 — kept
 * travelling with the panel after the layouts were split.
 *
 * This catch-all gives an unmatched address a route to land on *inside* the storefront group,
 * where calling `notFound()` resolves to `app/(storefront)/not-found.tsx` and renders in the
 * shop's own layout. It is the lowest-priority match in the router, so it can only ever be
 * reached by an address nothing else claimed. See
 * [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 */
export default function UnmatchedStorefrontRoute(): never {
  notFound();
}
