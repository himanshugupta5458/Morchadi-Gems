import Link from "next/link";
import type { AdminProductView } from "@/lib/admin-products";

export interface AdminProductTab {
  view: AdminProductView;
  label: string;
  href: string;
  isCurrent: boolean;
  count: number;
}

/**
 * The catalogue's four views, as links rather than as a control — the same reasoning
 * `AdminOrderTabs` gives. A tab that is a link can be bookmarked, opened in a second window
 * beside another, and reached by the back button, and it keeps this page free of client
 * JavaScript.
 *
 * Each tab carries its count, which the order tabs do not. An order list is short enough that
 * the tab and its contents are read together; a catalogue of 449 is not, and "Out of stock 6" is
 * the whole answer to the question that tab exists to ask, often without opening it.
 */
export function AdminProductTabs({ tabs }: { tabs: readonly AdminProductTab[] }): JSX.Element {
  return (
    <nav aria-label="Product views" className="flex flex-wrap items-center gap-6 border-b border-line">
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
          {tab.label}{" "}
          <span className={tab.isCurrent ? "text-muted" : "text-line"}>{tab.count}</span>
        </Link>
      ))}
    </nav>
  );
}
