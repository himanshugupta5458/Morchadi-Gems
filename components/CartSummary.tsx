"use client";

import { CHECKOUT_ADDRESS_PATH } from "@/lib/navigation";
import { SHOP_PATH } from "@/lib/shop-query";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { OrderTotals } from "@/components/OrderTotals";

export interface CartSummaryProps {
  subtotal: number;
  shipping: number;
  total: number;
  isCheckoutBlocked: boolean;
}

export function CartSummary({
  subtotal,
  shipping,
  total,
  isCheckoutBlocked,
}: CartSummaryProps): JSX.Element {
  return (
    <div className="border border-line bg-ivory p-4 sm:p-6 lg:sticky lg:top-32">
      <h2 className="font-display text-heading-sm text-ink">Order summary</h2>

      <div className="mt-5 sm:mt-6">
        <OrderTotals subtotal={subtotal} shipping={shipping} total={total} />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:mt-6">
        {isCheckoutBlocked ? (
          <Button fullWidth disabled>
            Proceed to checkout
          </Button>
        ) : (
          <ButtonLink href={CHECKOUT_ADDRESS_PATH} fullWidth>
            Proceed to checkout
          </ButtonLink>
        )}

        <ButtonLink href={SHOP_PATH} variant="secondary" fullWidth>
          Continue shopping
        </ButtonLink>
      </div>

      <p className="mt-5 text-body-sm text-muted">
        Prices are confirmed against the catalogue when your order is created.
      </p>
    </div>
  );
}
