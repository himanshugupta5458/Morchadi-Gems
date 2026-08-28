import type { PaymentType } from "@prisma/client";
import type { PaymentPath } from "@/types/order";

/**
 * Every path this checkout offers, in the order the payment step lists them. Used to validate
 * the word a request sent; the money each one means is `resolvePaymentPlan` below.
 */
const PAYMENT_PATHS: readonly PaymentPath[] = ["cod", "partial", "full"];

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

/**
 * A priced order line reduced to what a prepayment floor is computed from: which piece, and
 * how many. No amount, for the reason `CodEligibilityEntry` carries none — the floor is a
 * property of the pieces and their count, never of what they are worth. `OrderLineItem` from
 * [`lib/order.ts`](./order.ts) satisfies it, so the route passes the lines it already priced.
 */
export interface PrepaymentLine {
  productId: string;
  qty: number;
}

/**
 * What a cart may be offered, before the shopper has chosen anything.
 *
 * The two facts travel together because they are read together and are derived from the same
 * pass over the same catalogue: a caller that had one without the other would be a caller that
 * could offer cash on delivery on a cart with a prepayment floor, or quote a floor on a cart
 * that has none.
 */
export interface CartPrepaymentSummary {
  isCodEligible: boolean;
  /** Σ `minPrepaidAmount × qty`. Zero exactly when every line is COD-eligible. */
  minimumPrepayment: number;
}

/**
 * What a cart's pieces permit, or **null** when any line names a product this catalogue does
 * not hold.
 *
 * Null is not an error to report; it is the answer "this cart cannot be reasoned about", and
 * the caller's obligation is to fall back to full prepayment. It cannot arise from a cart the
 * pricing core has already accepted — both catalogues are built from the same active products —
 * so it exists to make the impossible case fail towards collecting the money rather than
 * towards sending goods out uncollected on a rule that could not be evaluated.
 */
export function summariseCartPrepayment(
  lines: readonly PrepaymentLine[],
  catalogue: readonly CodEligibilityEntry[],
): CartPrepaymentSummary | null {
  const entryByProductId = new Map(catalogue.map((entry) => [entry.id, entry]));
  const matchedEntries: CodEligibilityEntry[] = [];
  let minimumPrepayment = 0;

  for (const line of lines) {
    const entry = entryByProductId.get(line.productId);
    if (entry === undefined) return null;

    matchedEntries.push(entry);
    minimumPrepayment += entry.minPrepaidAmount * line.qty;
  }

  return { isCodEligible: isCartCodEligible(matchedEntries), minimumPrepayment };
}

/**
 * What one checkout choice means in money.
 *
 * `amountPrepaid + amountDue = total` holds by construction in all three branches — each one
 * derives the second figure by subtracting the first from the total rather than stating both —
 * which is what makes the invariant a property of this function instead of three separate
 * chances to get it wrong.
 */
export interface PaymentPlan {
  path: PaymentPath;
  paymentType: PaymentType;
  amountPrepaid: number;
  amountDue: number;
}

/**
 * The path a request asked for, or `"full"` for a body that named none.
 *
 * Absent means full prepayment, which is what every browser deployed before this field existed
 * sends and what it has always meant. An unrecognised value falls the same way rather than
 * being refused: the safe reading of a path this server does not know is the one that collects
 * all of the money up front.
 */
export function parsePaymentPath(value: unknown): PaymentPath {
  return PAYMENT_PATHS.find((path) => path === value) ?? "full";
}

/**
 * The requested path priced against the server's own figures, or **null** when the cart does
 * not permit it.
 *
 * This is the gate, and it is the only thing standing between a hand-written `curl` and an
 * order that ships uncollected. The client sends a *word* — never an amount, and never a claim
 * about eligibility — and every figure below comes from `total` and `minimumPrepayment`, both
 * of which the caller recomputed from `data/products.json`. A refused path is null rather than
 * a silent downgrade to full prepayment: a shopper who chose cash on delivery and was charged
 * in full instead has been surprised by their own checkout.
 *
 * `partial` is refused when the floor is zero — there is nothing to part-pay, and the cart
 * should have been offered cash on delivery — and refused again when the floor reaches the
 * total, because "pay the minimum" and "pay in full" are then the same button and only one of
 * them should leave anything owing. That second guard is what keeps `amountDue` positive on
 * every `partial_cod` row, including for a product whose `minPrepaidAmount` exceeds its own
 * price, which the catalogue validator permits as an advisory
 * ([ADR-058](/docs/decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md)).
 */
export function resolvePaymentPlan(
  requestedPath: PaymentPath,
  cart: { total: number; summary: CartPrepaymentSummary | null },
): PaymentPlan | null {
  if (requestedPath === "full") {
    return { path: "full", paymentType: "prepaid", amountPrepaid: cart.total, amountDue: 0 };
  }

  if (cart.summary === null) return null;

  if (requestedPath === "cod") {
    if (!cart.summary.isCodEligible) return null;
    return { path: "cod", paymentType: "cod", amountPrepaid: 0, amountDue: cart.total };
  }

  const floor = cart.summary.minimumPrepayment;
  if (floor <= 0 || floor >= cart.total) return null;

  return {
    path: "partial",
    paymentType: "partial_cod",
    amountPrepaid: floor,
    amountDue: cart.total - floor,
  };
}
