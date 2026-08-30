/**
 * The handful of business facts that both runtimes need, as plain JavaScript.
 *
 * `config/business.ts` is the file the owner edits and the file to read first; this one exists
 * underneath it for a single mechanical reason. The catalogue gate, the publishing scripts and
 * the maintenance scripts are plain Node with no path aliases and no TypeScript, so they cannot
 * import a `.ts` module — and every one of them that needed the brand name or the free-shipping
 * threshold wrote it down a second time instead. A second copy of a price rule or of the shop's
 * own name is exactly the drift `config/business.ts` and `lib/config.ts` exist to prevent.
 *
 * So the values both sides need live here, in the one syntax both sides can read.
 * `config/business.ts` imports the brand names and republishes them as `BUSINESS` fields;
 * `lib/config.ts` imports the policy numbers and re-exports them under the names the site
 * already uses; the scripts import from here directly. It is the same move
 * `config/security-headers.mjs` already makes for `next.config.mjs`.
 *
 * Plain data only. No logic and no formatting — `calculateShipping` and every rupee sign live
 * in `lib/config.ts` and `lib/format.ts` respectively, so this file stays safe to edit without
 * reading any code.
 */

/** Customer-facing store name. Appears in the wordmark, page titles, share cards and every
 * script banner. Surfaced to the site as `BUSINESS.brandName` and `SITE_CONFIG.brandName`. */
export const BRAND_NAME = "Morchadi Gems";

/**
 * The same name split at the word the brand sets apart — `BRAND_NAME_LEAD` in roman capitals,
 * `BRAND_NAME_ACCENT` in italic gold. Split rather than computed from `BRAND_NAME`, because
 * where the emphasis falls is a design decision and not a property of the string.
 * `lib/site-identity.test.ts` asserts the two joined by a space are exactly `BRAND_NAME`.
 */
export const BRAND_NAME_LEAD = "Morchadi";
export const BRAND_NAME_ACCENT = "Gems";

/** Registered entity that operates the store. Appears in the terms and privacy policies. */
export const LEGAL_ENTITY_NAME = "Morchadi Enterprise";

/**
 * Shipping is free once the payable subtotal reaches this amount, and costs
 * `FLAT_SHIPPING_RATE` below it. The boundary is **inclusive**: a subtotal of exactly this
 * amount ships free.
 *
 * These two numbers are the single definition of what shipping costs. The cart math
 * (`lib/cart.ts`), the server-side order pricing (`lib/order.ts`), the trust strip, the header
 * announcement, the order summaries, the shipping and terms policies and the catalogue gate's
 * meta-copy rule all read them rather than writing a number down, so the promise on the home
 * page and the amount charged cannot drift apart.
 */
export const FREE_SHIPPING_THRESHOLD = 799;
export const FLAT_SHIPPING_RATE = 99;

/**
 * The one definition of the returns window. The trust strip, the header announcement, the
 * refund policy, the `/about` page and the offer schema's `merchantReturnDays` all read it
 * from here, so the promise on the home page and the promise in the policy cannot drift apart.
 */
export const RETURN_WINDOW_DAYS = 7;
