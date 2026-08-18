import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACT_CONFIG,
  FLAT_SHIPPING_RATE,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { buildPageMetadata } from "@/lib/metadata";
import { PolicyPage } from "@/components/PolicyPage";

const PATH = "/shipping";

export const metadata: Metadata = buildPageMetadata({
  title: "Shipping Policy",
  description: `Flat ${formatRupees(FLAT_SHIPPING_RATE)} shipping across India on every Morchadi Gems order. Dispatch and delivery timelines, tracking, and our delivery area.`,
  path: PATH,
});

export default function ShippingPage(): JSX.Element {
  return (
    <PolicyPage
      roman="Shipping"
      accent="Policy"
      summary={`Flat ${formatRupees(FLAT_SHIPPING_RATE)} across India, however much you order.`}
      currentHref={PATH}
    >
      <h2>1. What shipping costs</h2>
      <p>
        <strong>A flat {formatRupees(FLAT_SHIPPING_RATE)} per order, anywhere in India.</strong>{" "}
        It is charged once per order, not per piece — one piece or ten, the shipping line at
        checkout reads {formatRupees(FLAT_SHIPPING_RATE)}.
      </p>
      <p>
        The charge is added at checkout and shown on its own line before you pay. There are
        no separate handling, packaging or fuel charges, and no surcharge for remote PIN
        codes.
      </p>

      <h2>2. Where we ship</h2>
      <p>
        <strong>India only.</strong> We deliver to serviceable PIN codes across all states
        and union territories, and the checkout offers Indian states and a six-digit PIN code
        for that reason.
      </p>
      <p>
        <strong>We do not ship internationally at present.</strong> If a PIN code turns out
        to be unserviceable by our courier after you have ordered, we will contact you and
        refund the order in full.
      </p>

      <h2>3. When your order leaves us</h2>
      <p>
        Orders are dispatched within <strong>{LEGAL_CONFIG.dispatchWindow}</strong> of
        payment being confirmed. Orders placed on a Sunday or a public holiday are processed
        on the next working day.
      </p>
      <p>
        Because pieces are finished by hand in small batches, an occasional order takes a
        little longer to prepare. If yours will, we tell you rather than letting it go quiet.
      </p>

      <h2>4. How long delivery takes</h2>
      <p>
        Once dispatched, delivery typically takes{" "}
        <strong>{LEGAL_CONFIG.deliveryWindow}</strong>, depending on the destination. Metro
        addresses are usually at the shorter end of that range.
      </p>
      <p>
        These are indicative timelines rather than guarantees. Once a parcel is with the
        courier, its progress is in their hands — weather, strikes, festival-season volumes
        and local restrictions can all add time.
      </p>

      <h2>5. Tracking</h2>
      <p>
        When your order is dispatched we email you a tracking reference and the courier it
        has gone with. Tracking usually takes a few hours to go live after you receive it —
        that gap is normal and not a sign of a problem.
      </p>

      <h2>6. Delivery attempts and address accuracy</h2>
      <p>
        Please check your delivery address and mobile number before paying. We dispatch to
        the address given at checkout, and once a parcel is with the courier we cannot change
        it.
      </p>
      <p>
        Couriers generally attempt delivery more than once. If a parcel is returned to us as
        undelivered, we will contact you to arrange a re-send at the standard{" "}
        {formatRupees(FLAT_SHIPPING_RATE)} charge, or refund the order less the original
        shipping charge.
      </p>

      <h2>7. Packaging</h2>
      <p>
        Every piece ships in its box and pouch inside a tamper-evident outer. Please keep the
        packaging until you are sure you are keeping the piece — it is needed for a return.
      </p>

      <h2>8. If something arrives damaged</h2>
      <p>
        If the outer packaging is visibly tampered with or damaged, photograph it before
        opening where you can, and contact us the same day. Damaged and incorrect deliveries
        are covered in full under our{" "}
        <Link href="/refund">Refund &amp; Cancellation Policy</Link>, which also gives you{" "}
        {RETURN_WINDOW_DAYS} days to return a piece you have simply changed your mind about.
      </p>

      <h2>9. Questions about a delivery</h2>
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
