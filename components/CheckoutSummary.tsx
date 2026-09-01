"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CartLine } from "@/lib/cart";
import { formatRupees } from "@/lib/format";
import { CART_PATH } from "@/lib/navigation";
import { OrderTotals, type OrderTotalsDiscount } from "@/components/OrderTotals";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { SelectedOptionsSummary } from "@/components/SelectedOptionsSummary";

export interface CheckoutSummaryProps {
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  /** See `OrderTotalsProps.discount`. Absent on the address step, which offers no payment choice yet. */
  discount?: OrderTotalsDiscount;
  /**
   * Reassurance under the total, behind a divider — the secure-checkout badge, the returns
   * window, the delivery coverage, the support address.
   *
   * It sits in this column rather than above the form because it is not an instruction. The
   * address step's left column is a sequence of things to do, and a boxed panel of four
   * promises between the heading and the first field is four lines of reading before the
   * shopper can start typing. Beside the total is where a shopper looks when they are deciding
   * whether to go on, which is when a promise is worth making. See
   * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
   */
  footer?: ReactNode;
}

/**
 * The read-only twin of `CartSummary` for the checkout steps: it lists what is being bought
 * but offers no way to change it, because quantity edits belong on `/cart`. Amounts still
 * come from `useCart`, which prices off the catalogue — nothing here is a stored number.
 */
export function CheckoutSummary({
  lines,
  subtotal,
  shipping,
  total,
  discount,
  footer,
}: CheckoutSummaryProps): JSX.Element {
  return (
    <div className="border border-line bg-ivory p-6 lg:sticky lg:top-32 lg:self-start">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-heading-sm text-ink">Order summary</h2>
        <Link
          href={CART_PATH}
          className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
        >
          Edit cart
        </Link>
      </div>

      <ul className="mt-6 flex flex-col gap-4 border-b border-line pb-6">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-line bg-white">
              {line.entry.image === null ? (
                <ProductImagePlaceholder />
              ) : (
                <Image
                  src={line.entry.image}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              )}
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-charcoal px-1 text-[0.625rem] font-medium leading-none text-ivory">
                {line.quantity}
              </span>
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-sm text-ink">
              <span>{line.entry.name}</span>
              <SelectedOptionsSummary selectedOptions={line.selectedOptions} />
            </span>

            <span className="font-sans text-body-sm text-ink">
              {formatRupees(line.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <OrderTotals subtotal={subtotal} shipping={shipping} total={total} discount={discount} />
      </div>

      {footer === undefined ? null : (
        <div className="mt-6 border-t border-line pt-6">{footer}</div>
      )}
    </div>
  );
}
