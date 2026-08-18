import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/config";
import { buildPageMetadata } from "@/lib/metadata";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ContactDetails } from "@/components/ContactDetails";
import { ContactForm } from "@/components/ContactForm";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Us",
  description: `Get in touch with ${SITE_CONFIG.brandName} about an order, sizing, or anything else, by email, phone or WhatsApp.`,
  path: "/contact",
});

export default function ContactPage(): JSX.Element {
  return (
    <div className="container py-8 lg:py-12">
      <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "Contact" }]} />

      <div className="mt-8 lg:mt-10">
        <SectionHeading
          as="h1"
          roman="Contact"
          accent="Us"
          align="left"
          subtitle="Questions about a piece, an order in flight, or a return. Use whichever is quickest for you."
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:mt-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-heading-sm text-ink">Send us a message</h2>
            <p className="max-w-prose text-body-sm text-muted">
              For an existing order, include your order number and we can answer in one
              reply. How we handle what you send is in our{" "}
              <Link
                href="/privacy"
                className="text-ink underline decoration-gold underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <ContactForm />
        </div>

        <ContactDetails />
      </div>
    </div>
  );
}
