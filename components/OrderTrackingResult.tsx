import { OrderTrackingItems } from "@/components/OrderTrackingItems";
import { OrderTrackingPayment } from "@/components/OrderTrackingPayment";
import { OrderTrackingTimeline } from "@/components/OrderTrackingTimeline";
import { formatRupees } from "@/lib/format";
import type { PublicOrderTracking } from "@/lib/order-tracking";
import {
  ORDER_NOT_FOUND_MESSAGE,
  describeOrderStatusForCustomer,
  formatTrackingDate,
} from "@/lib/order-tracking-copy";

export interface OrderTrackingResultProps {
  tracking: PublicOrderTracking | null;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-4 border border-line bg-white p-4 sm:p-6">
      <h3 className="text-eyebrow uppercase tracking-caps text-gold-deep">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The answer to one lookup: where the order is, how it got there, what is in it, what is still
 * owed, and whether money has gone back — or the single message that covers every way a lookup
 * finds nothing.
 *
 * Laid out as a headline card over three panels rather than as one column of prose, because a
 * customer arriving here has one of three questions and each panel answers exactly one of them.
 * The delivery address is deliberately not among them: this page asks for nothing but the order
 * number, and an order number travels further than the person who was given it. See
 * [ADR-071](/docs/decisions/ADR-071-order-tracking-detail-and-timestamps.md).
 */
export function OrderTrackingResult({ tracking }: OrderTrackingResultProps): JSX.Element {
  if (tracking === null) {
    return <p className="text-body-sm text-muted">{ORDER_NOT_FOUND_MESSAGE}</p>;
  }

  const statusCopy = describeOrderStatusForCustomer(tracking.status);

  return (
    <section className="flex flex-col gap-5 sm:gap-7">
      <div className="flex flex-col gap-3 border border-line bg-ivory p-5 sm:p-8">
        <span className="text-eyebrow uppercase tracking-caps text-gold-deep">
          {`Order ${tracking.id} · placed ${formatTrackingDate(tracking.placedAt)}`}
        </span>
        <h2 className="font-display text-heading-sm text-ink sm:text-heading">
          {statusCopy.headline}
        </h2>
        <p className="max-w-prose text-body-sm text-muted">{statusCopy.detail}</p>
      </div>

      <Panel title="The journey so far">
        <OrderTrackingTimeline history={tracking.history} currentStatus={tracking.status} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
        <Panel title="What is in this order">
          <OrderTrackingItems items={tracking.items} />
        </Panel>

        <Panel title="Payment">
          <OrderTrackingPayment payment={tracking.payment} />

          {tracking.refund !== null ? (
            <p className="border-t border-line pt-3 text-body-sm text-muted">
              {`A refund of ${formatRupees(tracking.refund.amount)} has been processed`}
              {tracking.refund.refundedAt !== null
                ? ` on ${formatTrackingDate(tracking.refund.refundedAt)}`
                : ""}
              .
            </p>
          ) : null}
        </Panel>
      </div>
    </section>
  );
}
