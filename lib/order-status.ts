import type { OrderStatus, PaymentType } from "@prisma/client";

/**
 * The seven `OrderStatus` values in the order an order moves through them, terminal states
 * last. Written out rather than derived from Prisma's generated enum object because this is
 * the *display* order, and the schema's declaration order is free to change without the admin
 * list rearranging itself.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "placed",
  "packed",
  "shipped",
  "delivered",
  "rto",
  "returned",
  "cancelled",
];

/**
 * The three statuses that still need something done to them, and the four that do not.
 *
 * This split is the whole of the Active/Resolved division in the admin list. It is exhaustive
 * and disjoint over `ORDER_STATUSES` — proved in the tests rather than assumed — so every
 * order appears in exactly one of the two views and none can hide between them.
 */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ["placed", "packed", "shipped"];

export const RESOLVED_ORDER_STATUSES: readonly OrderStatus[] = [
  "delivered",
  "rto",
  "returned",
  "cancelled",
];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  rto: "RTO",
  returned: "Returned",
  cancelled: "Cancelled",
};

/**
 * `rto` is the one label that is not simply the enum value capitalised: it is an abbreviation
 * the courier industry uses and the owner already says out loud, and "Rto" would read as a
 * typo of it.
 */
export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  prepaid: "Prepaid",
  cod: "COD",
  partial_cod: "Partial COD",
};

export function getPaymentTypeLabel(paymentType: PaymentType): string {
  return PAYMENT_TYPE_LABELS[paymentType];
}

/**
 * One hue per status, from the `status-*` group in `tailwind.config.ts`.
 *
 * Colour is the point. An operator scanning fifty rows is looking for the two that moved, and
 * seven labels set in one style would make them read every row instead of seeing the shape of
 * the list. Each status therefore gets its own hue rather than a shared "in progress" or
 * "terminal" colour: `rto` and `returned` mean different things to the person deciding whether
 * to refund, and a badge that cannot tell them apart is worse than no badge.
 *
 * The recipe is identical across all seven — a 10% wash, a 35% border and the full-strength
 * hue as the text — so the badges read as one family and the hue is the only variable. Colour
 * is never the only signal: the label is always written out beside it, for a monochrome
 * printout as much as for anyone who cannot tell two of these hues apart.
 */
const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  placed: "border-status-placed/35 bg-status-placed/10 text-status-placed",
  packed: "border-status-packed/35 bg-status-packed/10 text-status-packed",
  shipped: "border-status-shipped/35 bg-status-shipped/10 text-status-shipped",
  delivered: "border-status-delivered/35 bg-status-delivered/10 text-status-delivered",
  rto: "border-status-rto/35 bg-status-rto/10 text-status-rto",
  returned: "border-status-returned/35 bg-status-returned/10 text-status-returned",
  cancelled: "border-status-cancelled/35 bg-status-cancelled/10 text-status-cancelled",
};

const ORDER_STATUS_BADGE_BASE =
  "inline-flex items-center border px-2.5 py-1 font-sans text-[0.6875rem] font-medium uppercase tracking-caps";

/**
 * The full class string for one status badge. Shared by the admin list, the style guide and —
 * since ADR-071 — the customer's tracking timeline, so no two surfaces can show different
 * colours for the same status.
 *
 * The customer surface reuses the classes and **not** the labels: `getOrderStatusLabel` says
 * "RTO", which is what the owner needs on a list of fifty orders and means nothing to the
 * person who was waiting for the parcel. `getCustomerOrderStatusLabel` says "Came back to us".
 * The hue is the part worth sharing, because it is the part that says these seven outcomes are
 * different from each other.
 */
export function orderStatusBadgeClasses(status: OrderStatus): string {
  return `${ORDER_STATUS_BADGE_BASE} ${ORDER_STATUS_BADGE_CLASSES[status]}`;
}

const ORDER_STATUS_MARKER_CLASSES: Record<OrderStatus, string> = {
  placed: "border-status-placed bg-status-placed",
  packed: "border-status-packed bg-status-packed",
  shipped: "border-status-shipped bg-status-shipped",
  delivered: "border-status-delivered bg-status-delivered",
  rto: "border-status-rto bg-status-rto",
  returned: "border-status-returned bg-status-returned",
  cancelled: "border-status-cancelled bg-status-cancelled",
};

/**
 * The same seven hues at full strength, for a filled dot rather than a washed chip.
 *
 * A timeline marker has no room for a label inside it, so this is the one place colour carries
 * information alone — which is why the label is always written directly under the dot it
 * belongs to, and why the dot is never the only thing distinguishing two steps.
 */
export function orderStatusMarkerClasses(status: OrderStatus): string {
  return ORDER_STATUS_MARKER_CLASSES[status];
}
