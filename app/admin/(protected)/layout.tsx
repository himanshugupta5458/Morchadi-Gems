import { headers } from "next/headers";
import type { ReactNode } from "react";
import {
  INTERNAL_ADMIN_PATH_HEADER,
  resolveAdminLoginHref,
  resolveAdminLogoutHref,
  resolveAdminOrdersHref,
  resolveAdminProductsHref,
  resolveAdminSection,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { requireAdminSession } from "@/lib/admin-session";
import { AdminDatabaseError } from "@/components/AdminDatabaseError";
import { AdminNav } from "@/components/AdminNav";

/**
 * Never prerendered: the answer depends on a cookie, and a cached one would be somebody
 * else's.
 */
export const dynamic = "force-dynamic";

/**
 * The authoritative session check, and the reason this route group exists.
 *
 * Middleware has already turned away browsers with no session cookie, but middleware runs on
 * the Edge runtime and can only see that *a* cookie was sent — a forged value gets past it.
 * This layout runs on Node, resolves the cookie against Postgres, and redirects anything that
 * does not name a live, unexpired session.
 *
 * The login page is deliberately outside this group, at `app/admin/login`, so it is not
 * guarded by the thing it exists to get past. Every page added inside `(protected)` inherits
 * the check by being here; the group adds no URL segment, so `app/admin/(protected)/page.tsx`
 * is still served at `/admin`. See
 * [ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md).
 *
 * It also carries the panel's nav, so the sections and the way out are present on every
 * protected page rather than on whichever one remembered to render them. The identity the
 * check already resolved is what the nav names, so this costs no extra query.
 *
 * **The database failing is handled here and not only in the pages.** This check runs before
 * any of them, against the same Postgres they read, so a layout that let the fault escape
 * would turn every carefully written error state below it into Next's generic 500 — and would
 * do it first. Nothing of the panel renders in that case, not even the nav: an unresolved
 * session is not a session ([ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await requireAdminSession();

  if (session.kind === "DATABASE_UNAVAILABLE") {
    return <AdminDatabaseError what="Your session, and everything behind it," />;
  }

  const admin = session.admin;
  const requestHeaders = headers();
  const hostname = resolveRequestHostname((name) => requestHeaders.get(name));
  const section = resolveAdminSection(requestHeaders.get(INTERNAL_ADMIN_PATH_HEADER));

  return (
    <div className="flex flex-col gap-8">
      <AdminNav
        username={admin.username}
        links={[
          {
            label: "Orders",
            href: resolveAdminOrdersHref(hostname),
            isCurrent: section === "orders",
          },
          {
            label: "Products",
            href: resolveAdminProductsHref(hostname),
            isCurrent: section === "products",
          },
        ]}
        logoutApiHref={resolveAdminLogoutHref(hostname)}
        signedOutHref={resolveAdminLoginHref(hostname)}
      />
      {children}
    </div>
  );
}
