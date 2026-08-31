"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "@/types/cart";
import { toAddressFormValues, type AddressFormValues } from "@/lib/address";
import { useCart } from "@/lib/cart-context";
import { buildCheckoutData, readCheckoutData, writeCheckoutData } from "@/lib/checkout";
import {
  describeCartCodAvailability,
  summariseCartPrepayment,
  type CodEligibilityEntry,
} from "@/lib/cod";
import { DELIVERY_ESTIMATE_LINE } from "@/lib/config";
import { CHECKOUT_PAYMENT_PATH } from "@/lib/navigation";
import { clearSavedAddress, readSavedAddress } from "@/lib/saved-address";
import { AddressForm } from "@/components/AddressForm";
import { CheckoutGuardNotice } from "@/components/CheckoutGuardNotice";
import { CheckoutSummary } from "@/components/CheckoutSummary";
import { CheckoutTrustStrip } from "@/components/CheckoutTrustStrip";
import { PanelNotice } from "@/components/PanelNotice";

export interface AddressCheckoutProps {
  /**
   * The cash-on-delivery catalogue, for the one sentence this step states about it. The same
   * prop `/payment` and `/cart` take, and for the same reason: `minPrepaidAmount` never travels
   * in an object that carries a price
   * ([ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md)).
   */
  codCatalogue: readonly CodEligibilityEntry[];
}

/**
 * Both the cart and any saved address live in browser storage, so neither is known during the
 * server render. The page waits for both before deciding what to show — otherwise a reload
 * with a full cart would flash the empty-cart guard, and a shopper returning to edit would
 * see their details appear a frame after the empty fields. See ADR-011.
 *
 * There are two places a pre-fill can come from and they are consulted in that order. The
 * `sessionStorage` checkout bundle is this checkout, a step or two ago — somebody who reached
 * `/payment` and pressed back. The `localStorage` saved address is a previous *completed*
 * order. The in-progress one wins wherever both exist, because it is the more recent statement
 * of where this parcel is going.
 *
 * **Whether this order can be paid at the door is stated here, before the payment step.** It is
 * the same sentence `/cart` shows, from the same rule, and repeating it is deliberate: a shopper
 * deciding whether an unfamiliar shop can be trusted with an address wants to know they are not
 * committing to paying online before they have seen the parcel, and finding that out one screen
 * later is one screen too late.
 */
export function AddressCheckout({
  codCatalogue,
}: AddressCheckoutProps): JSX.Element {
  const { lines, subtotal, shipping, total, hasUnavailableItems, isHydrated } =
    useCart();
  const router = useRouter();

  const [savedValues, setSavedValues] = useState<AddressFormValues | undefined>(
    undefined,
  );
  const [isPrefilledFromLastOrder, setIsPrefilledFromLastOrder] = useState(false);
  const [isRestoreAttempted, setIsRestoreAttempted] = useState(false);

  useEffect(() => {
    const savedCheckout = readCheckoutData();
    if (savedCheckout !== null) {
      setSavedValues(toAddressFormValues(savedCheckout.address));
      setIsRestoreAttempted(true);
      return;
    }

    const addressFromLastOrder = readSavedAddress();
    if (addressFromLastOrder !== null) {
      setSavedValues(addressFromLastOrder);
      setIsPrefilledFromLastOrder(true);
    }
    setIsRestoreAttempted(true);
  }, []);

  /**
   * Forgetting the saved address empties the form in the same act, so the shopper sending this
   * order somewhere else sees the blank boxes they asked for rather than the details they have
   * just discarded still sitting there.
   *
   * `formInstance` is the form's React key. `AddressForm` reads `initialValues` once, into
   * `useState` — which is what keeps the stored copy untouched while somebody types — so a new
   * key is how it is asked to start again from a different set of values.
   */
  const [formInstance, setFormInstance] = useState(0);

  function handleForgetSavedAddress(): void {
    clearSavedAddress();
    setSavedValues(undefined);
    setIsPrefilledFromLastOrder(false);
    setFormInstance((instance) => instance + 1);
  }

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

  const prepayment = summariseCartPrepayment(
    lines
      .filter((line) => line.isPayable)
      .map((line) => ({ productId: line.entry.id, qty: line.quantity })),
    codCatalogue,
  );

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-heading-sm text-ink">Delivery details</h2>
          <p className="max-w-prose text-body-sm text-muted">
            We ship across India. No account needed, and we use these details for this order
            only.
          </p>
        </div>

        <div className="flex flex-col gap-3 border border-line bg-ivory px-4 py-4 sm:px-5">
          <p className="text-body-sm text-ink">{describeCartCodAvailability(prepayment)}</p>
          <p className="text-body-sm text-muted">{DELIVERY_ESTIMATE_LINE}</p>
          <CheckoutTrustStrip />
        </div>

        {isPrefilledFromLastOrder ? (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border border-line bg-ivory px-4 py-3 text-body-sm text-muted">
            <span>Filled in from your last order. Change anything that has moved.</span>
            <button
              type="button"
              onClick={handleForgetSavedAddress}
              className="text-ink underline decoration-gold underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
            >
              Use a different address
            </button>
          </p>
        ) : null}

        <AddressForm
          key={formInstance}
          initialValues={savedValues}
          onSubmit={handleValidAddress}
        />
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
