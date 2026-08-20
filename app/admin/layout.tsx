import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The panel's own title template, and `noindex, nofollow` on every route beneath `/admin`.
 *
 * The robots tag is the third and innermost of three independent guards against the panel
 * being indexed — `robots.txt` disallows the path on the storefront domain, the admin hostname
 * serves its own deny-all `robots.txt`, and this tag travels with the page itself however it
 * was reached.
 *
 * The template is stated here rather than inherited because the storefront's is now scoped to
 * the storefront: an admin screen is not a shop page and "Orders · Morchadi Gems" reads like
 * one. See [ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md) and
 * [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 */
export const metadata: Metadata = {
  title: {
    default: "Morchadi Gems admin",
    template: "%s · Morchadi Gems admin",
  },
  robots: { index: false, follow: false },
};

/**
 * The panel's shell, and a sibling of the storefront's rather than a child of it.
 *
 * Until this layout the admin routes sat inside the shop's root layout, which is a thing a
 * nested layout cannot decline: `/admin` rendered with the shop header above it, the footer
 * below it, and the floating WhatsApp button sitting over its bottom-right corner. Moving the
 * storefront into its own route group (`app/(storefront)`) is what made this file a shell in
 * its own right instead of a padded `<div>` inside somebody else's.
 *
 * It wraps **both** halves of the panel — the login page at `app/admin/login` and everything
 * under `app/admin/(protected)` — because signing in is as much the panel as the order list
 * is, and a login screen with a shop header on it was the same bug wearing a different hat.
 * The session check stays in the protected group, where it belongs; this layout is chrome and
 * asks nothing about who is asking.
 */
export default function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main className="flex-1 bg-white">
      <div className="container py-12 lg:py-16">{children}</div>
    </main>
  );
}
