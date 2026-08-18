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

const PATH = "/terms";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms & Conditions",
  description:
    "The terms that apply when you browse and order from Morchadi Gems — pricing in INR, order acceptance, payment, and governing law.",
  path: PATH,
});

export default function TermsPage(): JSX.Element {
  return (
    <PolicyPage
      roman="Terms &"
      accent="Conditions"
      summary="The agreement between you and us when you use this site or place an order."
      currentHref={PATH}
    >
      <h2>1. Who these terms are between</h2>
      <p>
        This site is operated by {LEGAL_CONFIG.entityName} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;), trading as {SITE_CONFIG.brandName}. By browsing this site or
        placing an order you accept these terms. If you do not accept them, please do not
        use the site.
      </p>

      <h2>2. Using this site</h2>
      <p>
        You may browse, share and order for your own personal, non-commercial use. You agree
        not to interfere with the site&apos;s operation, attempt to access it by automated
        means at a rate that degrades it for others, or use it to do anything unlawful.
      </p>
      <p>
        We do not offer user accounts. Everything on this site works as a guest — there is
        nothing to register for, no password to keep, and no profile held on our side.
      </p>

      <h2>3. Products and descriptions</h2>
      <p>
        Every piece is finished by hand in small batches. Photography, weights and dimensions
        are as accurate as we can make them, but slight variation between an individual piece
        and its listing is a property of handmade work rather than a defect.
      </p>
      <p>
        Listings are an invitation to order, not an offer. Availability can change between
        you adding a piece to your cart and completing checkout; if a piece sells out in that
        window your cart will tell you before you can pay for it.
      </p>

      <h2>4. Pricing</h2>
      <p>
        All prices are shown in Indian Rupees (INR) and are{" "}
        <strong>inclusive of applicable taxes</strong>. There is no separate tax line at
        checkout — the price you see on a product is the price of that product.
      </p>
      <p>
        Where a struck-through price is shown alongside the selling price, it is a
        compare-at reference price and is never the amount charged. Shipping across India is
        free on orders of {formatRupees(FREE_SHIPPING_THRESHOLD)} or more and a flat{" "}
        {formatRupees(FLAT_SHIPPING_RATE)} below that, added once at checkout however many
        pieces are in the order. See our <Link href="/shipping">Shipping Policy</Link>.
      </p>
      <p>
        We take care to price accurately. If an obvious pricing error is discovered before an
        order is dispatched, we may cancel the order and refund it in full rather than
        fulfil it at the erroneous price. We will tell you if this happens.
      </p>

      <h2>5. Orders and acceptance</h2>
      <p>
        Placing an order and completing payment does not by itself form a contract of sale.
        Your order is <strong>accepted</strong> when we confirm dispatch. Until then we may
        decline it — for example if a piece is out of stock, if the delivery address is
        outside the area we ship to, or if we cannot verify the payment. Where we decline an
        accepted payment, we refund it in full.
      </p>
      <p>
        Order totals are calculated on our server from the current catalogue at the moment
        the order is created. Amounts held in your browser are for display only and are not
        used to determine what you are charged.
      </p>

      <h2>6. Payment</h2>
      <p>
        Payments are processed by {LEGAL_CONFIG.paymentProvider} on their hosted checkout.
        You are redirected to {LEGAL_CONFIG.paymentProvider} to pay and returned here
        afterwards. <strong>We never see or store your card, UPI or banking details</strong>
        {" "}— they are handled entirely by the payment provider under their own terms and
        security standards.
      </p>

      <h2>7. Delivery, returns and cancellation</h2>
      <p>
        Delivery timelines, shipping charges and coverage are set out in our{" "}
        <Link href="/shipping">Shipping Policy</Link>. Returns within{" "}
        {RETURN_WINDOW_DAYS} days, cancellations and refunds are set out in our{" "}
        <Link href="/refund">Refund &amp; Cancellation Policy</Link>. Both form part of these
        terms.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        The {SITE_CONFIG.brandName} name, logo, product photography, written copy, design and
        code on this site belong to us or are used with permission. You may not copy,
        reproduce or use them commercially without our written consent. Nothing on this site
        transfers any right in them to you.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        We provide this site and our products with reasonable care and skill. To the extent
        permitted by law, we are not liable for indirect or consequential loss, loss of
        profit, or loss arising from circumstances outside our reasonable control — including
        courier delays, payment provider outages and events of force majeure.
      </p>
      <p>
        Nothing in these terms limits or excludes liability that cannot lawfully be limited
        or excluded, including liability for death or personal injury caused by negligence,
        or for fraud. Your statutory rights as a consumer are unaffected.
      </p>

      <h2>10. Privacy</h2>
      <p>
        How we handle the details you give us is set out in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The version published on this page when
        you place an order is the version that applies to that order. The date at the top of
        this page shows when it last changed.
      </p>

      <h2>12. Governing law and jurisdiction</h2>
      <p>
        These terms are governed by the laws of India. Any dispute arising out of them is
        subject to the exclusive jurisdiction of the courts at{" "}
        {LEGAL_CONFIG.jurisdictionCity}, {LEGAL_CONFIG.jurisdictionState}, India.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms can go to{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>{" "}
        or through our <Link href="/contact">contact page</Link>.
      </p>
    </PolicyPage>
  );
}
