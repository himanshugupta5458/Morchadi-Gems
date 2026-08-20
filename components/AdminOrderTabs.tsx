import Link from "next/link";
import type { AdminOrderView } from "@/lib/admin-orders";

export interface AdminOrderTab {
  view: AdminOrderView;
  label: string;
  href: string;
  isCurrent: boolean;
}

/**
 * Active and Resolved, as links rather than as a control.
 *
 * A tab that is a link is a tab that can be bookmarked, opened in a second window beside the
 * other one, and reached by the back button. It also keeps this page free of client JavaScript
 * — the whole list is server-rendered, and a tab is only a different URL for it.
 */
export function AdminOrderTabs({ tabs }: { tabs: readonly AdminOrderTab[] }): JSX.Element {
  return (
    <nav aria-label="Order views" className="flex items-center gap-6 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.view}
          href={tab.href}
          aria-current={tab.isCurrent ? "page" : undefined}
          className={
            tab.isCurrent
              ? "-mb-px border-b-2 border-ink pb-3 font-sans text-label uppercase tracking-caps text-ink"
              : "-mb-px border-b-2 border-transparent pb-3 font-sans text-label uppercase tracking-caps text-muted transition-colors duration-250 hover:text-ink"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
