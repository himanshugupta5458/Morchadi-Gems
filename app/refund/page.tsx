import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACT_CONFIG,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";
import { buildPageMetadata } from "@/lib/metadata";
import { PolicyPage } from "@/components/PolicyPage";

const PATH = "/refund";

export const metadata: Metadata = buildPageMetadata({
  title: "Refund & Cancellation Policy",
  description: `${SITE_CONFIG.brandName} accepts returns within ${RETURN_WINDOW_DAYS} days of delivery. How to return, what cannot be returned, how to cancel, and when your refund arrives.`,
  path: PATH,
});

export default function RefundPage(): JSX.Element {
  return (
    <PolicyPage
      roman="Refund &"
      accent="Cancellation"
      summary={`Returns within ${RETURN_WINDOW_DAYS} days, cancellation before dispatch, and refunds back to the way you paid.`}
      currentHref={PATH}
    >
      <h2>1. The {RETURN_WINDOW_DAYS}-day return window</h2>
      <p>
        You can return a piece within <strong>{RETURN_WINDOW_DAYS} days of delivery</strong>.
        Tell us within that window and we will arrange the return; the piece needs to be sent
        back promptly after that.
      </p>
      <p>
        This is the same {RETURN_WINDOW_DAYS}-day promise shown across the site. If you ever
        see a different number somewhere, this page is the one that applies.
      </p>

      <h2>2. Condition of returned pieces</h2>
      <p>To be accepted, a returned piece must be:</p>
      <ul>
        <li>
          <strong>Unused and unworn</strong>, undamaged and in its original condition
        </li>
        <li>
          <strong>In its original packaging</strong>, complete with the box, pouch, tags and
          any card it came with
        </li>
        <li>Packed well enough to survive the journey back</li>
      </ul>
      <p>
        Pieces that show wear, alteration, resizing or damage in return transit due to
        inadequate packing may be refused, or refunded in part. We will send you photographs
        and explain before deciding.
      </p>

      <h2>3. What cannot be returned</h2>
      <ul>
        <li>
          <strong>Made-to-order and personalized pieces</strong>, including letter and
          initial rings and anything engraved or made to your specification. These are made
          for you alone and cannot be resold, so they are non-returnable{" "}
          <strong>unless they arrive damaged or defective</strong>.
        </li>
        <li>
          <strong>Pierced jewellery</strong> — nose pins and earrings — where hygiene rules
          prevent resale, unless the piece is faulty
        </li>
        <li>
          <strong>Clearance and final-sale pieces</strong>
        </li>
      </ul>
      <p>
        These exclusions never limit your rights where a piece arrives faulty, damaged or not
        as described.
      </p>

      <h2>4. Damaged, defective or incorrect pieces</h2>
      <p>
        If a piece arrives damaged or defective, or is not what you ordered, tell us{" "}
        <strong>within {LEGAL_CONFIG.damageReportWindow} of delivery</strong> and send
        photographs of the piece and its packaging to{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>
        . We arrange collection at our cost and replace or refund the order in full,
        including any shipping charge paid on it.
      </p>
      <p>
        Reporting within {LEGAL_CONFIG.damageReportWindow} lets us raise the claim with the
        courier while it can still be investigated, which is why the window is short. See
        also our <Link href="/shipping">Shipping Policy</Link>.
      </p>

      <h2>5. Who pays return shipping</h2>
      <p>
        <strong>Change of mind:</strong> return postage is at your cost, and any shipping
        charge paid on the original order is not refunded. We do not arrange a pickup for
        change-of-mind returns.
      </p>
      <p>
        <strong>Faulty, damaged or incorrect pieces:</strong> we cover shipping both ways and
        arrange the collection ourselves. You are never out of pocket for a mistake of ours.
      </p>

      <h2>6. Cancelling an order</h2>
      <p>
        You can cancel <strong>free of charge at any point before dispatch</strong>. Since
        pieces usually leave within {LEGAL_CONFIG.dispatchWindow}, contact us as soon as you
        can and we will cancel it if it has not already gone.
      </p>
      <p>
        Once an order has been dispatched it cannot be cancelled, but it can be returned
        under the {RETURN_WINDOW_DAYS}-day window above.
      </p>
      <p>
        We may cancel an order ourselves if a piece turns out to be unavailable or a payment
        cannot be verified. If we do, you are refunded in full and we tell you why — see our{" "}
        <Link href="/terms">Terms &amp; Conditions</Link>.
      </p>

      <h2>7. How refunds are paid</h2>
      <p>
        Refunds go back <strong>to the original payment method</strong>, through{" "}
        {LEGAL_CONFIG.paymentProvider}. We cannot redirect a refund to a different card,
        account or UPI ID — the payment provider returns it the way it came.
      </p>
      <p>
        We start the refund once a returned piece has been received and inspected, or
        immediately on a pre-dispatch cancellation. It typically reaches you within{" "}
        <strong>{LEGAL_CONFIG.refundProcessingWindow}</strong>, though the final step depends
        on your bank or card issuer rather than on us.
      </p>

      <h2>8. Exchanges</h2>
      <p>
        We do not process direct exchanges. Return the piece for a refund and place a new
        order — it is faster and it keeps the {RETURN_WINDOW_DAYS}-day window clean on both
        sides. Where a piece arrived damaged or incorrect, we will send a replacement
        instead if you prefer one.
      </p>

      <h2>9. How to start a return or cancellation</h2>
      <p>
        Email{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>{" "}
        with your order number and, for a return, a photograph of the piece — or reach us
        through the <Link href="/contact">contact page</Link>. We reply within{" "}
        {CONTACT_CONFIG.replyWindow}.
      </p>
    </PolicyPage>
  );
}
