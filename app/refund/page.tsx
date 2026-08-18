import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACT_CONFIG,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
} from "@/lib/config";
import { buildPageMetadata } from "@/lib/metadata";
import { PolicyPage } from "@/components/PolicyPage";

const PATH = "/refund";

export const metadata: Metadata = buildPageMetadata({
  title: "Refund & Cancellation Policy",
  description: `Morchadi Gems accepts returns within ${RETURN_WINDOW_DAYS} days of delivery. How to return, cancel an order, and when your refund arrives.`,
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
        <li>Unworn, undamaged and in its original condition</li>
        <li>Complete with its box, pouch, tags and any certificate it came with</li>
        <li>Packed well enough to survive the journey back</li>
      </ul>
      <p>
        Pieces that show wear, alteration, resizing or damage in return transit due to
        inadequate packing may be refused, or refunded in part. We will send you photographs
        and explain before deciding.
      </p>

      <h2>3. What cannot be returned</h2>
      <ul>
        <li>Pieces made, engraved or resized to order</li>
        <li>
          Pierced jewellery where hygiene rules prevent resale, such as nose pins and
          earrings, unless the piece is faulty
        </li>
        <li>Anything bought in a clearance or final-sale event</li>
      </ul>
      <p>
        These exclusions never limit your rights where a piece arrives faulty, damaged or not
        as described.
      </p>

      <h2>4. Faulty, damaged or wrong pieces</h2>
      <p>
        If a piece arrives faulty, damaged or is not what you ordered, contact us within{" "}
        {RETURN_WINDOW_DAYS} days of delivery with photographs. We will arrange collection at
        our cost and replace or refund it in full, including any shipping charge paid on the
        original order.
      </p>

      <h2>5. Return shipping costs</h2>
      <p>
        For a change-of-mind return, any shipping charge paid on the original order is not
        refunded, and return postage is at your cost — we do not arrange a pickup for
        change-of-mind returns. For a faulty or incorrect piece, we cover shipping both ways
        and arrange the collection ourselves.
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
        {LEGAL_CONFIG.refundProcessingWindow} of us starting it, though the final step
        depends on your bank or card issuer rather than on us.
      </p>

      <h2>8. Exchanges</h2>
      <p>
        We do not process direct exchanges. Return the piece for a refund and place a new
        order — it is faster and it keeps the {RETURN_WINDOW_DAYS}-day window clean on both
        sides.
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
