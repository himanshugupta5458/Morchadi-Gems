export const SITE_CONFIG = {
  brandName: "Morchadi Gems",
  title: "Morchadi Gems — Fine Jewellery Online",
  description:
    "Hallmarked, hand-finished jewellery from Morchadi Gems — kundan, polki, temple gold and oxidised silver. Flat ₹99 shipping across India and easy 7-day returns.",
  ogImage: {
    url: "/hero/home-hero.webp",
    width: 1600,
    height: 1200,
    alt: "Morchadi Gems fine jewellery",
  },
  whatsappNumber: "910000000000",
  whatsappGreeting: "Hi Morchadi Gems, I would like to know more about your jewellery.",
} as const;

/**
 * Flat shipping, charged once per order rather than per line, and only when the order has
 * at least one payable item. The single definition of the rate — cart totals, the summary
 * label, and every later server-side total read it from here rather than writing 99.
 */
export const FLAT_SHIPPING_RATE = 99;

/**
 * The one definition of the returns window. The trust strip, the refund policy and every
 * other mention read it from here, so the promise on the home page and the promise in the
 * policy cannot drift apart.
 */
export const RETURN_WINDOW_DAYS = 7;

/**
 * Placeholder contact details. Every one of these is a stand-in until the real business
 * details are supplied — this is the single place they are written, and swapping them here
 * updates the contact page, the policies and the footer at once.
 */
export const CONTACT_CONFIG = {
  supportEmail: "hello@morchadigems.example",
  privacyEmail: "privacy@morchadigems.example",
  phoneDisplay: "+91 00000 00000",
  phoneHref: "tel:+910000000000",
  addressLines: [
    "[REGISTERED BUSINESS NAME]",
    "[BUILDING, STREET]",
    "[AREA]",
    "[CITY], [STATE] [PIN]",
    "India",
  ],
  hours: "Monday to Saturday, 10:00 – 18:00 IST",
  replyWindow: "one business day",
  /**
   * Where a shopper is sent when a payment is taking longer than the confirmation page is
   * willing to wait. It is the one address in this file on a real domain rather than
   * `.example`, which is a discrepancy waiting to be resolved either way — see the prompt-13
   * row in `docs/progress/BUILD_LOG.md`.
   */
  orderSupportEmail: "admin@morchadigems.com",
} as const;

/**
 * Placeholder legal and fulfilment details. Bracketed values are unresolved business
 * decisions — a registered entity name and a jurisdiction city cannot be invented here, so
 * they are marked rather than guessed.
 */
export const LEGAL_CONFIG = {
  entityName: "[REGISTERED ENTITY NAME]",
  jurisdictionCity: "[CITY]",
  jurisdictionState: "[STATE]",
  policyLastUpdatedIso: "2026-08-17",
  dispatchWindow: "1–2 business days",
  deliveryWindow: "3–7 business days",
  refundProcessingWindow: "5–7 business days",
  paymentProvider: "Cashfree Payments",
} as const;

/**
 * The delivery promise on the confirmation screen, assembled from the same two windows
 * `/shipping` renders. Written once here so the sentence a shopper reads right after paying
 * cannot drift from the policy it is a promise about.
 */
export const DELIVERY_ESTIMATE_LINE = `Dispatch within ${LEGAL_CONFIG.dispatchWindow} · Delivery within ${LEGAL_CONFIG.deliveryWindow}`;

/**
 * Placeholder credentials only. `whatsappNumber` is a stand-in until the real
 * business number is supplied; it is the single place that value is written.
 */
export function buildWhatsAppLink(): string {
  const greeting = encodeURIComponent(SITE_CONFIG.whatsappGreeting);
  return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${greeting}`;
}
