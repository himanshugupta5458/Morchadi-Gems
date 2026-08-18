import Image from "next/image";
import type { CartItem } from "@/types/cart";
import { formatRupees } from "@/lib/format";
import { cartItemKey } from "@/lib/cart";
import { OrderTotals } from "@/components/OrderTotals";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { SelectedOptionsSummary } from "@/components/SelectedOptionsSummary";

export interface OrderReceiptProps {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

/**
 * What was in a completed order, listed from the `sessionStorage` bundle the browser carried
 * across the redirect. It is a reminder, not a receipt of record: the amount that was actually
 * charged comes from the server's verification of the order, and `/order-confirmation` only
 * renders this at all once that amount and this bundle agree
 * ([ADR-014](/docs/decisions/ADR-014-payment-verification-and-confirmation.md)).
 *
 * It takes `CartItem[]` rather than `CartLine[]` because the cart is cleared the moment a
 * payment is confirmed — by the time this renders there is no live cart left to price from.
 */
export function OrderReceipt({
  items,
  subtotal,
  shipping,
  total,
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
        <OrderTotals subtotal={subtotal} shipping={shipping} total={total} />
      </div>
    </section>
  );
}
