import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_CONFIG, LEGAL_CONFIG, SITE_CONFIG } from "@/lib/config";
import { buildPageMetadata } from "@/lib/metadata";
import { PolicyPage } from "@/components/PolicyPage";

const PATH = "/privacy";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: `What ${SITE_CONFIG.brandName} collects, why, and what we do not collect: no accounts, no stored card details, and no sale of your data.`,
  path: PATH,
});

export default function PrivacyPage(): JSX.Element {
  return (
    <PolicyPage
      roman="Privacy"
      accent="Policy"
      summary="What we collect, why we collect it, and what stays on your own device."
      currentHref={PATH}
    >
      <h2>1. Introduction</h2>
      <p>
        {SITE_CONFIG.brandName} is operated by {LEGAL_CONFIG.entityName}. This policy
        explains what personal information we collect when you use this site, why we collect
        it, who we share it with, and what you can ask us to do with it.
      </p>
      <p>
        We ask for the least we can. Checkout is guest-only, with no sign-up, no password
        and no profile held on our side, so the information below is collected to fulfil an
        order or to answer a message, and for nothing else.
      </p>

      <h2>2. Information we collect</h2>
      <h3>When you place an order</h3>
      <ul>
        <li>Your name, so we know who the parcel is for</li>
        <li>Your delivery address and PIN code, so it can reach you</li>
        <li>Your mobile number, for delivery updates from us and from the courier</li>
        <li>Your email address, for the order confirmation</li>
        <li>What you ordered, and the amount charged</li>
      </ul>

      <h3>When you contact us</h3>
      <ul>
        <li>Your name, email address and the message you send</li>
      </ul>

      <h3>Usage data</h3>
      <p>
        Our hosting provider records standard technical information when a page is served:
        IP address, browser and device type, the pages requested and the time of the request.
        It is used for security, for diagnosing faults and for understanding which pages are
        used, not for building a profile of you.
      </p>

      <h3>What we do not collect</h3>
      <ul>
        <li>
          <strong>Card, UPI or bank details.</strong> See section 3.
        </li>
        <li>
          <strong>Account credentials.</strong> There is no sign-up and no password on this
          site, because there is no account to hold.
        </li>
        <li>
          <strong>Anything we do not need.</strong> We do not ask for a date of birth,
          gender, or identity documents.
        </li>
      </ul>

      <h2>3. Payments</h2>
      <p>
        Payments are processed by <strong>{LEGAL_CONFIG.paymentProvider}</strong> on their
        own hosted checkout. Your card, UPI or net-banking details are entered on their page,
        not ours.{" "}
        <strong>
          We do not receive, store or have any access to your card or banking details
        </strong>
        . They never reach our servers or our logs. {LEGAL_CONFIG.paymentProvider} handles
        them under their own privacy policy and security standards, and returns only whether
        the payment succeeded.
      </p>

      <h2>4. Cookies and browser storage</h2>
      <p>
        We do not set advertising or cross-site tracking cookies. Cookies or similar storage
        may be set by {LEGAL_CONFIG.paymentProvider} during checkout, and by our hosting
        provider for security and basic performance, in order for the site to function.
      </p>
      <p>Two things are stored on your own device rather than sent to us:</p>
      <ul>
        <li>
          <strong>Your cart</strong>, in <code>localStorage</code>, so it survives a reload
          while you shop. It stays until you clear it or clear your browser data.
        </li>
        <li>
          <strong>Your checkout details</strong>, in <code>sessionStorage</code>, so your
          order summary and address survive the redirect to the payment page. They are
          discarded when you close the tab.
        </li>
      </ul>
      <p>
        Neither is transmitted to us as you browse. Your delivery details reach us only when
        you complete an order. You can clear both at any time by clearing your browser
        storage for this site.
      </p>

      <h2>5. How we use your information</h2>
      <ul>
        <li>To process, pack, dispatch and deliver your order</li>
        <li>To send order confirmations, dispatch notices and tracking details</li>
        <li>To handle returns, cancellations and refunds</li>
        <li>To answer enquiries sent through the contact page or by email</li>
        <li>To keep records required for accounting and tax under Indian law</li>
        <li>To protect the site against fraud, abuse and technical faults</li>
      </ul>

      <h2>6. How we share your information</h2>
      <p>
        <strong>We do not sell, rent or trade your personal information</strong>, and we do
        not share it for anyone else&apos;s marketing. We share the minimum necessary with:
      </p>
      <ul>
        <li>
          <strong>{LEGAL_CONFIG.paymentProvider}</strong>, our payment processor, to take
          payment and to process refunds, under their own privacy policy
        </li>
        <li>
          <strong>Our delivery partners</strong>, who receive the name, address and phone
          number needed to deliver your parcel
        </li>
        <li>
          <strong>Our hosting and email providers</strong>, who run the site and send order
          messages
        </li>
        <li>
          <strong>Legal authorities</strong>, where we are required to by law, or to
          establish or defend a legal claim
        </li>
      </ul>

      <h2>7. How long we keep it</h2>
      <p>
        Order records are kept as long as we need them for accounting, tax and warranty
        purposes under Indian law. Messages sent through the contact form are kept only as
        long as needed to resolve the enquiry.
      </p>

      <h2>8. Data security</h2>
      <p>
        The site is served over HTTPS, and payment details are handled entirely by{" "}
        {LEGAL_CONFIG.paymentProvider} rather than by us. Access to order information is
        limited to the people who need it to fulfil an order. No transmission over the
        internet is completely secure, but we take measures appropriate to the data we
        hold, which is deliberately kept small.
      </p>

      <h2>9. Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>Tell you what personal information we hold about you</li>
        <li>Correct anything that is inaccurate or out of date</li>
        <li>Delete it, where we are not required to keep it for legal or tax reasons</li>
      </ul>
      <p>
        Write to{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>{" "}
        and we will respond within {CONTACT_CONFIG.replyWindow}. We may ask for the order
        number so we can identify the right records.
      </p>

      <h2>10. Children</h2>
      <p>
        This site is not directed at children, and we do not knowingly collect information
        from anyone under {LEGAL_CONFIG.minimumAge}. If you believe a child has provided us
        with personal information, contact us and we will delete it.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy. The date at the top of this page shows when it last
        changed.
      </p>

      <h2>12. Contact</h2>
      <p>
        For anything in this policy, write to{" "}
        <a href={`mailto:${CONTACT_CONFIG.supportEmail}`}>
          {CONTACT_CONFIG.supportEmail}
        </a>{" "}
        or use our <Link href="/contact">contact page</Link>. {SITE_CONFIG.brandName} is
        operated by {LEGAL_CONFIG.entityName}, {CONTACT_CONFIG.addressLines.join(", ")}.
      </p>
    </PolicyPage>
  );
}
