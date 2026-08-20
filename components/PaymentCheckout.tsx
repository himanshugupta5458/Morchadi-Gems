"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CheckoutData } from "@/types/cart";
import type { CreateOrderItem } from "@/types/order";
import { selectPayableLines } from "@/lib/cart";
import { useCart } from "@/lib/cart-context";
import { readCheckoutData, stampCheckoutDataOrder } from "@/lib/checkout";
import { formatRupees } from "@/lib/format";
import {
  CART_PATH,
  CHECKOUT_ADDRESS_PATH,
  CREATE_ORDER_API_PATH,
} from "@/lib/navigation";
import {
  UNREACHABLE_FAILURE,
  describePaymentFailure,
  isCreateOrderSuccess,
  type PaymentFailure,
} from "@/lib/payment";
import { getStoredUtmParams } from "@/lib/utm";
import { AddressRecap } from "@/components/AddressRecap";
import { Button } from "@/components/Button";
import { CheckoutGuardNotice } from "@/components/CheckoutGuardNotice";
import { CheckoutSummary } from "@/components/CheckoutSummary";
import { PanelNotice } from "@/components/PanelNotice";
import { PaymentErrorNotice } from "@/components/PaymentErrorNotice";

type PaymentStatus = "idle" | "creating" | "redirecting";

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Step two of checkout. It shows what is about to be charged and hands the browser to
 * Cashfree, and it is deliberately incapable of doing anything else: it holds no credentials,
 * knows no Cashfree endpoint, and sends only product ids, quantities, the recorded option
 * choices, the address and the stored campaign to our own route. The amount below the button
 * is what the *server* will independently arrive at from the same ids — it is a rendering of
 * the order, not an instruction about its price, and neither a recorded choice nor a campaign
 * is an input to it at all.
 * See [ADR-013](/docs/decisions/ADR-013-order-creation-and-payment.md) and
 * [ADR-019](/docs/decisions/ADR-019-product-options.md).
 */
export function PaymentCheckout(): JSX.Element {
  const { lines, subtotal, shipping, total, hasUnavailableItems, isHydrated } =
    useCart();

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isRestoreAttempted, setIsRestoreAttempted] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [failure, setFailure] = useState<PaymentFailure | null>(null);

  /**
   * The state update that disables the button does not land until React re-renders, so a
   * double click would otherwise create two orders. This latch is checked and set in the same
   * synchronous tick as the click, which closes that window.
   */
  const isOrderInFlight = useRef(false);

  useEffect(() => {
    setCheckoutData(readCheckoutData());
    setIsRestoreAttempted(true);
  }, []);

  function abandonAttempt(nextFailure: PaymentFailure): void {
    setFailure(nextFailure);
    setStatus("idle");
    isOrderInFlight.current = false;
  }

  async function handlePay(): Promise<void> {
    if (isOrderInFlight.current || checkoutData === null) return;
    isOrderInFlight.current = true;
    setFailure(null);
    setStatus("creating");

    const items: CreateOrderItem[] = selectPayableLines(lines).map((line) => ({
      productId: line.entry.id,
      qty: line.quantity,
      ...(line.selectedOptions === undefined
        ? {}
        : { selectedOptions: line.selectedOptions }),
    }));

    const utm = getStoredUtmParams();

    let response: Response;
    try {
      response = await fetch(CREATE_ORDER_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          address: checkoutData.address,
          ...(utm === null ? {} : { utm }),
        }),
      });
    } catch {
      abandonAttempt(UNREACHABLE_FAILURE);
      return;
    }

    const body = await readResponseBody(response);

    if (!response.ok) {
      abandonAttempt(describePaymentFailure(body));
      return;
    }

    if (!isCreateOrderSuccess(body)) {
      abandonAttempt(UNREACHABLE_FAILURE);
      return;
    }

    setStatus("redirecting");
    stampCheckoutDataOrder(body.orderId);

    try {
      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({ mode: body.mode });
      if (cashfree === null) {
        abandonAttempt(UNREACHABLE_FAILURE);
        return;
      }

      const result = await cashfree.checkout({
        paymentSessionId: body.paymentSessionId,
        redirectTarget: "_self",
      });

      if (result?.error !== undefined) abandonAttempt(UNREACHABLE_FAILURE);
    } catch {
      abandonAttempt(UNREACHABLE_FAILURE);
    }
  }

  if (!isHydrated || !isRestoreAttempted) {
    return <PanelNotice>Loading your order…</PanelNotice>;
  }

  if (lines.length === 0) {
    return (
      <CheckoutGuardNotice
        title="There is nothing to pay for"
        message="Your cart is empty, so there is no order to complete. Pick something first and this step will be waiting."
      />
    );
  }

  if (hasUnavailableItems || subtotal === 0) {
    return (
      <CheckoutGuardNotice
        title="One piece is no longer available"
        message="Something in your cart sold out while you were checking out. Remove it on the cart page and you can pick up payment from here."
      />
    );
  }

  if (checkoutData === null) {
    return (
      <CheckoutGuardNotice
        title="We still need your delivery details"
        message="This step follows the address form, and we do not have an address for this order yet. Fill it in and you will come straight back here."
        action={{ href: CHECKOUT_ADDRESS_PATH, label: "Enter delivery details" }}
      />
    );
  }

  const isBusy = status !== "idle";
  const isPayDisabled = isBusy || (failure !== null && !failure.canRetry);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-heading-sm text-ink">Review and pay</h2>
          <p className="max-w-prose text-body-sm text-muted">
            Payment is handled by Cashfree on their secure page. We never see your card or
            UPI details, and the amount is confirmed by our server before you are sent
            there.
          </p>
        </div>

        <AddressRecap address={checkoutData.address} editHref={CHECKOUT_ADDRESS_PATH} />

        {failure === null ? null : (
          <PaymentErrorNotice
            title={failure.title}
            message={failure.message}
            details={failure.details}
            action={failure.action}
          />
        )}

        <div className="flex flex-col gap-3">
          <Button
            fullWidth
            onClick={handlePay}
            disabled={isPayDisabled}
            aria-busy={isBusy}
          >
            {status === "idle"
              ? `Pay ${formatRupees(total)} with Cashfree`
              : "Taking you to Cashfree…"}
          </Button>

          <p className="text-body-sm text-muted">
            You will be redirected to Cashfree to complete the payment, then brought back
            here.{" "}
            <Link
              href={CART_PATH}
              className="underline underline-offset-4 transition-colors duration-250 hover:text-ink"
            >
              Change your order
            </Link>
          </p>
        </div>
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
