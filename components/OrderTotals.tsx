import {
  FREE_SHIPPING_THRESHOLD,
  amountToFreeShipping,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";

export interface OrderTotalsProps {
  subtotal: number;
  shipping: number;
  total: number;
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
 */
export function OrderTotals({
  subtotal,
  shipping,
  total,
}: OrderTotalsProps): JSX.Element {
  const shortfallToFreeShipping = amountToFreeShipping(subtotal);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line pb-6">
        <TotalsRow label="Subtotal" value={formatRupees(subtotal)} />
        <TotalsRow
          label={`Shipping (free over ${formatRupees(FREE_SHIPPING_THRESHOLD)})`}
          value={shippingValueLabel(subtotal, shipping)}
        />
        {shortfallToFreeShipping > 0 ? (
          <p className="text-body-sm text-gold-deep">
            Add {formatRupees(shortfallToFreeShipping)} for free shipping.
          </p>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-4 pt-6">
        <span className="text-label uppercase tracking-caps text-ink">Total</span>
        <span className="font-sans text-heading-sm font-medium text-ink">
          {formatRupees(total)}
        </span>
      </div>
    </>
  );
}
