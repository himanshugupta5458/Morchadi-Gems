import { BUSINESS } from "@/config/business";

/**
 * Shipping is free once the payable subtotal reaches this amount, and costs
 * `FLAT_SHIPPING_RATE` below it. The boundary is **inclusive**: a subtotal of exactly ₹799
 * ships free.
 *
 * These two constants are the single definition of what shipping costs. The cart math
 * (`lib/cart.ts`), the server-side order pricing (`lib/order.ts`), the trust strip, the order
 * summaries and the shipping policy all read them rather than writing a number down, so the
 * promise on the home page and the amount charged cannot drift apart.
 */
export const FREE_SHIPPING_THRESHOLD = 799;
export const FLAT_SHIPPING_RATE = 99;

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
 * The one definition of the returns window. The trust strip, the refund policy and every
 * other mention read it from here, so the promise on the home page and the promise in the
 * policy cannot drift apart.
 */
export const RETURN_WINDOW_DAYS = 7;

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
  title: `${BUSINESS.brandName} — Artificial Jewellery Online`,
  description: `Premium ${PRODUCT_DESCRIPTOR} from ${BUSINESS.brandName} — hand-finished, quality-checked, and priced to be worn. Free shipping over ₹${FREE_SHIPPING_THRESHOLD} across India and easy ${RETURN_WINDOW_DAYS}-day returns.`,
  ogImage: {
    url: "/hero/home-hero.webp",
    width: 1600,
    height: 1200,
    alt: `${BUSINESS.brandName} artificial jewellery`,
  },
  whatsappNumber: BUSINESS.whatsappNumber,
  whatsappGreeting: `Hi ${BUSINESS.brandName}, I would like to know more about your jewellery.`,
} as const;

function toTelHref(phoneDisplay: string): string {
  return `tel:+${phoneDisplay.replace(/\D/g, "")}`;
}

/**
 * Contact details as the site renders them. The business facts come from
 * `config/business.ts`; only the service commitments — when we are open, how quickly we
 * reply — are decided here, because they belong to the site rather than to the entity.
 */
export const CONTACT_CONFIG = {
  supportEmail: BUSINESS.supportEmail,
  phoneDisplay: BUSINESS.phoneDisplay,
  phoneHref: toTelHref(BUSINESS.phoneDisplay),
  addressLines: BUSINESS.addressLines,
  hours: "Monday to Saturday, 10:00 – 18:00 IST",
  replyWindow: "one business day",
} as const;

/**
 * Legal and fulfilment details. The entity name and the jurisdiction come from
 * `config/business.ts`; the windows below are operational promises made by the policies.
 */
export const LEGAL_CONFIG = {
  entityName: BUSINESS.legalEntityName,
  jurisdictionCity: BUSINESS.jurisdictionCity,
  jurisdictionState: BUSINESS.jurisdictionState,
  policyLastUpdatedIso: "2026-08-18",
  dispatchWindow: "2 business days",
  deliveryWindow: "7 business days",
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
