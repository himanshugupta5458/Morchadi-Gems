import { FREE_SHIPPING_THRESHOLD } from "@/lib/config";
import { formatRupees } from "@/lib/format";

export interface OrderTotalsDiscount {
  label: string;
  amount: number;
}

export interface OrderTotalsProps {
  subtotal: number;
  shipping: number;
  total: number;
  /**
   * The same payable lines at their compare-at prices. Supplying it splits the first row into
   * "Subtotal (MRP)" and a "You save" line; omitting it leaves the single "Subtotal" row every
   * other caller shows. Display only, and never an input to `total` — see
   * `calculateCartMrpSubtotal`. A value at or below `subtotal` renders as if it were absent,
   * so a cart of undiscounted pieces never shows a saving of nothing.
   */
  mrpSubtotal?: number;
  /**
   * An order-level rebate, shown as its own row between shipping and the total. Omitted by
   * every caller except the payment step choosing online payment on a cash-on-delivery-eligible
   * cart — `total` is expected to already have it subtracted, so this row is a breakdown of how
   * `total` was reached, never a second place that could disagree with it.
   */
  discount?: OrderTotalsDiscount;
}

function TotalsRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-body-sm text-muted">{label}</span>
      <span className="font-sans text-body text-ink">{value}</span>
    </div>
  );
}

function SavingsRow({ label, amount }: { label: string; amount: number }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-body-sm text-gold-deep">{label}</span>
      <span className="font-sans text-body text-gold-deep">
        −{formatRupees(amount)}
      </span>
    </div>
  );
}

function shippingValueLabel(subtotal: number, shipping: number): string {
  if (shipping > 0) return formatRupees(shipping);
  return subtotal > 0 ? "FREE" : "—";
}

/**
 * Subtotal, shipping and total, rendered identically wherever an order is summarised. The
 * cart and the checkout steps share this rather than each formatting their own rows — two
 * implementations would eventually disagree about the one number that matters.
 *
 * No tax line and no coupon row. Shipping is whatever the caller was given; the rule that
 * produced it lives in `lib/config.ts` and the threshold shown here is the same constant, so
 * the row can never advertise a threshold the arithmetic does not honour.
 *
 * **The "add ₹N for free shipping" nudge is not here any more.** It used to render from this
 * component, which put it on all four surfaces that summarise an order — including the payment
 * step, where it sat two lines above the online-payment discount and read as though the two
 * should interact, and the confirmation screen, where the order was already placed and nothing
 * could be done about it. It is now `FreeShippingProgress`, rendered by the cart alone, which
 * is the one screen where adding something is still a move the shopper can make. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */
export function OrderTotals({
  subtotal,
  shipping,
  total,
  mrpSubtotal,
  discount,
}: OrderTotalsProps): JSX.Element {
  const catalogueSaving =
    mrpSubtotal === undefined ? 0 : Math.max(0, mrpSubtotal - subtotal);

  return (
    <>
      <div className="flex flex-col gap-2.5 border-b border-line pb-4 sm:gap-3 sm:pb-6">
        {catalogueSaving > 0 && mrpSubtotal !== undefined ? (
          <>
            <TotalsRow label="Subtotal (MRP)" value={formatRupees(mrpSubtotal)} />
            <SavingsRow label="You save" amount={catalogueSaving} />
          </>
        ) : (
          <TotalsRow label="Subtotal" value={formatRupees(subtotal)} />
        )}
        <TotalsRow
          label={`Shipping (free over ${formatRupees(FREE_SHIPPING_THRESHOLD)})`}
          value={shippingValueLabel(subtotal, shipping)}
        />
        {discount === undefined ? null : (
          <SavingsRow label={discount.label} amount={discount.amount} />
        )}
      </div>

      <div className="flex items-baseline justify-between gap-4 pt-4 sm:pt-6">
        <span className="text-label uppercase tracking-caps text-ink">Total</span>
        <span className="font-sans text-heading-sm font-medium text-ink">
          {formatRupees(total)}
        </span>
      </div>
    </>
  );
}
