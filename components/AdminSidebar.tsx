import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { AdminSidebarShell } from "@/components/AdminSidebarShell";
import { AdminSignOutButton } from "@/components/AdminSignOutButton";

export interface AdminSidebarLink {
  label: string;
  href: string;
  isCurrent: boolean;
}

export interface AdminSidebarProps {
  username: string;
  links: readonly AdminSidebarLink[];
  logoutApiHref: string;
  signedOutHref: string;
}

/**
 * The panel's chrome, down the left instead of across the top: where you are, who you are, and the
 * way out.
 *
 * A Server Component, and the reason the sidebar costs no JavaScript to navigate. The current
 * section arrives as `isCurrent` on each link, resolved in the layout from the
 * `x-admin-internal-path` header middleware sets — not from `usePathname`, which would pull this
 * whole tree across the client boundary to learn one string the server already knew
 * (ADR-041, [ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 *
 * The two interactive pieces are islands of their own: `AdminSidebarShell` holds the phone-width
 * open state, and `AdminSignOutButton` posts. Everything between them is HTML.
 *
 * A vertical list rather than a row, because it is the shape that does not have to be redesigned
 * when a third section is added — the top nav could take one more entry and not two. The list
 * comes from `resolveAdminSectionLinks`, so this component never learns what a section is.
 */
export function AdminSidebar({
  username,
  links,
  logoutApiHref,
  signedOutHref,
}: AdminSidebarProps): JSX.Element {
  return (
    <AdminSidebarShell label="Menu">
      <aside
        aria-label="Admin panel"
        className="flex flex-col gap-8 border border-line bg-ivory px-5 py-6"
      >
        <div className="flex flex-col gap-1">
          <span className="font-display text-heading-sm text-ink">{SITE_CONFIG.brandName}</span>
          <span className="text-eyebrow uppercase tracking-caps-wide text-muted">admin</span>
        </div>

        <nav aria-label="Admin sections">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={link.isCurrent ? "page" : undefined}
                  className={
                    link.isCurrent
                      ? "block border-l-2 border-gold bg-white px-4 py-2.5 font-sans text-label uppercase tracking-caps text-ink"
                      : "block border-l-2 border-transparent px-4 py-2.5 font-sans text-label uppercase tracking-caps text-muted transition-colors duration-250 hover:border-line hover:text-ink"
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col items-start gap-3 border-t border-line pt-5">
          <span className="text-body-sm text-muted">
            Signed in as <span className="text-ink">{username}</span>
          </span>
          <AdminSignOutButton logoutApiHref={logoutApiHref} signedOutHref={signedOutHref} />
        </div>
      </aside>
    </AdminSidebarShell>
  );
}
