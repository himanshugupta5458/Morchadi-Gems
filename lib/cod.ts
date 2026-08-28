/**
 * The only fields of a product a cash-on-delivery decision may see — the mirror of
 * `OrderPricingEntry` and `OrderOptionEntry`, with `price` deliberately absent so eligibility
 * cannot come to depend on what the cart is worth. Whether COD is offered is a property of
 * *which pieces* are in the basket and not of its total: a basket of cheap COD-barred items
 * is refused and an expensive basket of eligible ones is allowed. Keeping the amount out of
 * the type is what stops that rule quietly turning into an order-value threshold.
 */
export interface CodEligibilityEntry {
  id: string;
  minPrepaidAmount: number;
}

/**
 * Whether an order may be taken cash on delivery.
 *
 * COD is offered only when **every** line reads `minPrepaidAmount === 0`. One piece that
 * requires prepayment withdraws the option from the whole order rather than from its own
 * line, because the alternative — collecting part of one delivery in cash and charging the
 * rest online — is a reconciliation problem rather than a checkout feature.
 *
 * An empty cart is **not** eligible. There is nothing to decide about, and the vacuous truth
 * that "every line qualifies" is the wrong answer to hand a caller that is about to render a
 * payment choice. A caller asking about an empty cart has a bug, and `false` is the reading
 * that fails safely.
 *
 * The parameter is the narrowest shape that answers the question, so a priced line, a
 * catalogue entry or a plain object all satisfy it without this module learning what a cart
 * line looks like. See
 * [ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md).
 */
export function isCartCodEligible(
  lines: readonly { minPrepaidAmount: number }[],
): boolean {
  if (lines.length === 0) return false;
  return lines.every((line) => line.minPrepaidAmount === 0);
}
