import Link from "next/link";
import { AdminSignOutButton } from "@/components/AdminSignOutButton";

export interface AdminNavLink {
  label: string;
  href: string;
  isCurrent: boolean;
}

export interface AdminNavProps {
  username: string;
  links: readonly AdminNavLink[];
  logoutApiHref: string;
  signedOutHref: string;
}

/**
 * The panel's one piece of chrome: where you are, who you are, and the way out.
 *
 * It lives in the protected layout rather than on each page so signing out is reachable from
 * wherever an operator happens to be. Before this, the sign-out button sat on the placeholder
 * dashboard, which meant leaving the order list to leave the panel.
 *
 * A Server Component. The only interactive thing here is the sign-out button, which is a
 * Client Component of its own, so the boundary stops at it.
 */
export function AdminNav({
  username,
  links,
  logoutApiHref,
  signedOutHref,
}: AdminNavProps): JSX.Element {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3">
        <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
          Morchadi Gems admin
        </span>
        <nav aria-label="Admin sections" className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.isCurrent ? "page" : undefined}
              className={
                link.isCurrent
                  ? "border-b-2 border-gold pb-1 font-sans text-label uppercase tracking-caps text-ink"
                  : "border-b-2 border-transparent pb-1 font-sans text-label uppercase tracking-caps text-muted transition-colors duration-250 hover:text-ink"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-body-sm text-muted">
          Signed in as <span className="text-ink">{username}</span>
        </span>
        <AdminSignOutButton
          logoutApiHref={logoutApiHref}
          signedOutHref={signedOutHref}
        />
      </div>
    </header>
  );
}
