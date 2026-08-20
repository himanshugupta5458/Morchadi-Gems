import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/admin-session";

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
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  await requireAdminSession();

  return <>{children}</>;
}
