import type { OrderStatus } from "@prisma/client";
import { getOrderStatusLabel, orderStatusBadgeClasses } from "@/lib/order-status";

/**
 * One status, coloured. The label is always rendered — the hue is what makes a list scannable,
 * never what makes it readable.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }): JSX.Element {
  return <span className={orderStatusBadgeClasses(status)}>{getOrderStatusLabel(status)}</span>;
}
