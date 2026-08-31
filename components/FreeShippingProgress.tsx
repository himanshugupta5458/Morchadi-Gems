import {
  FREE_SHIPPING_THRESHOLD,
  amountToFreeShipping,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";

export interface FreeShippingProgressProps {
  /** The payable subtotal, at the prices being charged. Never an MRP and never a discounted total. */
  subtotal: number;
}

/**
 * How close this cart is to shipping free, as a bar and a sentence.
 *
 * **The figure is measured against the payable subtotal and nothing else**, because that is
 * exactly what `calculateShipping` charges from — on the client in `calculateCartTotals` and on
 * the server in `buildOrderFromCart`, which is the one that decides. Two amounts might look
 * like better candidates and neither is:
 *
 * - **Not the MRP subtotal.** `CartLine.unitPrice` is `entry.price`, the amount actually
 *   charged; a compare-at price has never been summed into a cart total and must not decide
 *   whether shipping is free either, or a cart of heavily discounted pieces would be promised
 *   free delivery it does not qualify for.
 * - **Not the total after the online-payment discount.** That rebate is applied in
 *   `resolvePaymentPlan` *after* shipping has already been decided, so a bar that moved with it
 *   would promise a threshold the server does not honour. See
 *   [ADR-063](/docs/decisions/ADR-063-online-payment-discount.md).
 *
 * The bar reaches its end exactly when `amountToFreeShipping` reaches zero, since both are
 * computed from the same constant — it is a rendering of the shortfall, not a second opinion
 * about it. Nothing here is an input to any amount.
 */
export function FreeShippingProgress({
  subtotal,
}: FreeShippingProgressProps): JSX.Element | null {
  if (subtotal <= 0) return null;

  const shortfall = amountToFreeShipping(subtotal);
  const progressPercent = Math.min(
    100,
    Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100),
  );
  const hasEarnedFreeShipping = shortfall === 0;

  return (
    <div className="flex flex-col gap-2 border border-line bg-ivory px-4 py-3.5 sm:px-5">
      <p className="text-body-sm text-ink">
        {hasEarnedFreeShipping ? (
          <>
            <span className="font-medium text-gold-deep">Free shipping unlocked.</span>{" "}
            Delivery on this order is on us.
          </>
        ) : (
          <>
            Add{" "}
            <span className="font-medium text-gold-deep">
              {formatRupees(shortfall)}
            </span>{" "}
            for free shipping.
          </>
        )}
      </p>

      <div
        role="progressbar"
        aria-label="Progress towards free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="h-1.5 w-full overflow-hidden bg-line"
      >
        <div
          className={`h-full transition-[width] duration-250 ${
            hasEarnedFreeShipping ? "bg-gold-deep" : "bg-gold"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
