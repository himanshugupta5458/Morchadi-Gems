import Image from "next/image";
import type { CartItem, CheckoutData } from "@/types/cart";
import { formatRupees } from "@/lib/format";
import { cartItemKey } from "@/lib/cart";
import { readBundleReceiptTotals } from "@/lib/verify";
import { OrderTotals, type OrderTotalsDiscount } from "@/components/OrderTotals";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { SelectedOptionsSummary } from "@/components/SelectedOptionsSummary";

export interface OrderReceiptProps {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  /**
   * What the order was charged, from `readBundleReceiptTotals` — the sum of the two amounts the
   * server stamped, not the cart's worth at the address step. See that function for why the two
   * differ on a discounted order.
   */
  total: number;
  discount?: OrderTotalsDiscount;
}

/**
 * What was in a completed order, listed from the `sessionStorage` bundle the browser carried
 * across the redirect. It is a reminder, not a receipt of record: the amount that was actually
 * charged comes from the server's verification of the order, and `/order-confirmation` only
 * renders this at all once that amount and this bundle agree
 * ([the verify-order contract](/docs/api/verify-order.md)).
 *
 * It takes `CartItem[]` rather than `CartLine[]` because the cart is cleared the moment a
 * payment is confirmed — by the time this renders there is no live cart left to price from.
 */
export function OrderReceipt({
  items,
  subtotal,
  shipping,
  total,
  discount,
}: OrderReceiptProps): JSX.Element {
  return (
    <section className="border border-line bg-ivory p-6 text-left">
      <h3 className="font-display text-heading-sm text-ink">What you ordered</h3>

      <ul className="mt-6 flex flex-col gap-4 border-b border-line pb-6">
        {items.map((item) => (
          <li key={cartItemKey(item)} className="flex items-center gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-line bg-white">
              {item.image.length === 0 ? (
                <ProductImagePlaceholder />
              ) : (
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              )}
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-charcoal px-1 text-[0.625rem] font-medium leading-none text-ivory">
                {item.qty}
              </span>
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-sm text-ink">
              <span>{item.name}</span>
              <SelectedOptionsSummary selectedOptions={item.selectedOptions} />
            </span>

            <span className="font-sans text-body-sm text-ink">
              {formatRupees(item.price * item.qty)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <OrderTotals
          subtotal={subtotal}
          shipping={shipping}
          total={total}
          discount={discount}
        />
      </div>
    </section>
  );
}

/**
 * The label a rebate on a completed order carries.
 *
 * `resolvePaymentPlan` has exactly one way to charge less than `subtotal + shipping`, and it is
 * the online-payment discount on a cash-on-delivery-eligible cart paid in full
 * ([ADR-063](/docs/decisions/ADR-063-online-payment-discount.md)) — so a gap on a completed
 * order can only be that, and naming it is honest rather than a guess. The percentage is left
 * off deliberately: the amount is derived from the two figures the server stamped, and printing
 * a rate beside it would be a second claim that could disagree with the first.
 */
const RECEIPT_DISCOUNT_LABEL = "Online payment discount";

/**
 * The receipt's props for one completed order's bundle, with its total corrected to what was
 * actually charged. See `readBundleReceiptTotals` for why the bundle's own `total` is not it.
 */
export function toReceiptProps(
  bundle: CheckoutData,
): Pick<OrderReceiptProps, "subtotal" | "shipping" | "total" | "discount"> {
  const { subtotal, shipping, total, discount } = readBundleReceiptTotals(bundle);

  return {
    subtotal,
    shipping,
    total,
    ...(discount === null
      ? {}
      : { discount: { label: RECEIPT_DISCOUNT_LABEL, amount: discount } }),
  };
}
