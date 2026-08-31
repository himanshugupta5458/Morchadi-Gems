import { describe, expect, it } from "vitest";
import type { CatalogueEntry } from "@/types/product";
import { buildCartLines, calculateCartMrpSubtotal, calculateCartTotals } from "@/lib/cart";
import {
  calculateOnlinePaymentDiscount,
  resolvePaymentPlan,
  summariseCartPrepayment,
} from "@/lib/cod";
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  amountToFreeShipping,
  calculateShipping,
} from "@/lib/config";

/**
 * The regression suite for the one number this prompt was asked to audit: the shortfall the cart
 * tells a shopper to add before shipping becomes free.
 *
 * **It was already correct, and this file is the standing proof of why.** The gap is
 * `amountToFreeShipping(subtotal)`, where `subtotal` is `Σ entry.price × qty` — the amount
 * actually charged. Two other figures are in scope on the same screens and neither may be
 * substituted for it:
 *
 * - **The MRP subtotal.** A compare-at price has never been summed into a cart total
 *   (`calculateCartTotals` reads `unitPrice`, which is `entry.price`), and measuring the
 *   threshold against it would promise free delivery to a cart of heavily discounted pieces that
 *   the server would then charge ₹99 for.
 * - **The total after the 5% online-payment discount.** `resolvePaymentPlan` computes
 *   `total = subtotal + shipping` and *then* subtracts the discount, so shipping is decided
 *   before the rebate exists. A gap that moved with the discount would advertise a threshold
 *   `calculateShipping` does not honour.
 *
 * So the correct behaviour is a gap that does **not** move when the online discount is applied,
 * which is exactly the "inconsistency" the audit noticed. What was actually wrong was that
 * `OrderTotals` rendered the nudge on the payment step, two lines above the discount row, where
 * the two read as though they should interact. ADR-072 moved the nudge to `FreeShippingProgress`
 * on the cart alone; the arithmetic is untouched and is pinned below either way.
 */

const ENTRIES: CatalogueEntry[] = [
  {
    id: "nk-001",
    name: "Kundan Rani Haar",
    category: "necklaces",
    price: 400,
    mrp: 900,
    image: "/products/nk-001.webp",
    inStock: true,
  },
  {
    id: "er-001",
    name: "Polki Jhumkas",
    category: "earrings",
    price: 150,
    mrp: 150,
    image: "/products/er-001.webp",
    inStock: true,
  },
];

function cartOf(quantities: Record<string, number>): ReturnType<typeof buildCartLines> {
  return buildCartLines(
    Object.entries(quantities).map(([productId, qty]) => {
      const entry = ENTRIES.find((candidate) => candidate.id === productId);
      if (entry === undefined) throw new Error(`no fixture for ${productId}`);
      return {
        productId,
        name: entry.name,
        price: entry.price,
        image: entry.image ?? "",
        qty,
      };
    }),
    ENTRIES,
  );
}

describe("the free-shipping gap", () => {
  it("is measured against the selling price, not the compare-at price", () => {
    const lines = cartOf({ "nk-001": 1 });
    const { subtotal } = calculateCartTotals(lines);
    const mrpSubtotal = calculateCartMrpSubtotal(lines);

    expect(subtotal).toBe(400);
    expect(mrpSubtotal).toBe(900);

    expect(amountToFreeShipping(subtotal)).toBe(FREE_SHIPPING_THRESHOLD - 400);
    expect(amountToFreeShipping(subtotal)).not.toBe(
      amountToFreeShipping(mrpSubtotal),
    );
  });

  it("still asks for the shortfall on a cart whose MRP already clears the threshold", () => {
    const lines = cartOf({ "nk-001": 1 });
    const { subtotal, shipping } = calculateCartTotals(lines);

    expect(calculateCartMrpSubtotal(lines)).toBeGreaterThan(FREE_SHIPPING_THRESHOLD);
    expect(shipping).toBe(FLAT_SHIPPING_RATE);
    expect(amountToFreeShipping(subtotal)).toBeGreaterThan(0);
  });

  it("is the exact complement of the shipping the cart is charged", () => {
    for (const subtotal of [0, 1, 100, FREE_SHIPPING_THRESHOLD - 1, FREE_SHIPPING_THRESHOLD, 5000]) {
      const shortfall = amountToFreeShipping(subtotal);
      const shipping = calculateShipping(subtotal);

      if (subtotal <= 0) {
        expect(shortfall).toBe(0);
        expect(shipping).toBe(0);
        continue;
      }

      expect(shortfall === 0).toBe(shipping === 0);
      if (shortfall > 0) expect(subtotal + shortfall).toBe(FREE_SHIPPING_THRESHOLD);
    }
  });

  it("does not move when the online-payment discount is applied, because shipping does not either", () => {
    const lines = cartOf({ "nk-001": 1, "er-001": 1 });
    const { subtotal, shipping } = calculateCartTotals(lines);

    const plan = resolvePaymentPlan("full", {
      subtotal,
      shipping,
      summary: summariseCartPrepayment(
        lines.map((line) => ({ productId: line.entry.id, qty: line.quantity })),
        ENTRIES.map((entry) => ({ id: entry.id, minPrepaidAmount: 0 })),
      ),
    });

    expect(plan).not.toBeNull();
    expect(plan?.onlineDiscount).toBe(calculateOnlinePaymentDiscount(subtotal));
    expect(plan?.onlineDiscount).toBeGreaterThan(0);

    /** The rebate is taken off the total, and the total is not what the threshold is read against. */
    expect(plan?.total).toBe(subtotal + shipping - (plan?.onlineDiscount ?? 0));
    expect(amountToFreeShipping(subtotal)).toBe(FREE_SHIPPING_THRESHOLD - subtotal);
    expect(amountToFreeShipping(subtotal)).not.toBe(
      amountToFreeShipping(plan?.total ?? 0),
    );
  });

  it("would over-promise if it were read against the discounted total", () => {
    const subtotalAtThreshold = FREE_SHIPPING_THRESHOLD;
    const shipping = calculateShipping(subtotalAtThreshold);
    const discountedTotal =
      subtotalAtThreshold + shipping - calculateOnlinePaymentDiscount(subtotalAtThreshold);

    /**
     * The cart ships free, because `calculateShipping` reads the undiscounted subtotal — which is
     * exactly what `/api/create-order` charges from. A gap computed on `discountedTotal` would
     * have told this shopper they were still short.
     */
    expect(shipping).toBe(0);
    expect(amountToFreeShipping(subtotalAtThreshold)).toBe(0);
    expect(amountToFreeShipping(discountedTotal)).toBeGreaterThan(0);
  });
});
