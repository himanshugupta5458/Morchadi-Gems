import { BUSINESS } from "@/config/business";
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  RETURN_WINDOW_DAYS,
} from "@/config/site-facts.mjs";

/**
 * The shop-wide policy numbers, re-exported under the names the rest of the site already
 * imports. They are defined in `config/site-facts.mjs` — a plain `.mjs` because the catalogue
 * gate (`scripts/product-record-rules.mjs`) is plain Node and used to write the free-shipping
 * threshold down a second time rather than import a TypeScript module. Nothing about their
 * meaning changed; the definition simply moved somewhere both runtimes can read it.
 */
export { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD, RETURN_WINDOW_DAYS };

/**
 * The one shipping calculation, shared by cart totals and by the authoritative server-side
 * order pricing so the two cannot disagree. A subtotal of zero — an empty cart, or a cart
 * holding nothing but sold-out pieces — attracts no shipping at all rather than the flat
 * rate, since there is nothing to ship.
 */
export function calculateShipping(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
}

/**
 * How much more a shopper must add before shipping becomes free, or zero when it already is.
 * Display only — no total is ever computed from this.
 */
export function amountToFreeShipping(subtotal: number): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return FREE_SHIPPING_THRESHOLD - subtotal;
}

/**
 * How the catalogue is described in one phrase, written once. The site description, the
 * shop's per-category metadata and the footer all read it, so a page cannot quietly start
 * claiming something the catalogue is not.
 *
 * The claim has to survive being read literally. These pieces are plated brass, alloy and
 * stainless steel — artificial jewellery, not precious metal — so the phrase says
 * anti-tarnish and skin-friendly, which is true and testable. The vocabulary that is barred
 * here, and why, is listed in
 * [ADR-018](/docs/decisions/ADR-018-honest-product-description.md).
 */
export const PRODUCT_DESCRIPTOR = "anti-tarnish, skin-friendly artificial jewellery";

export const SITE_CONFIG = {
  brandName: BUSINESS.brandName,
  /**
   * The brand name's two halves, for the surfaces that set the second one apart rather than
   * printing the name flat — the wordmark's text variant, the style guide's type specimen —
   * and for the two section headings that use the lead word alone.
   */
  brandNameLead: BUSINESS.brandNameLead,
  brandNameAccent: BUSINESS.brandNameAccent,
  title: `${BUSINESS.brandName} · Artificial Jewellery Online`,
  description: `Premium ${PRODUCT_DESCRIPTOR} from ${BUSINESS.brandName}. Hand-finished, quality-checked, and priced to be worn. Free shipping over ₹${FREE_SHIPPING_THRESHOLD} across India and easy ${RETURN_WINDOW_DAYS}-day returns.`,
  /**
   * The branded share card — the logo on ivory, generated from `public/logo.png` by
   * `npm run generate:brand-assets`. Every page that sets `openGraph` restates this rather
   * than inheriting it (a page's block replaces the layout's), so the constant is the one
   * place the share image is chosen. See ADR-022.
   *
   * WebP rather than PNG: the same render costs 25KB instead of 159KB, and this file is
   * fetched by every crawler and link unfurler that meets the site. `type` is stated because
   * a consumer that cannot decode WebP should be able to tell before downloading it. See
   * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
   */
  ogImage: {
    url: "/og/default.webp",
    type: "image/webp",
    width: 1200,
    height: 630,
    alt: `${BUSINESS.brandName}: ${PRODUCT_DESCRIPTOR}`,
  },
  whatsappNumber: BUSINESS.whatsappNumber,
  whatsappGreeting: `Hi ${BUSINESS.brandName}, I would like to know more about your jewellery.`,
} as const;

/**
 * The panel's own title and template. Stated here rather than in `app/admin/layout.tsx` so the
 * one place the brand name is written stays one place: an admin screen is not a shop page, but
 * it is the same shop. See
 * [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 */
export const ADMIN_CONFIG = {
  hostname: BUSINESS.adminHostname,
  title: `${BUSINESS.brandName} admin`,
  titleTemplate: `%s · ${BUSINESS.brandName} admin`,
} as const;

function toTelHref(phoneDisplay: string): string {
  return `tel:+${phoneDisplay.replace(/\D/g, "")}`;
}

/**
 * The registered address as it prints: two street lines, then the city, state and PIN on one
 * line. Assembled here rather than written out in `config/business.ts` so the address exists
 * once, in parts, and both the printed form and the schema's `PostalAddress` are derived from
 * the same six fields.
 */
const POSTAL_ADDRESS = BUSINESS.address;

const ADDRESS_LINES: readonly string[] = [
  POSTAL_ADDRESS.streetLine1,
  POSTAL_ADDRESS.streetLine2,
  `${POSTAL_ADDRESS.locality}, ${POSTAL_ADDRESS.region} ${POSTAL_ADDRESS.postalCode}`,
];

/**
 * The address in the shape `schema.org/PostalAddress` asks for. `streetAddress` is the two
 * street lines joined, because the vocabulary has one field where the envelope has two.
 */
export const POSTAL_ADDRESS_CONFIG = {
  streetAddress: `${POSTAL_ADDRESS.streetLine1}, ${POSTAL_ADDRESS.streetLine2}`,
  addressLocality: POSTAL_ADDRESS.locality,
  addressRegion: POSTAL_ADDRESS.region,
  postalCode: POSTAL_ADDRESS.postalCode,
  addressCountry: POSTAL_ADDRESS.countryCode,
} as const;

/**
 * The one country we ship to, as an ISO 3166-1 alpha-2 code. `LEGAL_CONFIG.shippingScope` is
 * the same fact written for a shopper to read; this is the same fact written for a machine.
 */
export const SHIPPING_COUNTRY_CODE = POSTAL_ADDRESS.countryCode;

/**
 * The two fulfilment windows as numbers of business days. The policy sentences below are
 * built from them, so the schema a search engine reads and the sentence a shopper reads
 * cannot state different numbers.
 */
export const DISPATCH_BUSINESS_DAYS = 2;
export const DELIVERY_BUSINESS_DAYS = 7;

/**
 * The opening hours in the shape `schema.org/OpeningHoursSpecification` asks for: the days as
 * `DayOfWeek` names, and the two times as 24-hour `HH:MM`. The same three fields the sentence
 * below is written from, so a crawler and a shopper are told the same thing.
 */
export const OPENING_HOURS_CONFIG = {
  dayOfWeek: BUSINESS.businessHours.days,
  opens: BUSINESS.businessHours.opens,
  closes: BUSINESS.businessHours.closes,
} as const;

/**
 * The opening hours as a sentence — "Monday to Saturday, 10:00 – 18:00 IST". Assembled from
 * the same fields the schema reads, so changing the hours in `config/business.ts` moves the
 * contact page and the structured data together.
 */
function toOpeningHoursSentence(): string {
  const { days, opens, closes, timeZoneLabel } = BUSINESS.businessHours;
  const [firstDay] = days;
  const lastDay = days[days.length - 1];
  const dayRange = days.length === 1 ? firstDay : `${firstDay} to ${lastDay}`;

  return `${dayRange}, ${opens} – ${closes} ${timeZoneLabel}`;
}

/**
 * Contact details as the site renders them. The business facts come from
 * `config/business.ts`; only the service commitments — how quickly we reply — are decided
 * here, because they belong to the site rather than to the entity.
 */
export const CONTACT_CONFIG = {
  supportEmail: BUSINESS.supportEmail,
  /**
   * The `From:` header of the customer's order-confirmation email — the brand name in front of
   * the verified Resend mailbox, in the `Name <mailbox>` form the RFC and Resend both take.
   * Read only by `lib/notify-customer-email.ts`.
   */
  transactionalFromAddress: `${BUSINESS.brandName} <${BUSINESS.transactionalEmailFrom}>`,
  phoneDisplay: BUSINESS.phoneDisplay,
  phoneHref: toTelHref(BUSINESS.phoneDisplay),
  addressLines: ADDRESS_LINES,
  hours: toOpeningHoursSentence(),
  replyWindow: "one business day",
  /** The subject a contact-form message carries when the visitor leaves the field empty. */
  defaultEnquirySubject: `New enquiry from the ${BUSINESS.brandName} website`,
} as const;

/**
 * Where the registered address sits on a map. Read only by the store schema's `geo`; nothing
 * the site renders uses it, because the site shows an address rather than a map.
 */
export const GEO_CONFIG = BUSINESS.geoCoordinates;

/**
 * Legal and fulfilment details. The entity name and the jurisdiction come from
 * `config/business.ts`; the windows below are operational promises made by the policies.
 */
export const LEGAL_CONFIG = {
  entityName: BUSINESS.legalEntityName,
  jurisdictionCity: BUSINESS.jurisdictionCity,
  jurisdictionState: BUSINESS.jurisdictionState,
  policyLastUpdatedIso: "2026-08-18",
  dispatchWindow: `${DISPATCH_BUSINESS_DAYS} business days`,
  deliveryWindow: `${DELIVERY_BUSINESS_DAYS} business days`,
  refundProcessingWindow: "7–10 business days",
  damageReportWindow: "48 hours",
  replacementDispatchWindow: "7 working days",
  minimumAge: 18,
  shippingScope: "India",
  paymentProvider: "Cashfree Payments",
} as const;

/**
 * The facts the about page states about the business itself. They come from
 * `config/business.ts` so the eyebrow, the story, the stat band and the journey timeline all
 * read the same founding year and the same milestone numbers.
 */
export const STORY_CONFIG = {
  foundedYear: BUSINESS.foundedYear,
  customersServed: BUSINESS.customersServed,
  designsReleased: BUSINESS.designsReleased,
  deliveryCoverage: BUSINESS.deliveryCoverage,
  homeCity: BUSINESS.jurisdictionCity,
} as const;

/**
 * The delivery promise on the confirmation screen, assembled from the same two windows
 * `/shipping` renders. Written once here so the sentence a shopper reads right after paying
 * cannot drift from the policy it is a promise about.
 */
export const DELIVERY_ESTIMATE_LINE = `Dispatch within ${LEGAL_CONFIG.dispatchWindow} · Delivery within ${LEGAL_CONFIG.deliveryWindow}`;

export function buildWhatsAppLink(): string {
  const greeting = encodeURIComponent(SITE_CONFIG.whatsappGreeting);
  return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${greeting}`;
}
