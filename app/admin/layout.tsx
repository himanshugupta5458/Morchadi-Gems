import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `noindex, nofollow` on every route beneath `/admin`, which is the third and innermost of
 * three independent guards against the panel being indexed — `robots.txt` disallows the path
 * on the storefront domain, the admin hostname serves its own deny-all `robots.txt`, and this
 * tag travels with the page itself however it was reached. See
 * [ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md).
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * The panel's shell. It sits inside the storefront's root layout for now, so the shop header
 * and footer still surround it; separating the two means a second root layout, which means
 * moving every storefront route into a route group, and that belongs with the prompt that
 * builds the order-management UI rather than this one.
 */
export default function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  return <div className="container py-16 lg:py-20">{children}</div>;
}
