import Link from "next/link";
import {
  CATEGORY_MENU,
  COLLECTION_MENU,
  COMPANY_LINKS,
  POLICY_LINKS,
} from "@/lib/navigation";
import { CONTACT_CONFIG, SITE_CONFIG } from "@/lib/config";
import { Wordmark } from "@/components/Wordmark";
import { ShieldCheckIcon } from "@/components/icons";

const columnHeadingClasses = "text-eyebrow uppercase text-gold";
const footerLinkClasses =
  "text-body-sm text-ivory/70 transition-colors duration-250 hover:text-ivory";

export function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-charcoal text-ivory">
      <div className="container grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-7 lg:py-16">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Wordmark variant="text" tone="ivory" />
          <p className="max-w-prose text-body-sm text-ivory/70">
            Anti-tarnish, hand-finished artificial jewellery for everyday wear and the
            days that matter. Shipped across India from our workshop.
          </p>
          <address className="flex flex-col gap-2.5 not-italic text-body-sm text-ivory/70">
            <span className="flex flex-col">
              {CONTACT_CONFIG.addressLines.map((addressLine) => (
                <span key={addressLine}>{addressLine}</span>
              ))}
            </span>
            <a href={`mailto:${CONTACT_CONFIG.supportEmail}`} className={footerLinkClasses}>
              {CONTACT_CONFIG.supportEmail}
            </a>
            <a href={CONTACT_CONFIG.phoneHref} className={footerLinkClasses}>
              {CONTACT_CONFIG.phoneDisplay}
            </a>
          </address>
        </div>

        <nav aria-label="Shop by category" className="flex flex-col gap-4">
          <h2 className={columnHeadingClasses}>Shop</h2>
          <ul className="flex flex-col gap-2.5">
            {CATEGORY_MENU.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={footerLinkClasses}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Collections" className="flex flex-col gap-4">
          <h2 className={columnHeadingClasses}>Collections</h2>
          <ul className="flex flex-col gap-2.5">
            {COLLECTION_MENU.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={footerLinkClasses}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company" className="flex flex-col gap-4">
          <h2 className={columnHeadingClasses}>Company</h2>
          <ul className="flex flex-col gap-2.5">
            {COMPANY_LINKS.map((companyLink) => (
              <li key={companyLink.href}>
                <Link href={companyLink.href} className={footerLinkClasses}>
                  {companyLink.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Policies" className="flex flex-col gap-4">
          <h2 className={columnHeadingClasses}>Policies</h2>
          <ul className="flex flex-col gap-2.5">
            {POLICY_LINKS.map((policyLink) => (
              <li key={policyLink.href}>
                <Link href={policyLink.href} className={footerLinkClasses}>
                  {policyLink.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          <h2 className={columnHeadingClasses}>Secure Payments</h2>
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
            <p className="text-body-sm text-ivory/70">
              Payments are processed on Cashfree&apos;s hosted checkout. Card and UPI
              details never touch our servers.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-ivory/15">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 sm:flex-row">
          <p className="text-body-sm text-ivory/60">
            © {currentYear} {SITE_CONFIG.brandName}. All rights reserved.
          </p>
          <p className="text-eyebrow uppercase text-ivory/50">
            Crafted in India
          </p>
        </div>
      </div>
    </footer>
  );
}
