import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAdminOrdersHref, resolveRequestHostname } from "@/lib/admin-routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * The panel's root, which is not a page.
 *
 * This was the "Logged in as …" placeholder that the authentication prompt shipped to prove a
 * session resolves to a named admin. That proof now lives in the nav bar, which names the
 * signed-in operator on every protected page, so keeping a second screen to say the same thing
 * would put a menu between signing in and the only work there is to do. The order list is the
 * panel's home; `/admin` is the address that takes you there.
 */
export default function AdminRootPage(): never {
  redirect(resolveAdminOrdersHref(resolveRequestHostname((name) => headers().get(name))));
}
