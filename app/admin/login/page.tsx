import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  resolveAdminHomeHref,
  resolveAdminLoginApiHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { SITE_CONFIG } from "@/lib/config";
import { AdminLoginForm } from "@/components/AdminLoginForm";

/**
 * Never prerendered and never cached: the two URLs below depend on the hostname the request
 * arrived on, which is the whole mechanism by which one deployment serves two domains.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage(): JSX.Element {
  const hostname = resolveRequestHostname((name) => headers().get(name));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <div className="flex flex-col gap-3 text-center">
        <span className="text-eyebrow uppercase tracking-caps text-muted">
          {SITE_CONFIG.brandName}
        </span>
        <h1 className="font-display text-heading text-ink">Admin sign in</h1>
        <span aria-hidden className="mx-auto block h-px w-12 bg-gold" />
      </div>

      <AdminLoginForm
        loginApiHref={resolveAdminLoginApiHref(hostname)}
        signedInHref={resolveAdminHomeHref(hostname)}
      />
    </div>
  );
}
