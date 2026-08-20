import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ADMIN_ORDER_VIEWS,
  buildAdminOrdersHref,
  findAdminOrderPage,
  hasActiveAdminOrderFilters,
  parseAdminOrderQuery,
  statusesForView,
  type AdminOrderSearchParams,
  type AdminOrderView,
} from "@/lib/admin-orders";
import {
  resolveAdminOrderHref,
  resolveAdminOrdersHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { AdminOrderFilters } from "@/components/AdminOrderFilters";
import { AdminOrderPagination } from "@/components/AdminOrderPagination";
import { AdminOrderTable } from "@/components/AdminOrderTable";
import { AdminOrderTabs } from "@/components/AdminOrderTabs";

/**
 * Never prerendered and never cached. The rows change whenever an order is placed or an
 * operator moves one, and a cached list is a list that hides the thing it exists to surface.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const VIEW_LABELS: Record<AdminOrderView, string> = {
  active: "Active",
  resolved: "Resolved",
};

/**
 * The order list — the panel's home, and the first screen in this project to read the tables
 * ADR-040 created.
 *
 * It is a Server Component that queries Prisma directly. There is no API route between the two
 * and there does not need to be: the request is already authenticated by
 * `app/admin/(protected)/layout.tsx`, which resolves the session cookie against Postgres before
 * this function runs, so an unauthenticated request never reaches this code. Adding a route
 * would mean re-establishing that same session from inside a second handler — a second auth
 * mechanism for one page, which ADR-041 exists to avoid.
 *
 * Every row links to `/admin/orders/{id}`, which **does not exist yet**. The detail page and
 * the status controls are the next prompt; the link is written now so the list does not have
 * to be revisited to gain one.
 *
 * The whole of the list's state — view, filters, sort, page — is in the URL, and nothing on
 * this page ships JavaScript to the browser.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: AdminOrderSearchParams;
}): Promise<JSX.Element> {
  const hostname = resolveRequestHostname((name) => headers().get(name));
  const ordersHref = resolveAdminOrdersHref(hostname);

  const query = parseAdminOrderQuery(searchParams);
  const { rows, totalCount, page, pageCount, pageSize } = await findAdminOrderPage(query);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const isFiltered = hasActiveAdminOrderFilters(query);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-heading text-ink">Orders</h1>
        <p className="text-body-sm text-muted">
          Every order captured at checkout, newest first. Active covers what is still moving;
          Resolved is everything that has finished, one way or another.
        </p>
      </div>

      <AdminOrderTabs
        tabs={ADMIN_ORDER_VIEWS.map((view) => ({
          view,
          label: VIEW_LABELS[view],
          href: buildAdminOrdersHref(ordersHref, query, { view, status: null }),
          isCurrent: view === query.view,
        }))}
      />

      <AdminOrderFilters
        action={ordersHref}
        query={query}
        statuses={statusesForView(query.view)}
        clearHref={
          isFiltered
            ? buildAdminOrdersHref(ordersHref, query, {
                status: null,
                search: "",
                from: "",
                to: "",
              })
            : null
        }
      />

      {rows.length === 0 ? (
        <p className="border border-line px-6 py-10 text-center text-body-sm text-muted">
          {isFiltered
            ? "No orders match these filters. Clear them to see the whole list."
            : `No ${VIEW_LABELS[query.view].toLowerCase()} orders yet.`}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <AdminOrderTable
            rows={rows}
            buildOrderHref={(orderId) => resolveAdminOrderHref(hostname, orderId)}
          />
          <AdminOrderPagination
            page={page}
            pageCount={pageCount}
            totalCount={totalCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            previousHref={
              page > 1 ? buildAdminOrdersHref(ordersHref, query, { page: page - 1 }) : null
            }
            nextHref={
              page < pageCount
                ? buildAdminOrdersHref(ordersHref, query, { page: page + 1 })
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
