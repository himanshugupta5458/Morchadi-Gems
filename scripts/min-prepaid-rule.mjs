/**
 * The one implementation of the two rules that govern `pricing.minPrepaidAmount`: what shape
 * the field must have to pass the gate, and when its value is worth an advisory.
 *
 * It lives here, as plain ESM with no imports and no side effects, for the same reason
 * `banned-meta-adjectives.mjs` does: `scripts/validate-products.mjs` validates the catalogue
 * and calls `process.exit` at module scope, so a test file cannot import it, and the
 * validator itself must stay runnable with no TypeScript loader. Keeping the rules here means
 * the test exercises the code the gate actually runs rather than a second copy of it that can
 * drift.
 *
 * The cart-level rule these feed is `isCartCodEligible` in `lib/cod.ts`. See
 * [ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md).
 */

/**
 * Whether the field is present and well-formed. Amounts in this catalogue are whole rupees,
 * and `0` is a legitimate value — it is what marks a piece COD-eligible — so this is
 * deliberately not the `isPositiveInteger` the other pricing fields use.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidMinPrepaidAmount(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Whether the piece asks a shopper to prepay more than it costs. A data error rather than a
 * build error: the figure is the owner's to correct, and the field is inert until a checkout
 * reads it, so the validator reports this as an advisory and not a failure.
 *
 * Answers `false` when either figure is malformed — the shape failure is already reported by
 * `isValidMinPrepaidAmount`, and comparing nonsense would only add a second, confusing line
 * about the same record.
 *
 * @param {unknown} minPrepaidAmount
 * @param {unknown} price
 * @returns {boolean}
 */
export function minPrepaidExceedsPrice(minPrepaidAmount, price) {
  if (!isValidMinPrepaidAmount(minPrepaidAmount)) return false;
  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0) return false;
  return minPrepaidAmount > price;
}
