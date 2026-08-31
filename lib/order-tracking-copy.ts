import type { OrderStatus } from "@prisma/client";

/**
 * One status, said twice: once as a name for a timeline row, once as a sentence for whoever
 * is standing on `/track` wondering where their parcel is.
 *
 * `label` is the short form and never a raw enum value. `headline` answers "where is it?" in
 * the present tense. `detail` is the one sentence that says what that means and, where there
 * is one, what happens next.
 */
export interface CustomerOrderStatusCopy {
  label: string;
  headline: string;
  detail: string;
}

/**
 * The seven statuses in the words a customer reads, which are deliberately **not** the words
 * `lib/order-status.ts` gives an operator.
 *
 * The two vocabularies answer different questions. "RTO" is precise, is what the courier's
 * dashboard says, and is what the owner needs to see on a list of fifty orders; it is also an
 * industry abbreviation that means nothing to the person who was waiting for the parcel. Every
 * entry here is therefore written from the customer's side of the transaction — "on its way to
 * you", not "shipped" — and no entry mentions an internal process, an operator, or a reason.
 *
 * British spelling throughout, matching the rest of the site's copy.
 */
const CUSTOMER_ORDER_STATUS_COPY: Record<OrderStatus, CustomerOrderStatusCopy> = {
  placed: {
    label: "Order placed",
    headline: "We have your order",
    detail:
      "Your payment is in and your order is with us. We are getting it ready to be packed, and nothing more is needed from you.",
  },
  packed: {
    label: "Packed",
    headline: "Packed and getting ready to ship",
    detail:
      "Your pieces are boxed and checked. The parcel is waiting for the courier to collect it.",
  },
  shipped: {
    label: "On its way",
    headline: "On its way to you",
    detail:
      "Your parcel has left us and is with the courier. Please keep the phone number you gave us reachable, as the courier calls before delivering.",
  },
  delivered: {
    label: "Delivered",
    headline: "Delivered",
    detail:
      "The courier has recorded this parcel as delivered. If it has not actually reached you, message us and we will chase it up.",
  },
  rto: {
    label: "Came back to us",
    headline: "This parcel has come back to us",
    detail:
      "The courier could not deliver it and has returned it to us. Message us and we will arrange for it to go out again or settle it, whichever you prefer.",
  },
  returned: {
    label: "Return received",
    headline: "Your return is back with us",
    detail: "We have received this order back and it is now closed.",
  },
  cancelled: {
    label: "Cancelled",
    headline: "This order was cancelled",
    detail: "Nothing further is happening with this order.",
  },
};

export function describeOrderStatusForCustomer(status: OrderStatus): CustomerOrderStatusCopy {
  return CUSTOMER_ORDER_STATUS_COPY[status];
}

export function getCustomerOrderStatusLabel(status: OrderStatus): string {
  return CUSTOMER_ORDER_STATUS_COPY[status].label;
}

/**
 * The one thing a lookup that found nothing is ever told, whatever was actually wrong with
 * what was typed.
 *
 * A message that separated "that is not a valid order number" from "no such order" would turn
 * the box into an oracle for the id format, which is the same reasoning
 * `ADMIN_LOGIN_FAILURE_MESSAGE` is written down for. The stakes here are far lower — an order
 * number is not a credential — so this is the cheap half of that precedent and not the timing
 * floor that goes with it.
 */
export const ORDER_NOT_FOUND_MESSAGE =
  "We could not find an order with that number. Please check it and try again. It is the ten-character code on your confirmation screen.";

/**
 * What a client that has asked too often is told. It says nothing about any order, so it is
 * not a way around the message above.
 */
export const TRACKING_THROTTLED_MESSAGE =
  "That is a lot of lookups in a short time. Please wait a minute and try again.";

const TRACKING_DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * "20 August 2026" — a date and no clock time, in Indian time on a server that runs in UTC.
 *
 * Still day-only, and still used: the confirmation email's "Placed on" line and the refund
 * sentence on `/track` both read it. A single date stated once in prose has none of the problem
 * the timeline had — there is no second date beside it to look identical to.
 *
 * The timeline itself now uses `formatTrackingDateTime`. See
 * [ADR-071](/docs/decisions/ADR-071-order-tracking-detail-and-timestamps.md).
 */
export function formatTrackingDate(instant: Date): string {
  return TRACKING_DATE_FORMAT.format(instant);
}

const TRACKING_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * "20 Aug 2026, 4:12 pm" — the date **and** the clock time, in Indian time.
 *
 * This reverses the reasoning `formatTrackingDate` was written under, and the reversal is the
 * point. Day-only was chosen so that a timestamp accurate to the minute would not invite "it
 * says 4:12pm, so why has nothing moved by 4:40pm". What it produced instead was a timeline of
 * three rows reading "1 May 2026, 1 May 2026, 1 May 2026" — an order that was placed, packed
 * and picked up inside a working day looked like three events that had not happened, which is
 * a worse version of the same worry and one the customer cannot resolve by reading harder.
 *
 * Showing the time answers it directly: two events on one day are visibly hours apart. The
 * original concern is real but it belongs to the *copy* — `describeOrderStatusForCustomer`
 * says what happens next in words — rather than to the precision of a fact.
 *
 * Short month rather than long, because the horizontal timeline puts these under narrow
 * columns and "September" wraps where "Sep" does not. Same time zone, same locale, same
 * server-runs-in-UTC pinning as its sibling. See ADR-071.
 */
export function formatTrackingDateTime(instant: Date): string {
  return TRACKING_DATE_TIME_FORMAT.format(instant);
}
