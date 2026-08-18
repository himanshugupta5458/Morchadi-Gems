"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "@/types/cart";
import { toAddressFormValues, type AddressFormValues } from "@/lib/address";
import { useCart } from "@/lib/cart-context";
import { buildCheckoutData, readCheckoutData, writeCheckoutData } from "@/lib/checkout";
import { CHECKOUT_PAYMENT_PATH } from "@/lib/navigation";
import { AddressForm } from "@/components/AddressForm";
import { CheckoutGuardNotice } from "@/components/CheckoutGuardNotice";
import { CheckoutSummary } from "@/components/CheckoutSummary";
import { PanelNotice } from "@/components/PanelNotice";

/**
 * Both the cart and any saved address live in browser storage, so neither is known during the
 * server render. The page waits for both before deciding what to show — otherwise a reload
 * with a full cart would flash the empty-cart guard, and a shopper returning to edit would
 * see their details appear a frame after the empty fields. See ADR-011.
 */
export function AddressCheckout(): JSX.Element {
  const { lines, subtotal, shipping, total, hasUnavailableItems, isHydrated } =
    useCart();
  const router = useRouter();

  const [savedValues, setSavedValues] = useState<AddressFormValues | undefined>(
    undefined,
  );
  const [isRestoreAttempted, setIsRestoreAttempted] = useState(false);

  useEffect(() => {
    const savedCheckout = readCheckoutData();
    if (savedCheckout !== null) {
      setSavedValues(toAddressFormValues(savedCheckout.address));
    }
    setIsRestoreAttempted(true);
  }, []);

  function handleValidAddress(address: Address): void {
    writeCheckoutData(buildCheckoutData(lines, address));
    router.push(CHECKOUT_PAYMENT_PATH);
  }

  if (!isHydrated || !isRestoreAttempted) {
    return <PanelNotice>Loading your order…</PanelNotice>;
  }

  if (lines.length === 0) {
    return (
      <CheckoutGuardNotice
        title="There is nothing to check out"
        message="Your cart is empty, so there are no delivery details to take yet. Pick something first and this step will be waiting."
      />
    );
  }

  if (hasUnavailableItems || subtotal === 0) {
    return (
      <CheckoutGuardNotice
        title="One piece is no longer available"
        message="Something in your cart sold out. Remove it on the cart page and you can pick up checkout from here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-heading-sm text-ink">Delivery details</h2>
          <p className="max-w-prose text-body-sm text-muted">
            We ship across India. No account needed — we use these details for this order
            only.
          </p>
        </div>

        <AddressForm initialValues={savedValues} onSubmit={handleValidAddress} />
      </div>

      <CheckoutSummary
        lines={lines}
        subtotal={subtotal}
        shipping={shipping}
        total={total}
      />
    </div>
  );
}
