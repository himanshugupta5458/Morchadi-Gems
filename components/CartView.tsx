"use client";

import { useCart } from "@/lib/cart-context";
import { CartEmptyState } from "@/components/CartEmptyState";
import { CartLineItem } from "@/components/CartLineItem";
import { CartSummary } from "@/components/CartSummary";
import { PanelNotice } from "@/components/PanelNotice";

/**
 * The whole page below the heading. It renders the loading state until `isHydrated`, because
 * the server has no way to know what is in a cart that lives in localStorage — showing the
 * empty state first and then swapping it for three items would be a flash of wrong content,
 * not a hydration mismatch, and it is worth avoiding on the one page that is entirely about
 * the cart. See ADR-010.
 */
export function CartView(): JSX.Element {
  const {
    lines,
    itemCount,
    subtotal,
    shipping,
    total,
    hasUnavailableItems,
    isHydrated,
    removeItem,
    setQty,
  } = useCart();

  if (!isHydrated) return <PanelNotice>Loading your cart…</PanelNotice>;
  if (lines.length === 0) return <CartEmptyState />;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="flex flex-col">
        <p className="border-b border-line pb-4 text-body-sm text-muted">
          {itemCount === 1 ? "1 piece" : `${itemCount} pieces`} in your cart
        </p>

        <ul className="divide-y divide-line">
          {lines.map((line) => (
            <li key={line.key}>
              <CartLineItem
                line={line}
                onQuantityChange={setQty}
                onRemove={removeItem}
              />
            </li>
          ))}
        </ul>

        {hasUnavailableItems ? (
          <p className="mt-6 border border-sale/30 bg-sale/5 px-4 py-3 text-body-sm text-sale">
            One or more pieces sold out while they were in your cart. Remove them to
            continue to checkout.
          </p>
        ) : null}
      </div>

      <CartSummary
        subtotal={subtotal}
        shipping={shipping}
        total={total}
        isCheckoutBlocked={hasUnavailableItems || subtotal === 0}
      />
    </div>
  );
}
