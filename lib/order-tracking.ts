import "server-only";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { normaliseOrderId } from "@/lib/admin-order-detail";
import { ORDER_ID_ALPHABET, ORDER_ID_LENGTH } from "@/lib/order-id";
import { prisma } from "@/lib/prisma";

/**
 * One row of the customer-facing timeline: what the order became, and when.
 *
 * `changedBy` and `reason` are **absent by design**, and absent from the query that builds
 * this as well as from the type. They are the two columns the admin timeline exists to show —
 * which operator moved the order and what they typed about a courier's failure code — and
 * neither is a fact about the parcel that the person waiting for it is owed. Adding either
 * here would be a leak, not a feature; see
 * [ADR-045](/docs/decisions/ADR-045-public-order-tracking.md).
 */
export interface PublicOrderStatusEvent {
  status: OrderStatus;
  changedAt: Date;
}

/** Money that has gone back, when any has. Never the reason it went back. */
export interface PublicOrderRefund {
  amount: number;
  refundedAt: Date | null;
}

/**
 * Everything `/track` is allowed to know about an order, which is everything it needs and
 * nothing else: the number that was typed in, when it was placed, where it is, how it got
 * there, and whether money has been returned.
 *
 * There is no customer name, no phone number, no address, no line item, no payment type, no
 * Cashfree identifier and no cost figure — not omitted at render time but never selected, so
 * no future edit to a component can put one on the page.
 */
export interface PublicOrderTracking {
  id: string;
  placedAt: Date;
  status: OrderStatus;
  history: PublicOrderStatusEvent[];
  refund: PublicOrderRefund | null;
}

const ORDER_ID_CHARACTERS = new Set(Array.from(ORDER_ID_ALPHABET));

/**
 * Whether a typed string could be one of our order numbers at all: ten characters, all of them
 * from the alphabet `lib/order-id.ts` mints ids over.
 *
 * It exists to spare the database a query for input that cannot match, and for nothing else.
 * A string this rejects and a string that simply names no order produce the *same* answer to
 * the caller, so this is not a validator whose failure a shopper can observe — checking the
 * shape and then saying so would tell someone probing the box exactly what shape to probe with.
 */
export function isPlausibleOrderId(candidate: string): boolean {
  if (candidate.length !== ORDER_ID_LENGTH) return false;
  return Array.from(candidate).every((character) => ORDER_ID_CHARACTERS.has(character));
}

/**
 * Consecutive rows carrying the same status, reduced to the first of them.
 *
 * `order_status_history` is an audit table, not a customer timeline: an address correction
 * writes a row holding the order's *unchanged* status with a reason naming what moved, which
 * is exactly right for the operator's screen and reads as "Order placed, Order placed" on
 * this one. Keeping the earliest of a run is what makes the remaining date the date the
 * status was actually reached.
 */
export function collapseRepeatedStatuses(
  events: readonly PublicOrderStatusEvent[],
): PublicOrderStatusEvent[] {
  return events.filter(
    (event, index) => index === 0 || events[index - 1]?.status !== event.status,
  );
}

export type PublicOrderTrackingClient = Pick<PrismaClient, "order">;

const LOG_PREFIX = "[order-tracking]";

async function findTrackedOrderRow(client: PublicOrderTrackingClient, orderId: string) {
  try {
    return await client.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        createdAt: true,
        status: true,
        isRefunded: true,
        refundedAt: true,
        refundAmount: true,
        statusHistory: {
          orderBy: [{ changedAt: "asc" }, { id: "asc" }],
          select: { status: true, changedAt: true },
        },
      },
    });
  } catch (lookupError) {
    console.error(`${LOG_PREFIX} ${orderId} could not be looked up in Postgres`, lookupError);
    return null;
  }
}

/**
 * One order as a customer may see it, or null.
 *
 * The lookup is `normaliseOrderId` from the admin detail module — the same helper, imported
 * rather than rewritten, so the two surfaces cannot come to different conclusions about
 * whether `w2acehacuu` and `W2ACEHACUU` are the same order. Ids are minted from an uppercase
 * alphabet and arrive here off a phone screen, out of a chat client that lowercased them, or
 * typed with a stray space either side.
 *
 * Null covers every way this can fail to find something: a malformed id, a well-formed id
 * nobody was ever given, an id belonging to an order whose Postgres capture failed, and a
 * database that did not answer at all. The caller renders one message for all four
 * ([`ORDER_NOT_FOUND_MESSAGE`](./order-tracking-copy.ts)).
 *
 * That last case is why this **never throws**, the same discipline and for the same reason as
 * [`findCapturedOrderForPaymentReference`](./order-capture.ts): `/track` is a public page, the person
 * on it is a customer holding a parcel number, and an outage in a database they have never
 * heard of is not their problem to read a stack trace about. They are told the lookup did not
 * work in the words the page already uses for a number that names nothing — which is all they
 * can act on either way — and the reason goes to the log, where the person who can fix it is
 * looking. See [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md).
 */
export async function findPublicOrderTracking(
  submittedOrderId: string,
  client: PublicOrderTrackingClient = prisma,
): Promise<PublicOrderTracking | null> {
  const orderId = normaliseOrderId(submittedOrderId);
  if (!isPlausibleOrderId(orderId)) return null;

  const order = await findTrackedOrderRow(client, orderId);

  if (order === null) return null;

  const refundAmount = order.refundAmount === null ? null : order.refundAmount.toNumber();

  return {
    id: order.id,
    placedAt: order.createdAt,
    status: order.status,
    history: collapseRepeatedStatuses(order.statusHistory),
    /**
     * A refund is announced only once there is money to announce. `refund_amount` is `0` on an
     * order where somebody decided nothing goes back, and `is_refunded` is false alongside it;
     * "a refund of ₹0 was processed" is a sentence that would worry a customer rather than
     * inform one.
     */
    refund:
      order.isRefunded && refundAmount !== null && refundAmount > 0
        ? { amount: refundAmount, refundedAt: order.refundedAt }
        : null,
  };
}
