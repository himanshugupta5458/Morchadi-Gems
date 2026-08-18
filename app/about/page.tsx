import type { Metadata } from "next";
import { CATEGORIES } from "@/types/product";
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { buildPageMetadata } from "@/lib/metadata";
import { getAllProducts } from "@/lib/products";
import { ButtonLink } from "@/components/ButtonLink";
import { Prose } from "@/components/Prose";
import { SectionHeading } from "@/components/SectionHeading";
import { TrustStrip } from "@/components/TrustStrip";

export const metadata: Metadata = buildPageMetadata({
  title: "About Us",
  description: `The workshop behind ${SITE_CONFIG.brandName} — hallmarked, hand-finished jewellery made in small batches and priced to be worn.`,
  path: "/about",
});

export default function AboutPage(): JSX.Element {
  const catalogueSize = getAllProducts().length;

  return (
    <>
      <section className="bg-ivory">
        <div className="container flex flex-col items-start gap-7 py-16 lg:py-24">
          <span className="text-eyebrow uppercase text-gold-deep">
            Our story
          </span>

          <h1 className="max-w-[18ch] font-display text-display leading-[1.06] sm:text-display-lg">
            <span className="uppercase tracking-caps text-ink">Made to be</span>{" "}
            <span className="italic text-gold">Worn</span>
          </h1>

          <span aria-hidden className="block h-px w-20 bg-gold" />

          <p className="max-w-prose text-body-lg text-muted">
            {SITE_CONFIG.brandName} began with a plain frustration: the pieces worth wearing
            were kept in a locker, and the pieces worth wearing every day were not worth
            keeping. We set out to close that gap.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            as="h2"
            roman="The"
            accent="Workshop"
            align="left"
            subtitle="Small batches, finished by hand, and checked one piece at a time."
          />

          <Prose>
            <p>
              Every piece we sell is finished by hand in our own workshop. Kundan setting,
              polki work, temple gold and oxidised silver are separate crafts with separate
              hands behind them, and we would rather run small batches in each than large
              runs in one.
            </p>
            <p>
              That decision has consequences we are happy to live with. Batches sell out.
              Some pieces come back and some do not. And two examples of the same design will
              never be quite identical — the difference between a piece finished by a person
              and a piece stamped out by a machine is exactly the variation you can see.
            </p>
            <p>
              What does not vary is what backs it: every piece is hallmarked, inspected before
              it is packed, and priced so it can be worn to work on a Tuesday rather than
              taken out twice a year.
            </p>

            <h3>Where we are today</h3>
            <p>
              {catalogueSize} pieces across {CATEGORIES.length} collections, shipped across
              India — free over {formatRupees(FREE_SHIPPING_THRESHOLD)} and a flat{" "}
              {formatRupees(FLAT_SHIPPING_RATE)} below that — with {RETURN_WINDOW_DAYS} days
              to change your mind. No membership, no account to create, and no minimum order
              — you buy a piece, we send it.
            </p>
          </Prose>
        </div>
      </section>

      <section className="border-t border-line bg-ivory">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            as="h2"
            roman="The Morchadi"
            accent="Promise"
            subtitle="Four things we hold to on every order, not just the large ones."
          />
          <TrustStrip />
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col items-center gap-7 py-16 text-center lg:py-24">
          <SectionHeading
            as="h2"
            roman="See the"
            accent="Collection"
            subtitle="Start anywhere — the everyday pieces and the occasion pieces are made on the same bench."
          />
          <ButtonLink href="/shop">Shop Collection</ButtonLink>
        </div>
      </section>
    </>
  );
}
