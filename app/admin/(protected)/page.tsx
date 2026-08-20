import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  resolveAdminLoginHref,
  resolveAdminLogoutHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { requireAdminSession } from "@/lib/admin-session";
import { AdminSignOutButton } from "@/components/AdminSignOutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * The placeholder the authentication foundation exists to protect. It proves a session
 * resolves to a named admin and that signing out works; the order-management screens that
 * will replace it are a later prompt.
 */
export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const admin = await requireAdminSession();
  const hostname = resolveRequestHostname((name) => headers().get(name));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 text-center">
      <div className="flex flex-col gap-3">
        <span className="text-eyebrow uppercase tracking-caps text-muted">Signed in</span>
        <h1 className="font-display text-heading text-ink">
          Logged in as <span className="italic text-gold">{admin.username}</span>
        </h1>
        <span aria-hidden className="mx-auto block h-px w-12 bg-gold" />
      </div>

      <p className="text-body text-muted">
        Order management lands here in a later prompt. For now this page only confirms that a
        session was issued, stored and read back.
      </p>

      <AdminSignOutButton
        logoutApiHref={resolveAdminLogoutHref(hostname)}
        signedOutHref={resolveAdminLoginHref(hostname)}
      />
    </div>
  );
}
