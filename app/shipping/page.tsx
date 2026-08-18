import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACT_CONFIG,
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { buildPageMetadata } from "@/lib/metadata";
import { PolicyPage } from "@/components/PolicyPage";

const PATH = "/shipping";

export const metadata: Metadata = buildPageMetadata({
  title: "Shipping Policy",
  description: `Free shipping across ${LEGAL_CONFIG.shippingScope} on ${SITE_CONFIG.brandName} orders of ${formatRupees(FREE_SHIPPING_THRESHOLD)} or more, ${formatRupees(FLAT_SHIPPING_RATE)} below that. Dispatch within ${LEGAL_CONFIG.dispatchWindow}, delivery within ${LEGAL_CONFIG.deliveryWindow}.`,
  path: PATH,
});

export default function ShippingPage(): JSX.Element {
  return (
    <PolicyPage
      roman="Shipping"
      accent="Policy"
      summary={`Dispatch within ${LEGAL_CONFIG.dispatchWindow}, delivery within ${LEGAL_CONFIG.deliveryWindow}, free over ${formatRupees(FREE_SHIPPING_THRESHOLD)}.`}
      currentHref={PATH}
    >
      <h2>1. Order processing and dispatch</h2>
      <p>
        Orders are processed and dispatched{" "}
        <strong>within {LEGAL_CONFIG.dispatchWindow}</strong> of payment being confirmed.
      </p>
      <p>
        Orders placed on a weekend or a public holiday are processed on the next business
        day. Made-to-order and personalized pieces — letter rings and anything engraved to
        your specification — may need a little longer to prepare; where that applies, it is
        noted on the product page at the time of purchase.
      </p>

      <h2>2. Delivery timelines</h2>
      <p>
        Once dispatched, delivery takes{" "}
        <strong>up to {LEGAL_CONFIG.deliveryWindow}</strong>, depending on the destination.
        Metro addresses are usually at the shorter end of that range.
      </p>
      <p>
        We deliver across {LEGAL_CONFIG.shippingScope} to serviceable PIN codes in all states
        and union territories. These are indicative timelines rather than guarantees.
      </p>

      <h2>3. Shipping charges</h2>
      <p>
        <strong>
          Free anywhere in {LEGAL_CONFIG.shippingScope} on orders of{" "}
          {formatRupees(FREE_SHIPPING_THRESHOLD)} or more.
        </strong>{" "}
        Below that, a flat {formatRupees(FLAT_SHIPPING_RATE)} per order. The threshold is
        inclusive — an order subtotal of exactly {formatRupees(FREE_SHIPPING_THRESHOLD)}{" "}
        ships free.
      </p>
      <p>
        The subtotal that decides this is the value of the pieces themselves, before
        shipping. Where shipping is charged it is charged once per order, not per piece — one
        piece or ten, the shipping line reads {formatRupees(FLAT_SHIPPING_RATE)}.
      </p>
      <p>
        Shipping is shown on its own line at checkout before you pay, and is calculated on
        our server from the current catalogue rather than in your browser. There are no
        separate handling, packaging or fuel charges, and no surcharge for remote PIN codes.
      </p>
      <p>
        <strong>
          We ship within {LEGAL_CONFIG.shippingScope} only and do not deliver outside it.
        </strong>{" "}
        If a PIN code turns out to be unserviceable by our courier after you have ordered, we
        will contact you and refund the order in full.
      </p>

      <h2>4. Order tracking</h2>
      <p>
        When your order is dispatched we email you a tracking number and the courier it has
        gone with. Tracking can take up to 24 hours to start updating after you receive it —
        that gap is normal and not a sign of a problem.
      </p>
      <p>
        Please check your delivery address and mobile number before paying. We dispatch to
        the address given at checkout, and once a parcel is with the courier we cannot change
        it.
      </p>

      <h2>5. Delivery conditions</h2>
      <p>
        Once a parcel is handed to the courier, its progress is in their hands. We are not
        liable for delays caused by the courier, by weather, strikes, festival-season
        volumes, local restrictions or other circumstances outside our reasonable control.
      </p>
      <p>
        We are also not liable for loss or theft after a parcel has been marked delivered to
        the address given at checkout. Couriers generally attempt delivery more than once; if
        a parcel is returned to us as undelivered, we will contact you to arrange a re-send
        at the standard {formatRupees(FLAT_SHIPPING_RATE)} charge, or refund the order less
        any shipping charge paid on it.
      </p>
      <p>
        Every piece ships in its box and pouch inside a tamper-evident outer. Please keep the
        packaging until you are sure you are keeping the piece — it is needed for a return.
      </p>

      <h2>6. Damaged or incorrect deliveries</h2>
      <p>
        If a parcel arrives visibly tampered with, or a piece arrives damaged or is not what
        you ordered, tell us{" "}
        <strong>within {LEGAL_CONFIG.damageReportWindow} of delivery</strong> with
        photographs of the piece and its packaging, at{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>
        .
      </p>
      <p>
        We will offer a replacement, an exchange or a refund at our discretion, having looked
        at the photographs. Where a replacement is agreed, it is dispatched within{" "}
        {LEGAL_CONFIG.replacementDispatchWindow}. The full terms are in our{" "}
        <Link href="/refund">Refund &amp; Cancellation Policy</Link>, which also gives you{" "}
        {RETURN_WINDOW_DAYS} days to return a piece you have simply changed your mind about.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy as our couriers and delivery area change. The date at the
        top of this page shows when it last changed, and the version published when you place
        an order is the version that applies to it.
      </p>

      <h2>8. Questions about a delivery</h2>
      <p>
        Email{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>{" "}
        with your order number, or use the <Link href="/contact">contact page</Link>. We
        reply within {CONTACT_CONFIG.replyWindow}.
      </p>
    </PolicyPage>
  );
}
