import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { CONTACT_CONFIG, SITE_CONFIG } from "@/lib/config";
import { POLICY_LINKS } from "@/lib/navigation";
import { ShopProviders } from "@/components/ShopProviders";

/**
 * Neither step is indexable and both pages say so themselves; the template is restated here
 * because a title template is a property of the shell, and `(checkout)` is a sibling of
 * `(storefront)` rather than a child of it, so it inherits the root's and not the shop's.
 */
export const metadata: Metadata = {
  title: {
    default: SITE_CONFIG.title,
    template: `%s · ${SITE_CONFIG.brandName}`,
  },
  robots: { index: false, follow: true },
};

/**
 * The checkout shell: the providers, the page, and four policy links.
 *
 * A sibling of the storefront shell rather than a layout nested inside it, for the reason
 * `app/admin` is one — a nested layout cannot decline what an ancestor renders, and what these
 * two screens needed was to decline the shop header, the category menus and the floating
 * WhatsApp button. The URL is untouched: a route group adds no segment, so `/address` and
 * `/payment` are served exactly where they were.
 *
 * The footer is four policy links and an address, not the shop's seven-column one. They are the
 * links a shopper actually opens mid-checkout — what shipping costs, what happens if it has to
 * come back — and each opens the page it names rather than pulling them out of the funnel into
 * the catalogue. See [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */
export default function CheckoutLayout({
  children,
}: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <ShopProviders>
      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-ivory">
        <div className="container flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {POLICY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <a
            href={`mailto:${CONTACT_CONFIG.supportEmail}`}
            className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
          >
            {CONTACT_CONFIG.supportEmail}
          </a>
        </div>
      </footer>
    </ShopProviders>
  );
}
