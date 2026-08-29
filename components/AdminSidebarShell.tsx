"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";

export interface AdminSidebarShellProps {
  /** What the toggle announces it opens, and the sidebar's accessible name. */
  label: string;
  children: ReactNode;
}

const SIDEBAR_ID = "admin-sidebar";

/**
 * The only interactive part of the panel's sidebar: whether it is on screen at phone width.
 *
 * **The sidebar's contents are not in this component.** They arrive as `children`, already
 * rendered by the Server Component that knows which section is current, so the links, the labels
 * and the highlight are HTML the server produced — this file adds a boolean and a button and
 * nothing else. That is the property the top nav had and the one worth keeping: navigating the
 * panel costs no JavaScript, and `usePathname` never enters the layout
 * ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 *
 * At `lg` and up the panel is always shown and the toggle is not rendered at all, so the open
 * state is dead weight on the viewport where a sidebar belongs permanently. `lg` is the same
 * breakpoint `ShopFilterDrawer` collapses at, for the same reason: it is the width at which a
 * fixed column beside the content stops costing the content its own.
 *
 * It is a disclosure rather than the storefront's modal drawer. A drawer earns its focus trap and
 * its scroll lock by covering the page; this is two links and a sign-out button, and pushing the
 * page down for as long as it is open is both less code and less to get wrong.
 */
export function AdminSidebarShell({ label, children }: AdminSidebarShellProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  /**
   * A link inside the panel closes it. The admin layout survives client-side navigation, so
   * without this the panel an operator opened to reach Products is still open when Products
   * arrives, covering the page they asked for.
   */
  function closeWhenALinkWasFollowed(event: MouseEvent<HTMLElement>): void {
    if ((event.target as HTMLElement).closest("a") !== null) setIsOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 lg:contents">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={SIDEBAR_ID}
        onClick={() => setIsOpen((previous) => !previous)}
        className="inline-flex items-center gap-2 self-start border border-line px-4 py-2 font-sans text-label uppercase tracking-caps text-ink transition-colors duration-250 hover:border-gold lg:hidden"
      >
        {isOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
        {label}
      </button>

      <div
        id={SIDEBAR_ID}
        onClick={closeWhenALinkWasFollowed}
        className={`${isOpen ? "block" : "hidden"} lg:block lg:sticky lg:top-12 lg:self-start`}
      >
        {children}
      </div>
    </div>
  );
}
