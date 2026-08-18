import type { Metadata } from "next";
import {
  CONTACT_CONFIG,
  FREE_SHIPPING_THRESHOLD,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
  STORY_CONFIG,
} from "@/lib/config";
import { formatMilestone, formatRupees } from "@/lib/format";
import { buildPageMetadata } from "@/lib/metadata";
import { ButtonLink } from "@/components/ButtonLink";
import { Prose } from "@/components/Prose";
import { SectionHeading } from "@/components/SectionHeading";
import { TestimonialBand } from "@/components/TestimonialBand";
import { TrustBadge } from "@/components/TrustBadge";
import {
  CertificateIcon,
  GemOutlineIcon,
  PlusIcon,
  ReturnArrowIcon,
  TruckIcon,
  WhatsAppIcon,
} from "@/components/icons";

const HOME_COUNTRY = "India";
const ANTI_TARNISH_YEAR = 2020;
const ONLINE_STORE_YEAR = 2018;
const CUSTOMER_MILESTONE_YEAR = 2023;
const ICON_CLASS = "h-7 w-7";

export const metadata: Metadata = buildPageMetadata({
  title: "About Us",
  description: `${SITE_CONFIG.brandName} has been making premium artificial jewellery in ${STORY_CONFIG.homeCity} since ${STORY_CONFIG.foundedYear} — ${formatMilestone(STORY_CONFIG.customersServed)} customers, ${formatMilestone(STORY_CONFIG.designsReleased)} designs, delivered ${STORY_CONFIG.deliveryCoverage.toLowerCase()}.`,
  path: "/about",
});

const STORY_STATS = [
  { key: "founded", value: `${STORY_CONFIG.foundedYear}`, label: "Founded" },
  {
    key: "customers",
    value: formatMilestone(STORY_CONFIG.customersServed),
    label: "Customers",
  },
  {
    key: "designs",
    value: formatMilestone(STORY_CONFIG.designsReleased),
    label: "Designs",
  },
  {
    key: "coverage",
    value: STORY_CONFIG.deliveryCoverage,
    label: "Delivery",
  },
];

const JOURNEY_MILESTONES = [
  {
    key: "beginning",
    marker: `${STORY_CONFIG.foundedYear}`,
    title: "The Beginning",
    detail: `A small workbench in ${STORY_CONFIG.homeCity} and one conviction — that everyday jewellery deserves the finish reserved for occasion pieces.`,
  },
  {
    key: "online",
    marker: `${ONLINE_STORE_YEAR}`,
    title: "We Went Online",
    detail: `Orders had been arriving by message for two years. Going online let a woman anywhere in ${HOME_COUNTRY} see the whole collection instead of the six photographs we could send her.`,
  },
  {
    key: "anti-tarnish",
    marker: `${ANTI_TARNISH_YEAR}`,
    title: "Anti-Tarnish Finish",
    detail:
      "The single most common complaint about artificial jewellery is that it turns after a month. We moved the collection onto an anti-tarnish plating and stopped losing customers to it.",
  },
  {
    key: "milestone",
    marker: `${CUSTOMER_MILESTONE_YEAR}`,
    title: `${formatMilestone(STORY_CONFIG.customersServed)} Customers`,
    detail:
      "Reached without a single paid endorsement. Repeat orders and word of mouth did it, which is the only endorsement we would have trusted anyway.",
  },
  {
    key: "today",
    marker: "Today",
    title: "Still Growing",
    detail: `New designs every month, ${formatMilestone(STORY_CONFIG.designsReleased)} of them behind us, and the same bench deciding what is good enough to ship.`,
  },
];

const REASONS_TO_CHOOSE_US = [
  {
    key: "premium-quality",
    label: "Premium Quality",
    detail: "Anti-tarnish plating, inspected piece by piece",
    icon: <CertificateIcon className={ICON_CLASS} />,
  },
  {
    key: "affordable-elegance",
    label: "Affordable Elegance",
    detail: "Priced to be worn, not saved for",
    icon: <GemOutlineIcon className={ICON_CLASS} />,
  },
  {
    key: "new-designs",
    label: "New Designs Always",
    detail: "Fresh pieces off the bench every month",
    icon: <PlusIcon className={ICON_CLASS} />,
  },
  {
    key: "fast-delivery",
    label: "Fast Delivery",
    detail: `Dispatch within ${LEGAL_CONFIG.dispatchWindow}, delivery within ${LEGAL_CONFIG.deliveryWindow}`,
    icon: <TruckIcon className={ICON_CLASS} />,
  },
  {
    key: "easy-returns",
    label: "Easy Returns",
    detail: `${RETURN_WINDOW_DAYS} days to change your mind`,
    icon: <ReturnArrowIcon className={ICON_CLASS} />,
  },
  {
    key: "personal-touch",
    label: "Personal Touch",
    detail: `WhatsApp us on ${CONTACT_CONFIG.phoneDisplay} or write to ${CONTACT_CONFIG.supportEmail}`,
    icon: <WhatsAppIcon className={ICON_CLASS} />,
  },
];

export default function AboutPage(): JSX.Element {
  return (
    <>
      <section className="bg-ivory">
        <div className="container flex flex-col items-start gap-7 py-16 lg:py-24">
          <span className="text-eyebrow uppercase text-gold-deep">
            Est. {STORY_CONFIG.foundedYear} · {STORY_CONFIG.homeCity}, {HOME_COUNTRY}
          </span>

          <h1 className="max-w-[20ch] font-display text-display leading-[1.06] sm:text-display-lg">
            <span className="uppercase tracking-caps text-ink">Crafted With Love.</span>{" "}
            <span className="italic text-gold">Worn With Pride.</span>
          </h1>

          <span aria-hidden className="block h-px w-20 bg-gold" />

          <p className="max-w-prose text-body-lg text-muted">
            Premium artificial jewelry that makes every woman feel extraordinary — without
            compromise.
          </p>

          <ButtonLink href="/shop">Shop Collection</ButtonLink>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            as="h2"
            roman="Our"
            accent="Story"
            align="left"
            subtitle={`From one workbench in ${STORY_CONFIG.homeCity} to ${formatMilestone(STORY_CONFIG.customersServed)} women across ${HOME_COUNTRY}.`}
          />

          <Prose>
            <p>
              {SITE_CONFIG.brandName} began in {STORY_CONFIG.foundedYear}, in{" "}
              {STORY_CONFIG.homeCity} — a city that has been setting stones for four hundred
              years. We started with a plain frustration: the jewellery worth wearing was
              kept in a locker, and the jewellery you could wear every day was not worth
              keeping. One turned your skin green in a month. The other only came out twice a
              year.
            </p>
            <p>
              So we set out to close that gap. Artificial jewellery, finished properly —
              plated to last, set so nothing catches, and priced so a woman can buy the piece
              she actually wants rather than the one she can justify.
            </p>
            <p>
              {formatMilestone(STORY_CONFIG.customersServed)} customers later, the part we
              did not expect is what people write to us about. Not the finish. The evening it
              was worn to. The daughter it was passed to. The compliment at the office that
              made an ordinary Tuesday better.
            </p>
            <p>
              <strong>
                Every piece we make is a story waiting for the woman who will tell it.
              </strong>{" "}
              We just make sure it is good enough to be worth telling.
            </p>
          </Prose>
        </div>
      </section>

      <section className="border-t border-line bg-ivory">
        <div className="container py-14 lg:py-16">
          <dl className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {STORY_STATS.map((stat) => (
              <div key={stat.key} className="flex flex-col gap-2">
                <dt className="text-eyebrow uppercase tracking-caps text-muted">
                  {stat.label}
                </dt>
                <dd className="font-display text-heading text-maroon sm:text-heading-lg">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            as="h2"
            roman="Our"
            accent="Journey"
            align="left"
            subtitle="Five moments that changed what we make and how we make it."
          />

          <ol className="max-w-prose border-l border-line">
            {JOURNEY_MILESTONES.map((milestone) => (
              <li key={milestone.key} className="relative pb-10 pl-8 last:pb-0">
                <span
                  aria-hidden
                  className="absolute left-0 top-2 block h-2 w-2 -translate-x-1/2 rounded-full bg-gold"
                />
                <p className="text-eyebrow uppercase tracking-caps text-gold-deep">
                  {milestone.marker}
                </p>
                <h3 className="mt-2 font-display text-body-lg text-ink">
                  {milestone.title}
                </h3>
                <p className="mt-2 text-body-sm text-muted">{milestone.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line bg-ivory">
        <div className="container flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
          <SectionHeading
            as="h2"
            roman="Why Choose"
            accent="Morchadi"
            subtitle="Six things we hold to on every order, not just the large ones."
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {REASONS_TO_CHOOSE_US.map((reason) => (
              <TrustBadge
                key={reason.key}
                icon={reason.icon}
                label={reason.label}
                detail={reason.detail}
              />
            ))}
          </div>
        </div>
      </section>

      <TestimonialBand
        roman="Customer"
        accent="Love"
        subtitle="What people tell us after the box arrives."
      />

      <section className="border-t border-line bg-white">
        <div className="container flex flex-col items-center gap-7 py-16 text-center lg:py-24">
          <SectionHeading
            as="h2"
            roman="Find Your"
            accent="Perfect Piece"
            subtitle="Start anywhere — the everyday pieces and the occasion pieces come off the same bench."
          />
          <ButtonLink href="/shop">Shop Collection</ButtonLink>
          <p className="text-body-sm text-muted">
            Free shipping above {formatRupees(FREE_SHIPPING_THRESHOLD)}
          </p>
        </div>
      </section>
    </>
  );
}
