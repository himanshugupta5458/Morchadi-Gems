import { FLAT_SHIPPING_RATE } from "@/lib/config";
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

/**
 * Subtotal, shipping and total, rendered identically wherever an order is summarised. The
 * cart and the checkout steps share this rather than each formatting their own rows — two
 * implementations would eventually disagree about the one number that matters.
 *
 * No tax line and no coupon row. Shipping is the flat rate from `lib/config.ts` and shows an
 * amount only when there is something payable to ship.
 */
export function OrderTotals({
  subtotal,
  shipping,
  total,
}: OrderTotalsProps): JSX.Element {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line pb-6">
        <TotalsRow label="Subtotal" value={formatRupees(subtotal)} />
        <TotalsRow
          label={`Shipping (flat ${formatRupees(FLAT_SHIPPING_RATE)})`}
          value={shipping > 0 ? formatRupees(shipping) : "—"}
        />
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
