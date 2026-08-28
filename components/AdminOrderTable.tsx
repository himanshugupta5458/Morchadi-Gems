import Link from "next/link";
import type { AdminOrderRow } from "@/lib/admin-orders";
import { formatAdminOrderDate } from "@/lib/admin-orders";
import { formatRupees } from "@/lib/format";
import { getPaymentTypeLabel } from "@/lib/order-status";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

export interface AdminOrderTableProps {
  rows: readonly AdminOrderRow[];
  buildOrderHref: (orderId: string) => string;
}

const HEADER_CELL_CLASSES =
  "whitespace-nowrap px-4 py-3 text-left font-sans text-eyebrow uppercase tracking-caps-wide text-muted";

const CELL_CLASSES = "px-4 py-4 align-middle text-body-sm text-ink";

/**
 * The order list itself.
 *
 * The order number is the first column and is the link, because it is the identifier every
 * other surface — a WhatsApp message, a courier label, the tracking page — will be keyed on.
 * The Cashfree id is not here at all: it is the payment's name, not the order's, and a list
 * carrying both would invite the wrong one to be quoted.
 *
 * The table scrolls inside its own container on a narrow screen rather than reflowing into
 * cards. Eight columns of an operational list are read *across* — a row is one order and the
 * comparison being made is between rows — and stacking them destroys that.
 *
 * `Due` sits beside `Total` because the two are read together or not at all, and it is blank
 * rather than `₹0` on a prepaid order: a column of zeroes is a column an operator learns to
 * skip, and the whole reason this one exists is that the few rows with a figure in it have
 * money outstanding that nothing in this panel will collect for them.
 */
export function AdminOrderTable({ rows, buildOrderHref }: AdminOrderTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[62rem] border-collapse">
        <thead className="border-b border-line bg-ivory">
          <tr>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Order
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Placed
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Customer
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Phone
            </th>
            <th scope="col" className={`${HEADER_CELL_CLASSES} text-right`}>
              Total
            </th>
            <th scope="col" className={`${HEADER_CELL_CLASSES} text-right`}>
              Due
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Payment
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-line last:border-b-0 transition-colors duration-250 hover:bg-ivory"
            >
              <td className={CELL_CLASSES}>
                <Link
                  href={buildOrderHref(row.id)}
                  className="font-sans tracking-caps text-ink underline underline-offset-4 transition-colors duration-250 hover:text-gold"
                >
                  {row.id}
                </Link>
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-muted`}>
                {formatAdminOrderDate(row.createdAt)}
              </td>
              <td className={CELL_CLASSES}>{row.customerName}</td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-muted`}>
                {row.customerPhone}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-right`}>
                {formatRupees(row.total)}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-right`}>
                {row.amountDue > 0 ? (
                  <span className="font-medium text-gold-deep">
                    {formatRupees(row.amountDue)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-muted`}>
                {getPaymentTypeLabel(row.paymentType)}
              </td>
              <td className={CELL_CLASSES}>
                <OrderStatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
