"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CheckoutData } from "@/types/cart";
import type { CreateOrderItem, PaymentPath } from "@/types/order";
import { selectPayableLines } from "@/lib/cart";
import { useCart } from "@/lib/cart-context";
import {
  summariseCartPrepayment,
  type CartPrepaymentSummary,
  type CodEligibilityEntry,
} from "@/lib/cod";
import { readCheckoutData, stampCheckoutDataOrder } from "@/lib/checkout";
import { formatRupees } from "@/lib/format";
import {
  CART_PATH,
  CHECKOUT_ADDRESS_PATH,
  CREATE_ORDER_API_PATH,
  buildOrderConfirmationHref,
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
import { PaymentChoice, type PaymentChoiceOption } from "@/components/PaymentChoice";
import { PaymentErrorNotice } from "@/components/PaymentErrorNotice";

type PaymentStatus = "idle" | "creating" | "redirecting";

export interface PaymentCheckoutProps {
  /**
   * The cash-on-delivery catalogue, handed down by the Server Component that renders this.
   *
   * It arrives as a prop rather than being read off the cart's own catalogue entries, and the
   * reason is [ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md):
   * `minPrepaidAmount` lives in an accessor of its own so that no object carrying a price
   * carries it too. Adding it to `CatalogueEntry` would have put it in the same object as
   * `price` in every cart line in the browser, which is exactly the seal that ADR argued for.
   * What the shopper sees is decided from this; what they are charged is decided again on the
   * server from the same accessor, and only the second decision is binding.
   */
  codCatalogue: readonly CodEligibilityEntry[];
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * The two options this cart may be paid by, always exactly two and always with full prepayment
 * among them.
 *
 * The cart's own pieces decide which pair it gets, never its value: a cart whose every line is
 * COD-eligible is offered cash on delivery, and one holding a piece with a prepayment floor is
 * offered that floor instead ([ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md)).
 * A floor that has grown to meet or exceed the total collapses the pair back to paying in full,
 * because "pay the minimum" and "pay in full" would otherwise be two buttons charging the same
 * amount and only one of them would leave a balance owing.
 *
 * Every figure here is rendered, not decided. `/api/create-order` recomputes both from its own
 * catalogue read and refuses a path this cart does not permit, so a stale or tampered set of
 * options costs the shopper a refusal rather than costing the shop an order.
 */
function buildPaymentChoiceOptions(
  prepayment: CartPrepaymentSummary | null,
  total: number,
): PaymentChoiceOption[] {
  const payInFull: PaymentChoiceOption = {
    path: "full",
    label: "Pay in full",
    amountNow: total,
    description: "Pay the whole amount now by UPI, card, net banking or a wallet.",
  };

  if (prepayment === null) return [payInFull];

  if (prepayment.isCodEligible) {
    return [
      {
        path: "cod",
        label: "Cash on delivery",
        amountNow: 0,
        description: `Pay nothing now. Have ${formatRupees(total)} ready in cash when your order arrives.`,
      },
      payInFull,
    ];
  }

  const floor = prepayment.minimumPrepayment;
  if (floor <= 0 || floor >= total) return [payInFull];

  return [
    {
      path: "partial",
      label: "Pay minimum now",
      amountNow: floor,
      description: `One piece in this order needs part payment up front. The remaining ${formatRupees(total - floor)} is due before delivery and is collected separately.`,
    },
    payInFull,
  ];
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
export function PaymentCheckout({ codCatalogue }: PaymentCheckoutProps): JSX.Element {
  const { lines, subtotal, shipping, total, hasUnavailableItems, isHydrated } =
    useCart();
  const router = useRouter();

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isRestoreAttempted, setIsRestoreAttempted] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [failure, setFailure] = useState<PaymentFailure | null>(null);
  const [selectedPath, setSelectedPath] = useState<PaymentPath>("full");

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
          paymentPath: selectedPath,
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

    if (body.paymentType === "cod") {
      stampCheckoutDataOrder({
        paymentReference: body.codOrderReference,
        trackingId: body.trackingId,
        amountPrepaid: body.amountPrepaid,
        amountDue: body.amountDue,
      });

      router.push(buildOrderConfirmationHref(body.codOrderReference));
      return;
    }

    stampCheckoutDataOrder({
      paymentReference: body.cashfreeOrderId,
      trackingId: body.trackingId,
      amountPrepaid: body.amountPrepaid,
      amountDue: body.amountDue,
    });

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

  const prepayment = summariseCartPrepayment(
    selectPayableLines(lines).map((line) => ({
      productId: line.entry.id,
      qty: line.quantity,
    })),
    codCatalogue,
  );

  const paymentOptions = buildPaymentChoiceOptions(prepayment, total);
  const chosenPath = paymentOptions.some((option) => option.path === selectedPath)
    ? selectedPath
    : "full";
  const amountNow =
    paymentOptions.find((option) => option.path === chosenPath)?.amountNow ?? total;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-heading-sm text-ink">Review and pay</h2>
          <p className="max-w-prose text-body-sm text-muted">
            Online payment is handled by Cashfree on their secure page. We never see your
            card or UPI details, and every amount below is confirmed by our server before
            anything is charged.
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

        {paymentOptions.length < 2 ? null : (
          <PaymentChoice
            options={paymentOptions}
            value={chosenPath}
            disabled={isBusy}
            onChange={setSelectedPath}
          />
        )}

        <div className="flex flex-col gap-3">
          <Button
            fullWidth
            onClick={handlePay}
            disabled={isPayDisabled}
            aria-busy={isBusy}
          >
            {status !== "idle"
              ? chosenPath === "cod"
                ? "Placing your order…"
                : "Taking you to Cashfree…"
              : chosenPath === "cod"
                ? `Place order and pay ${formatRupees(total)} on delivery`
                : `Pay ${formatRupees(amountNow)} with Cashfree`}
          </Button>

          <p className="text-body-sm text-muted">
            {chosenPath === "cod"
              ? "Nothing is charged now. We will confirm your order on the next screen."
              : "You will be redirected to Cashfree to complete the payment, then brought back here."}{" "}
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
