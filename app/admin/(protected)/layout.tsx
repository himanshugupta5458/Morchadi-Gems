import { headers } from "next/headers";
import type { ReactNode } from "react";
import {
  resolveAdminLoginHref,
  resolveAdminLogoutHref,
  resolveAdminOrdersHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { requireAdminSession } from "@/lib/admin-session";
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
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const admin = await requireAdminSession();
  const hostname = resolveRequestHostname((name) => headers().get(name));

  return (
    <div className="flex flex-col gap-8">
      <AdminNav
        username={admin.username}
        links={[
          { label: "Orders", href: resolveAdminOrdersHref(hostname), isCurrent: true },
        ]}
        logoutApiHref={resolveAdminLogoutHref(hostname)}
        signedOutHref={resolveAdminLoginHref(hostname)}
      />
      {children}
    </div>
  );
}
