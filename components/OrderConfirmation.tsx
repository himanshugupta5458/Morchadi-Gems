"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutData } from "@/types/cart";
import type { VerifyOrderResult } from "@/types/order";
import { useCart } from "@/lib/cart-context";
import { clearCheckoutData, readCheckoutData } from "@/lib/checkout";
import { DELIVERY_ESTIMATE_LINE } from "@/lib/config";
import type { CrossSellShortlists } from "@/lib/cross-sell";
import { formatRupees } from "@/lib/format";
import {
  CART_PATH,
  CHECKOUT_PAYMENT_PATH,
  buildVerifyOrderPath,
} from "@/lib/navigation";
import { notifyAdminOfPaidOrder } from "@/lib/notify-client";
import { saveAddressForNextTime } from "@/lib/saved-address";
import { SHOP_PATH } from "@/lib/shop-query";
import {
  MAX_VERIFY_ATTEMPTS,
  PENDING_POLL_INTERVAL_MS,
  UNREACHABLE_VERIFICATION,
  canDisplayBundleForOrder,
  describeVerificationFailure,
  isCodOrderReference,
  isMorchadiOrderId,
  parseVerifyOrderResult,
  readBundleTrackingId,
  type OrderReference,
  type VerificationFailure,
} from "@/lib/verify";
import { AddressRecap } from "@/components/AddressRecap";
import { AmountDueNotice } from "@/components/AmountDueNotice";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";
import { CodOrderConfirmation } from "@/components/CodOrderConfirmation";
import { ConfirmationEmailNote } from "@/components/ConfirmationEmailNote";
import { CrossSellRow } from "@/components/CrossSellRow";
import { OrderNumberCallout, SupportLine } from "@/components/OrderNumberCallout";
import { OrderReceipt, toReceiptProps } from "@/components/OrderReceipt";
import { CheckIcon, GemOutlineIcon } from "@/components/icons";

/**
 * `verifying` covers both the first look and a manual re-check. `settled` carries whatever the
 * server concluded, including `PENDING` and `NOT_FOUND` — the four Cashfree-derived states are
 * one branch because they arrive the same way, and only their rendering differs.
 * `unverifiable` is the fifth, separate thing: our own route could not answer.
 */
type ConfirmationView =
  | { kind: "verifying" }
  | { kind: "settled"; result: VerifyOrderResult; isPollExhausted: boolean }
  | { kind: "unverifiable"; failure: VerificationFailure };

type VerifyOutcome =
  | { ok: true; result: VerifyOrderResult }
  | { ok: false; failure: VerificationFailure };

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestVerification(orderId: string): Promise<VerifyOutcome> {
  let response: Response;
  try {
    response = await fetch(buildVerifyOrderPath(orderId), { cache: "no-store" });
  } catch {
    return { ok: false, failure: UNREACHABLE_VERIFICATION };
  }

  const body = await readResponseBody(response);

  if (!response.ok) return { ok: false, failure: describeVerificationFailure(body) };

  const result = parseVerifyOrderResult(body);
  if (result === null) return { ok: false, failure: UNREACHABLE_VERIFICATION };

  return { ok: true, result };
}

/**
 * How the page refers to the order in a single line of running text, used in every footnote.
 *
 * The ten-character order number wins whenever there is one, because it is the reference a
 * shopper can actually read back to us. The Cashfree id is the fallback rather than a second
 * line: a footnote that offers two identifiers invites the wrong one to be quoted.
 */
function describeOrderReference(reference: OrderReference): string {
  return reference.trackingId === null
    ? `Payment reference ${reference.cashfreeOrderId}`
    : `Order number ${reference.trackingId}`;
}

function OrderFact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <dt className="text-label uppercase tracking-caps text-muted">{label}</dt>
      <dd className="font-sans text-body text-ink">{value}</dd>
    </div>
  );
}

/**
 * Step three of checkout: what actually happened to the payment.
 *
 * Landing here proves nothing. Cashfree redirects a browser to this URL, and a browser can be
 * pointed at it by hand, so the arrival is treated as a *question* rather than an answer: the
 * page asks `/api/verify-order`, which asks Cashfree, and only `status: "PAID"` from that round
 * trip produces a success screen. The same rule governs the side effects — the cart and the
 * `sessionStorage` bundle are cleared on a confirmed payment and on nothing else, so a shopper
 * whose payment is still settling, or failed, still has everything they need to try again.
 *
 * The stored bundle decorates a confirmed order with its items and address. It is never
 * consulted about whether the order was paid or about what it cost, and it is only shown when
 * it can be reconciled with the order the server verified. See
 * [the verify-order contract](/docs/api/verify-order.md).
 *
 * **The "Payment reference MG_…" fine print stays.** Unlike the `COD_…` reference its sibling
 * screen used to print, this one names something outside this codebase: it is the id Cashfree's
 * dashboard is searched by and the reference a bank dispute is raised against, and it is the
 * only identifier a shopper has if the Postgres capture failed and there is no order number
 * ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)). See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 *
 * There is no free-shipping nudge here either, for the reason it left the payment step: the
 * order is placed, and a nudge is an instruction to do something the shopper can no longer do.
 */

export interface OrderConfirmationProps {
  /** The per-category cross-sell shortlists, from the Server Component that renders this. */
  crossSellShortlists: CrossSellShortlists;
}

export function OrderConfirmation({
  crossSellShortlists,
}: OrderConfirmationProps): JSX.Element {
  const searchParams = useSearchParams();
  const requestedOrderId = searchParams.get("order_id")?.trim() ?? "";
  const orderId = isMorchadiOrderId(requestedOrderId) ? requestedOrderId : null;
  const codOrderReference = isCodOrderReference(requestedOrderId) ? requestedOrderId : null;

  const { clearCart } = useCart();

  const [view, setView] = useState<ConfirmationView>({ kind: "verifying" });
  const [bundle, setBundle] = useState<CheckoutData | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);

  const checkAgain = useCallback(() => {
    setCheckAttempt((previousAttempt) => previousAttempt + 1);
  }, []);

  /**
   * Read once, on mount, and held in React state — the bundle is removed from `sessionStorage`
   * as soon as a payment is confirmed, and the success screen still has to render after that.
   */
  useEffect(() => {
    setBundle(readCheckoutData());
  }, []);

  useEffect(() => {
    if (orderId === null) return;

    const orderIdToVerify = orderId;
    let isEffectActive = true;
    let pollTimerId: ReturnType<typeof setTimeout> | undefined;
    let attemptsMade = 0;

    async function verify(): Promise<void> {
      const outcome = await requestVerification(orderIdToVerify);
      if (!isEffectActive) return;

      attemptsMade += 1;

      if (!outcome.ok) {
        setView({ kind: "unverifiable", failure: outcome.failure });
        return;
      }

      const isPollExhausted = attemptsMade >= MAX_VERIFY_ATTEMPTS;
      setView({ kind: "settled", result: outcome.result, isPollExhausted });

      if (outcome.result.status === "PENDING" && !isPollExhausted) {
        pollTimerId = setTimeout(() => void verify(), PENDING_POLL_INTERVAL_MS);
      }
    }

    setView({ kind: "verifying" });
    void verify();

    return () => {
      isEffectActive = false;
      if (pollTimerId !== undefined) clearTimeout(pollTimerId);
    };
  }, [orderId, checkAttempt]);

  const paidResult =
    view.kind === "settled" && view.result.status === "PAID" ? view.result : null;

  /**
   * The order number, from the server first and the browser second.
   *
   * `/api/verify-order` reads it out of Postgres by the Cashfree id in this page's URL, so it
   * survives a refresh, a second device and a browser that refuses session storage — the
   * limitation ADR-043 shipped with and [ADR-045](/docs/decisions/ADR-045-public-order-tracking.md)
   * closes. The stamped bundle stays as the fallback because it is available on the very first
   * paint, before the round trip to Cashfree has returned, and it is checked against the order
   * being confirmed before it is believed.
   *
   * The two cannot disagree about a live order: both are written from the same create-order
   * response. When the capture failed there is no order number anywhere, both are null, and the
   * page names the payment reference instead.
   */
  const verifiedTrackingId = view.kind === "settled" ? view.result.trackingId : null;

  const orderReference: OrderReference = {
    trackingId: verifiedTrackingId ?? readBundleTrackingId(bundle, orderId ?? ""),
    cashfreeOrderId: orderId ?? "",
  };

  /**
   * The side effects of a confirmed payment, and the only place either store is emptied.
   * Idempotent by construction: a refresh re-verifies, arrives at `PAID` again, and clears an
   * already-empty cart and an already-absent bundle.
   *
   * The bundle is re-read here rather than taken from state, because this is the last moment
   * it exists — `clearCheckoutData` below removes it — and its two consumers here need the
   * items and the address themselves rather than a rendering of them.
   *
   * `notifyAdminOfPaidOrder` returns nothing and is not awaited. It cannot delay the success
   * screen, and it cannot stop the cart being cleared: whatever happens to the WhatsApp
   * message, the lines after it run.
   *
   * The address is copied out to `localStorage` in the same breath, and this is the only moment
   * it could be: a confirmed payment is what makes an address worth remembering, and the bundle
   * holding it is removed on the next line. Saving at `/address` instead would remember details
   * from a checkout that was abandoned at the payment page.
   */
  useEffect(() => {
    if (paidResult === null) return;

    const paidBundle = readCheckoutData();

    notifyAdminOfPaidOrder(paidResult, paidBundle);
    if (paidBundle !== null) saveAddressForNextTime(paidBundle.address);

    clearCart();
    clearCheckoutData();
  }, [paidResult, clearCart]);

  /**
   * A cash-on-delivery reference is handed over whole rather than branched on further down.
   *
   * The two screens share a URL because Cashfree builds that URL for the paths it handles and
   * this page has to answer both, but they share almost nothing else: one asks a payment
   * gateway whether money moved and polls while it settles, and the other asks our own database
   * what an order says and is finished in one request. Splitting here keeps the verification
   * machinery below untouched by a path that has no payment to verify.
   */
  if (codOrderReference !== null) {
    return (
      <CodOrderConfirmation
        codOrderReference={codOrderReference}
        crossSellShortlists={crossSellShortlists}
      />
    );
  }

  if (orderId === null) {
    return (
      <CenteredNotice
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title="That link is missing an order"
        message="This page confirms a completed payment, and the link you followed does not name an order we can look up. If you have just paid, check the link in your browser history before starting again."
        actions={
          <>
            <ButtonLink href={SHOP_PATH}>Continue shopping</ButtonLink>
            <ButtonLink href={CART_PATH} variant="secondary">
              Back to cart
            </ButtonLink>
          </>
        }
        footnote={<SupportLine>Paid and cannot find your order? Email us at</SupportLine>}
      />
    );
  }

  if (view.kind === "verifying") {
    return (
      <CenteredNotice
        isLiveRegion
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title="Confirming your payment"
        message="We are checking with the payment gateway. This takes a moment, so please do not close this tab."
        footnote={describeOrderReference(orderReference)}
      />
    );
  }

  if (view.kind === "unverifiable") {
    return (
      <CenteredNotice
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title={view.failure.title}
        message={view.failure.message}
        actions={
          view.failure.canRetry ? <Button onClick={checkAgain}>Try again</Button> : undefined
        }
        footnote={
          <SupportLine>
            {`${describeOrderReference(orderReference)}. Quote it if you need to reach us at`}
          </SupportLine>
        }
      />
    );
  }

  const { result, isPollExhausted } = view;

  if (result.status === "PAID") {
    const displayableBundle = canDisplayBundleForOrder(bundle, result) ? bundle : null;
    const receiptTotals =
      displayableBundle === null ? null : toReceiptProps(displayableBundle);

    return (
      <div className="flex flex-col gap-10">
        <CenteredNotice
          icon={
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold">
              <CheckIcon className="h-7 w-7" />
            </span>
          }
          title="Your order is confirmed"
          message={
            result.amountDue !== null && result.amountDue > 0
              ? "Your payment went through and your order is with us. The balance below is due when it is delivered."
              : "Your payment went through and your order is with us. Nothing more is needed from you."
          }
          actions={<ButtonLink href={SHOP_PATH}>Continue shopping</ButtonLink>}
          footnote={
            <SupportLine>Keep your order number. Questions about this order go to</SupportLine>
          }
        >
          {orderReference.trackingId === null ? null : (
            <OrderNumberCallout trackingId={orderReference.trackingId} />
          )}

          {result.amountDue !== null && result.amountDue > 0 ? (
            <AmountDueNotice
              amountDue={result.amountDue}
              amountPrepaid={result.amount ?? 0}
            />
          ) : null}

          <dl className="flex w-full max-w-sm flex-col gap-3 border-y border-line py-6">
            {orderReference.trackingId === null ? (
              <OrderFact label="Payment reference" value={result.orderId} />
            ) : null}
            {result.amount === null ? null : (
              <OrderFact
                label={
                  result.amountDue !== null && result.amountDue > 0
                    ? "Paid online"
                    : "Amount paid"
                }
                value={formatRupees(result.amount)}
              />
            )}
          </dl>

          <p className="text-body-sm text-muted">{DELIVERY_ESTIMATE_LINE}</p>

          {displayableBundle === null ? null : (
            <ConfirmationEmailNote email={displayableBundle.address.email} />
          )}

          {orderReference.trackingId === null ? null : (
            <p className="text-body-sm text-muted">
              Payment reference {result.orderId}
            </p>
          )}
        </CenteredNotice>

        {displayableBundle === null || receiptTotals === null ? null : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem] lg:gap-8">
            <OrderReceipt items={displayableBundle.cart} {...receiptTotals} />
            <AddressRecap address={displayableBundle.address} />
          </div>
        )}

        {displayableBundle === null ? null : (
          <CrossSellRow
            basket={displayableBundle.cart.map((item) => ({
              productId: item.productId,
              amount: item.price * item.qty,
            }))}
            shortlists={crossSellShortlists}
            roman="Complete"
            accent="the Look"
            subtitle="More from the same collection, for the next time."
          />
        )}
      </div>
    );
  }

  if (result.status === "PENDING") {
    return isPollExhausted ? (
      <CenteredNotice
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title="Your payment is still processing"
        message="The gateway has not confirmed this payment yet. Some banks and UPI apps take a few minutes. Nothing has been lost. Check again in a moment, and if it was taken you will see it here."
        actions={
          <>
            <Button onClick={checkAgain}>Check again</Button>
            <ButtonLink href={CART_PATH} variant="secondary">
              Back to cart
            </ButtonLink>
          </>
        }
        footnote={
          <SupportLine>
            {`${describeOrderReference(orderReference)}. If your bank shows the payment but this page does not, email us at`}
          </SupportLine>
        }
      />
    ) : (
      <CenteredNotice
        isLiveRegion
        icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
        title="We are confirming your payment"
        message="The gateway has not finished with this payment yet. We are re-checking every few seconds, so please stay on this page."
        footnote={describeOrderReference(orderReference)}
      />
    );
  }

  const isUnknownOrder = result.status === "NOT_FOUND";

  return (
    <CenteredNotice
      icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
      title={isUnknownOrder ? "We could not find that order" : "Your payment was not completed"}
      message={
        isUnknownOrder
          ? "The payment gateway has no record of this order, so nothing has been charged. If you were part-way through paying, start again from your cart. It is still exactly as you left it."
          : "The payment did not go through, so nothing has been charged. Your cart and delivery details are untouched, so you can pick up where you left off."
      }
      actions={
        <>
          <ButtonLink href={CHECKOUT_PAYMENT_PATH}>Retry payment</ButtonLink>
          <ButtonLink href={CART_PATH} variant="secondary">
            Back to cart
          </ButtonLink>
        </>
      }
      footnote={
        <SupportLine>
          {`${describeOrderReference(orderReference)}. If your bank shows a charge against it, email us at`}
        </SupportLine>
      }
    />
  );
}
