import type { OrderStatus, PaymentType } from "@prisma/client";

/**
 * The lifecycle, written down once.
 *
 * `placed → packed → shipped` is the parcel moving, and `delivered`, `rto`, `returned` and
 * `cancelled` are the four ways it stops. Three rules are worth stating because each of them
 * was an explicit owner decision rather than an obvious default:
 *
 * **`cancelled` is reachable from `shipped`, not only from `placed` and `packed`.** The owner
 * said cancellation can happen "at any stage after placed" and did not exclude `shipped`. A
 * parcel in a courier's van is genuinely cancellable — the operator calls the courier, the
 * money goes back, and what the parcel does afterwards is an RTO the order no longer cares
 * about. Narrowing this to the two pre-dispatch statuses would have been the code deciding a
 * business rule the owner had already decided the other way.
 *
 * **`returned` is reachable only from `delivered`.** A parcel refused at the door never
 * arrived, and that is `rto`. A return is a customer who received the goods and sent them
 * back. The two need different money and different questions asked of the courier, so the one
 * transition that would blur them is absent.
 *
 * **The three bad endings lead nowhere, and `delivered` leads only to `returned`.** There is no
 * un-cancel and no un-RTO: an order that reached the wrong ending is a row to correct in the
 * database with its audit trail intact, not a button that quietly rewrites history. `delivered`
 * is the one outcome that is not the end of the story, because a parcel that arrived can still
 * come back.
 *
 * Nothing in Postgres enforces any of this — an enum column accepts any of its seven values in
 * any order. The rule lives here, is read by the UI to decide what to offer, and is read again
 * by the route handler to decide what to accept. See
 * [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "rto", "cancelled"],
  delivered: ["returned"],
  rto: [],
  returned: [],
  cancelled: [],
};

/** The statuses an order at `current` may be moved to, in the order the UI should offer them. */
export function nextOrderStatuses(current: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[current];
}

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

/**
 * The three outcomes that need explaining, and the three that carry a refund decision. They
 * are the same three, and deliberately one list: every status that ends an order badly is a
 * status where the money and the reason are the two questions somebody will ask later, and
 * splitting them into two constants would let one drift from the other.
 *
 * `placed`, `packed`, `shipped` and `delivered` need neither. "Why was it packed?" has no
 * answer worth typing, and nothing about packing moves money.
 */
export const UNHAPPY_ORDER_STATUSES: readonly OrderStatus[] = ["rto", "returned", "cancelled"];

export function requiresChangeReason(status: OrderStatus): boolean {
  return UNHAPPY_ORDER_STATUSES.includes(status);
}

export function requiresRefundDecision(status: OrderStatus): boolean {
  return UNHAPPY_ORDER_STATUSES.includes(status);
}

/**
 * Long enough for a sentence explaining a courier's failure code, short enough that the column
 * cannot be used as a notes field. The limit is checked on the server, not only by the input's
 * `maxLength`.
 */
export const MAX_STATUS_CHANGE_REASON_LENGTH = 300;

/**
 * When the shipping address may still be changed: before the parcel exists as far as the
 * courier is concerned.
 *
 * The owner's decision, stated plainly — a corrected address is only useful while somebody can
 * still write it on the label. Once the status is `shipped` the parcel is out, and a changed
 * address on the order would describe somewhere the goods are not going. Every terminal status
 * is likewise closed: an order that has been delivered, returned, cancelled or turned around
 * is a historical record, and editing where it was sent would be editing history.
 */
export const ADDRESS_EDITABLE_STATUSES: readonly OrderStatus[] = ["placed", "packed"];

export function isShippingAddressEditable(status: OrderStatus): boolean {
  return ADDRESS_EDITABLE_STATUSES.includes(status);
}

/**
 * When "item received back" is a question worth asking: after the goods have started coming
 * back, which is what `rto` and `returned` mean and what no other status means.
 *
 * The flag is not part of the status change that reaches one of them. A courier turns a parcel
 * around on Tuesday and the box lands on the shelf the following Monday, and the order has to
 * be able to record the second fact when it happens rather than at the moment the first was
 * recorded.
 */
export const ITEM_RETURN_STATUSES: readonly OrderStatus[] = ["rto", "returned"];

export function acceptsItemReceivedBack(status: OrderStatus): boolean {
  return ITEM_RETURN_STATUSES.includes(status);
}

/**
 * When "COD collected" is a question worth asking: when there is cash to collect at the door.
 * A prepaid order has none, which is why the toggle is absent rather than merely disabled on
 * one.
 */
export const COD_PAYMENT_TYPES: readonly PaymentType[] = ["cod", "partial_cod"];

export function acceptsCodCollection(paymentType: PaymentType): boolean {
  return COD_PAYMENT_TYPES.includes(paymentType);
}
