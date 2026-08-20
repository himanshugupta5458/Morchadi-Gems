import type { AdminOrderStatusEvent } from "@/lib/admin-order-detail";
import { formatAdminOrderDate } from "@/lib/admin-orders";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

export interface AdminOrderTimelineProps {
  history: readonly AdminOrderStatusEvent[];
}

/**
 * Every `order_status_history` row for this order, oldest first.
 *
 * It is the whole table and not a summary. ADR-040 dropped `rtoAt`, `returnedAt` and
 * `cancelledAt` from `orders` precisely because *when* something happened is only half a fact
 * — the other halves are who did it and why — and this is the screen where all three are
 * shown together.
 *
 * Some rows repeat the status above them. Those are the address corrections: an address edit
 * is not a status change, so it writes a row carrying the order's unchanged status with a
 * reason naming what moved. Rendering them in the same list is deliberate — an operator asking
 * "what has been done to this order" wants one answer, not two.
 */
export function AdminOrderTimeline({ history }: AdminOrderTimelineProps): JSX.Element {
  if (history.length === 0) {
    return (
      <p className="text-body-sm text-muted">
        No history recorded. Every order captured at checkout gets its first row at capture
        time, so this order predates that.
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-line">
      {history.map((event) => (
        <li key={event.id} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <OrderStatusBadge status={event.status} />
            <span className="text-body-sm text-muted">
              {formatAdminOrderDate(event.changedAt)} · {event.changedBy}
            </span>
          </div>
          {event.reason === null ? null : (
            <p className="text-body-sm text-ink">{event.reason}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
