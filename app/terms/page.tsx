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
  description: `The terms that apply when you browse and order from ${SITE_CONFIG.brandName}, covering eligibility, order acceptance, pricing in INR, and governing law.`,
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
      <h2>1. Introduction</h2>
      <p>
        This site is operated by {LEGAL_CONFIG.entityName} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;), trading as {SITE_CONFIG.brandName}. By
        browsing this site, adding a piece to your cart or placing an order, you accept
        these terms in full. If you do not accept them, please do not use the site.
      </p>
      <p>
        These terms sit alongside our <Link href="/privacy">Privacy Policy</Link>,{" "}
        <Link href="/shipping">Shipping Policy</Link> and{" "}
        <Link href="/refund">Refund &amp; Cancellation Policy</Link>. Together they form the
        whole agreement between us.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least {LEGAL_CONFIG.minimumAge} years old to place an order. If you
        are under {LEGAL_CONFIG.minimumAge}, you may use this site only with the involvement
        of a parent or legal guardian, who takes responsibility for the order and for these
        terms.
      </p>
      <p>
        By ordering you confirm that the details you give us are accurate and that you are
        authorised to use the payment method presented at checkout.
      </p>

      <h2>3. Products</h2>
      <p>
        We sell handcrafted and curated artificial jewellery. Our pieces are fashion
        jewellery. They are not precious metal or precious stone jewellery, and they are
        not sold as an investment.
      </p>
      <p>
        Photography, weights, dimensions and finishes are described as accurately as we can
        make them. Colour can vary between screens, and slight variation between an
        individual piece and its listing is a property of handmade work rather than a
        defect.
      </p>
      <p>
        <strong>
          Product descriptions, specifications, availability and prices may change without
          notice.
        </strong>{" "}
        We may add, alter or withdraw a piece from the catalogue at any time.
      </p>

      <h2>4. Orders</h2>
      <p>
        A listing is an invitation to order, not an offer. Every order is{" "}
        <strong>subject to acceptance by us and to availability</strong>. Placing an order
        and completing payment does not by itself form a contract of sale; your order is
        accepted when we confirm dispatch.
      </p>
      <p>
        We may decline or cancel an order before dispatch, for example if a piece is out of
        stock, if the delivery address is outside the area we ship to, if an obvious pricing
        error is discovered, or if we cannot verify the payment. Where we cancel an order
        that has already been paid for, we refund it in full.
      </p>
      <p>
        Order totals are calculated on our server from the current catalogue at the moment
        the order is created. Amounts held in your browser are for display only and are
        never used to decide what you are charged.
      </p>

      <h2>5. Pricing and payment</h2>
      <p>
        All prices are shown in <strong>Indian Rupees (INR)</strong> and are{" "}
        <strong>inclusive of applicable taxes unless stated otherwise</strong>. There is no
        separate tax line at checkout. The price you see on a product is the price of that
        product.
      </p>
      <p>
        Where a struck-through price is shown alongside the selling price, it is a
        compare-at reference price and is never the amount charged.
      </p>
      <p>
        Shipping is a flat {formatRupees(FLAT_SHIPPING_RATE)} per order and{" "}
        <strong>free on orders of {formatRupees(FREE_SHIPPING_THRESHOLD)} or more</strong>.
        It is shown as its own line at checkout before you pay. See our{" "}
        <Link href="/shipping">Shipping Policy</Link>.
      </p>
      <p>
        Payments are processed by {LEGAL_CONFIG.paymentProvider} on their hosted checkout.
        You are redirected there to pay and returned here afterwards.{" "}
        <strong>We never see or store your card, UPI or banking details</strong>. They are
        handled entirely by the payment provider under their own terms and security
        standards.
      </p>

      <h2>6. Delivery, returns and cancellation</h2>
      <p>
        Dispatch and delivery timelines, shipping charges and our delivery area are set out
        in our <Link href="/shipping">Shipping Policy</Link>. Returns within{" "}
        {RETURN_WINDOW_DAYS} days, cancellations and refunds are set out in our{" "}
        <Link href="/refund">Refund &amp; Cancellation Policy</Link>. Both form part of these
        terms.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The {SITE_CONFIG.brandName} name, logo, product photography, written copy, design and
        code on this site belong to us or are used with permission. You may not copy,
        reproduce, republish or use them commercially without our written consent. Nothing on
        this site transfers any right in them to you.
      </p>

      <h2>8. Prohibited use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use this site for any unlawful or fraudulent purpose</li>
        <li>
          Access it by automated means at a rate that degrades it for other shoppers, or
          attempt to bypass any security measure
        </li>
        <li>
          Interfere with its operation, introduce malicious code, or attempt to manipulate
          prices, stock or order totals
        </li>
        <li>
          Resell our pieces as another brand, or reproduce our photography and copy for a
          competing listing
        </li>
      </ul>
      <p>
        We may refuse service, cancel an order or restrict access where we reasonably believe
        this clause has been breached.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        We provide this site and our products with reasonable care and skill. To the extent
        permitted by law, we are not liable for indirect or consequential loss, loss of
        profit, or loss arising from circumstances outside our reasonable control, including
        courier delays, payment provider outages and events of force majeure.
      </p>
      <p>
        Where we are found liable in connection with an order, our liability is limited to
        the amount paid for that order.
      </p>
      <p>
        Nothing in these terms limits or excludes liability that cannot lawfully be limited
        or excluded, including liability for death or personal injury caused by negligence,
        or for fraud. Your statutory rights as a consumer are unaffected.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The version published on this page when
        you place an order is the version that applies to that order. The date at the top of
        this page shows when it last changed.
      </p>

      <h2>11. Governing law and jurisdiction</h2>
      <p>
        These terms are governed by and construed in accordance with the laws of{" "}
        <strong>India</strong>. Any dispute arising out of or in connection with them is
        subject to the exclusive jurisdiction of the courts at{" "}
        {LEGAL_CONFIG.jurisdictionCity}, {LEGAL_CONFIG.jurisdictionState}, India.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms can go to{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>{" "}
        or through our <Link href="/contact">contact page</Link>. Our registered address is{" "}
        {CONTACT_CONFIG.addressLines.join(", ")}.
      </p>
    </PolicyPage>
  );
}
