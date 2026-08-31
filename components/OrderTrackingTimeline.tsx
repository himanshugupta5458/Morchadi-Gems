import type { PublicOrderStatusEvent } from "@/lib/order-tracking";
import { orderStatusBadgeClasses, orderStatusMarkerClasses } from "@/lib/order-status";
import {
  formatTrackingDateTime,
  getCustomerOrderStatusLabel,
} from "@/lib/order-tracking-copy";

export interface OrderTrackingTimelineProps {
  history: readonly PublicOrderStatusEvent[];
  currentStatus: PublicOrderStatusEvent["status"];
}

/**
 * What has happened to this order and when, left to right, oldest first.
 *
 * Laid out as the confirmation email's journey graphic is — a marker per step, a rule between
 * them, the label and the timestamp underneath — so the picture a customer met in their inbox
 * is the picture they meet again here. The email's version is four fixed steps with only the
 * first filled, because an email has no live feed behind it; this one is the real history, so
 * every marker it draws is an event that actually happened.
 *
 * **Two fields per step and no third.** The admin timeline renders the same table with the
 * operator who made each change and the reason they typed beside it; neither is here, neither
 * is in `PublicOrderStatusEvent`, and neither is selected by the query that fills it. A
 * customer asking where their parcel is does not need to know which person moved it or what a
 * courier's failure code said, and both are internal notes written for the shop.
 *
 * **Non-linear outcomes are coloured, not special-cased.** `cancelled`, `rto` and `returned`
 * get their own hue through `orderStatusBadgeClasses` — the *same function* the admin order
 * detail page badges a status with, so the two surfaces cannot come to different conclusions
 * about what "came back to us" looks like. That page has no separate treatment for the three
 * of them either: one hue per status, and the label always written out beside it, so colour is
 * never the only signal. What differs here is only the vocabulary — `getCustomerOrderStatusLabel`
 * rather than `getOrderStatusLabel`, "Came back to us" rather than "RTO". See
 * [ADR-071](/docs/decisions/ADR-071-order-tracking-detail-and-timestamps.md).
 *
 * The last step is additionally marked as the current state, which is what a happy order and an
 * unhappy one still have in common.
 *
 * On a phone the row scrolls sideways rather than stacking: a timeline that reflows into a
 * column at one breakpoint and a row at the next is two components pretending to be one.
 */
export function OrderTrackingTimeline({
  history,
  currentStatus,
}: OrderTrackingTimelineProps): JSX.Element {
  if (history.length === 0) {
    return (
      <p className="text-body-sm text-muted">
        We have no dated history for this order. Its current state is above, and we can tell you
        the rest if you message us.
      </p>
    );
  }

  return (
    <ol className="scrollbar-none flex snap-x gap-0 overflow-x-auto pb-1">
      {history.map((event, index) => {
        const isCurrent = index === history.length - 1 && event.status === currentStatus;

        return (
          <li
            key={`${event.status}-${event.changedAt.toISOString()}`}
            className="flex min-w-[9.5rem] flex-1 shrink-0 snap-start flex-col gap-3"
          >
            <div className="flex items-center" aria-hidden>
              <span
                className={`h-px flex-1 ${index === 0 ? "bg-transparent" : "bg-line"}`}
              />
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${orderStatusMarkerClasses(
                  event.status,
                )} ${isCurrent ? "ring-2 ring-gold ring-offset-2 ring-offset-white" : ""}`}
              />
              <span
                className={`h-px flex-1 ${
                  index === history.length - 1 ? "bg-transparent" : "bg-line"
                }`}
              />
            </div>

            <div className="flex flex-col items-center gap-1.5 px-2 text-center">
              <span className={orderStatusBadgeClasses(event.status)}>
                {getCustomerOrderStatusLabel(event.status)}
              </span>
              <span className="text-body-sm text-muted">
                {formatTrackingDateTime(event.changedAt)}
              </span>
              {isCurrent ? (
                <span className="text-eyebrow uppercase tracking-caps text-gold-deep">
                  Where it is now
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
