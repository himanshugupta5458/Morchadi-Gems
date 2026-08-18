import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_CONFIG, LEGAL_CONFIG, SITE_CONFIG } from "@/lib/config";
import { buildPageMetadata } from "@/lib/metadata";
import { PolicyPage } from "@/components/PolicyPage";

const PATH = "/privacy";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "What Morchadi Gems collects, why, and what we do not collect — no accounts, no stored card details, and no sale of your data.",
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
      <h2>1. The short version</h2>
      <p>
        We ask for the least we can. There are no accounts on this site, so there is no
        profile of you held anywhere. We collect the details needed to deliver an order and
        to reply to a message, and nothing else. We do not sell your data.
      </p>

      <h2>2. What we collect</h2>
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

      <h3>What we do not collect</h3>
      <ul>
        <li>
          <strong>Card, UPI or bank details.</strong> Payments are processed by{" "}
          {LEGAL_CONFIG.paymentProvider} on their own hosted checkout. Those details are
          entered on their page, not ours, and never reach our servers or our logs.
        </li>
        <li>
          <strong>Account credentials.</strong> There is no sign-up and no password, because
          there is no account.
        </li>
        <li>
          <strong>Anything we do not need.</strong> We do not ask for a date of birth,
          gender, or identity documents.
        </li>
      </ul>

      <h2>3. What stays in your browser</h2>
      <p>
        Two things are stored on your own device rather than sent to us:
      </p>
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
        you complete an order.
      </p>

      <h2>4. Cookies</h2>
      <p>
        We do not set advertising or cross-site tracking cookies. Cookies or similar storage
        may be set by {LEGAL_CONFIG.paymentProvider} during checkout, and by our hosting
        provider for security and basic performance, in order for the site to function.
      </p>

      <h2>5. Who else sees your data</h2>
      <p>We share the minimum necessary with:</p>
      <ul>
        <li>
          <strong>{LEGAL_CONFIG.paymentProvider}</strong> — to take payment and to process
          refunds, under their own privacy policy
        </li>
        <li>
          <strong>Our delivery partners</strong> — the name, address and phone number needed
          to deliver your parcel
        </li>
        <li>
          <strong>Our hosting and email providers</strong> — to run the site and send order
          messages
        </li>
        <li>
          <strong>Authorities</strong> — where we are legally required to
        </li>
      </ul>
      <p>
        <strong>We do not sell, rent or trade your personal data</strong>, and we do not
        share it for anyone else&apos;s marketing.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        Order records are kept as long as we need them for accounting, tax and warranty
        purposes under Indian law. Messages sent through the contact form are kept only as
        long as needed to resolve the enquiry.
      </p>

      <h2>7. Security</h2>
      <p>
        The site is served over HTTPS. Payment details are handled entirely by{" "}
        {LEGAL_CONFIG.paymentProvider}. No transmission over the internet is completely
        secure, but we take reasonable measures appropriate to the data we hold — which is
        deliberately kept small.
      </p>

      <h2>8. Your choices</h2>
      <p>
        You can ask us what we hold about you, ask for it to be corrected, or ask for it to
        be deleted where we are not required to keep it. Write to{" "}
        <a href={`mailto:${CONTACT_CONFIG.privacyEmail}`}>
          {CONTACT_CONFIG.privacyEmail}
        </a>
        . You can clear the cart and checkout data held in your browser at any time by
        clearing your browser storage for this site.
      </p>

      <h2>9. Children</h2>
      <p>
        This site is not directed at children, and we do not knowingly collect data from
        anyone under 18. If you believe a child has provided us with personal data, contact
        us and we will delete it.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. The date at the top of this page shows when it last
        changed.
      </p>

      <h2>11. Contact</h2>
      <p>
        For anything in this policy, write to{" "}
        <a href={`mailto:${CONTACT_CONFIG.privacyEmail}`}>
          {CONTACT_CONFIG.privacyEmail}
        </a>{" "}
        or use our <Link href="/contact">contact page</Link>. {SITE_CONFIG.brandName} is
        operated by {LEGAL_CONFIG.entityName}.
      </p>
    </PolicyPage>
  );
}
