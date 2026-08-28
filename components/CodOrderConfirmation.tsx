"use client";

import { useCallback, useEffect, useState } from "react";
import type { CheckoutData } from "@/types/cart";
import type { CodOrderResult } from "@/types/order";
import { useCart } from "@/lib/cart-context";
import { clearCheckoutData, readCheckoutData } from "@/lib/checkout";
import { DELIVERY_ESTIMATE_LINE } from "@/lib/config";
import { buildCodOrderPath } from "@/lib/navigation";
import { saveAddressForNextTime } from "@/lib/saved-address";
import { SHOP_PATH } from "@/lib/shop-query";
import { parseCodOrderResult } from "@/lib/verify";
import { AddressRecap } from "@/components/AddressRecap";
import { AmountDueNotice } from "@/components/AmountDueNotice";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";
import { OrderNumberCallout, SupportLine } from "@/components/OrderNumberCallout";
import { OrderReceipt } from "@/components/OrderReceipt";
import { CheckIcon, GemOutlineIcon } from "@/components/icons";

/**
 * Three states and no fourth. There is no `pending` here and there could not be: a
 * cash-on-delivery order is placed the moment its row is written, and nothing about it is
 * still settling while the shopper watches.
 */
type CodConfirmationView =
  | { kind: "looking" }
  | { kind: "placed"; result: CodOrderResult }
  | { kind: "unavailable"; message: string; canRetry: boolean };

const UNREACHABLE_MESSAGE =
  "This is a problem reaching our own service, not a problem with your order. Your order is placed, so please try again in a moment.";

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return UNREACHABLE_MESSAGE;
  const message = (payload as Record<string, unknown>).message;
  return typeof message === "string" && message.length > 0 ? message : UNREACHABLE_MESSAGE;
}

function readRetryable(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return true;
  return (payload as Record<string, unknown>).retryable === true;
}

/**
 * Step three of checkout for an order the payment gateway never saw.
 *
 * Its sibling `OrderConfirmation` treats the arrival as a *question* because a Cashfree
 * redirect proves nothing about a payment. The same discipline applies here for a different
 * reason: the URL is still typeable by anyone, so the page asks the server what this reference
 * names rather than reading anything about the order out of the browser. What comes back is the
 * order number and the balance, both from Postgres. The stored bundle decorates it with the
 * items and the address and is never consulted about either figure.
 *
 * There is no payment to celebrate and the copy says so plainly. The success here is that the
 * order is *placed*; the money is a future event at the door, which is why the balance is given
 * the same prominence as the order number rather than being a line of small print.
 *
 * See [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md) and
 * [the cod-order contract](/docs/api/cod-order.md).
 */
export function CodOrderConfirmation({
  codOrderReference,
}: {
  codOrderReference: string;
}): JSX.Element {
  const { clearCart } = useCart();

  const [view, setView] = useState<CodConfirmationView>({ kind: "looking" });
  const [bundle, setBundle] = useState<CheckoutData | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);

  const checkAgain = useCallback(() => {
    setCheckAttempt((previousAttempt) => previousAttempt + 1);
  }, []);

  useEffect(() => {
    setBundle(readCheckoutData());
  }, []);

  useEffect(() => {
    let isEffectActive = true;

    async function look(): Promise<void> {
      let response: Response;
      try {
        response = await fetch(buildCodOrderPath(codOrderReference), { cache: "no-store" });
      } catch {
        if (isEffectActive) {
          setView({ kind: "unavailable", message: UNREACHABLE_MESSAGE, canRetry: true });
        }
        return;
      }

      const body = await readResponseBody(response);
      if (!isEffectActive) return;

      if (!response.ok) {
        setView({
          kind: "unavailable",
          message: readErrorMessage(body),
          canRetry: readRetryable(body),
        });
        return;
      }

      const result = parseCodOrderResult(body);
      if (result === null) {
        setView({ kind: "unavailable", message: UNREACHABLE_MESSAGE, canRetry: true });
        return;
      }

      setView({ kind: "placed", result });
    }

    setView({ kind: "looking" });
    void look();

    return () => {
      isEffectActive = false;
    };
  }, [codOrderReference, checkAttempt]);

  const placedResult = view.kind === "placed" ? view.result : null;

  /**
   * The side effects of a placed order, and the mirror of the paid order's. The bundle is
   * re-read rather than taken from state because this is the last moment it exists, and the
   * address is copied out in the same breath for the reason it is there: a completed order is
   * what makes an address worth remembering.
   *
   * No admin notification fires here. `/api/notify-admin` establishes that a message is
   * warranted by asking Cashfree whether the order was paid, and there is no such question to
   * ask about this one — see the note in the ADR.
   */
  useEffect(() => {
    if (placedResult === null) return;

    const placedBundle = readCheckoutData();
    if (placedBundle !== null) saveAddressForNextTime(placedBundle.address);

    clearCart();
    clearCheckoutData();
  }, [placedResult, clearCart]);

  if (view.kind === "looking") {
    return (
      <CenteredNotice
        isLiveRegion
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title="Confirming your order"
        message="We are looking your order up. This takes a moment, so please do not close this tab."
        footnote={`Order reference ${codOrderReference}`}
      />
    );
  }

  if (view.kind === "unavailable") {
    return (
      <CenteredNotice
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title="We could not show your order just yet"
        message={view.message}
        actions={view.canRetry ? <Button onClick={checkAgain}>Try again</Button> : undefined}
        footnote={
          <SupportLine>
            {`Order reference ${codOrderReference}. Quote it if you need to reach us at`}
          </SupportLine>
        }
      />
    );
  }

  const { result } = view;
  const displayableBundle =
    bundle !== null && bundle.orderId === result.codOrderReference ? bundle : null;

  return (
    <div className="flex flex-col gap-10">
      <CenteredNotice
        icon={
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold">
            <CheckIcon className="h-7 w-7" />
          </span>
        }
        title="Your order is placed"
        message="Your order is with us and nothing has been charged. You pay the courier in cash when it arrives."
        actions={<ButtonLink href={SHOP_PATH}>Continue shopping</ButtonLink>}
        footnote={
          <SupportLine>Keep your order number. Questions about this order go to</SupportLine>
        }
      >
        <OrderNumberCallout trackingId={result.trackingId} />

        {result.amountDue > 0 ? (
          <AmountDueNotice amountDue={result.amountDue} amountPrepaid={0} />
        ) : null}

        <p className="text-body-sm text-muted">{DELIVERY_ESTIMATE_LINE}</p>

        <p className="text-body-sm text-muted">Order reference {result.codOrderReference}</p>
      </CenteredNotice>

      {displayableBundle === null ? null : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem] lg:gap-8">
          <OrderReceipt
            items={displayableBundle.cart}
            subtotal={displayableBundle.subtotal}
            shipping={displayableBundle.shipping}
            total={displayableBundle.total}
          />
          <AddressRecap address={displayableBundle.address} />
        </div>
      )}
    </div>
  );
}
