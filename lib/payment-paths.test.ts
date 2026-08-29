import { describe, expect, it } from "vitest";
import type { PaymentPath } from "@/types/order";
import {
  calculateOnlinePaymentDiscount,
  isCartCodEligible,
  parsePaymentPath,
  resolvePaymentPlan,
  summariseCartPrepayment,
  type CodEligibilityEntry,
} from "@/lib/cod";
import { isBalancedOrderPayment } from "@/lib/order-capture";
import { getCodEligibilityCatalogue } from "@/lib/products";

const FREE_ID = "P001";
const ALSO_FREE_ID = "P002";
const BARRED_ID = "P010";

/** A catalogue with one piece that requires prepayment, held apart from the real one. */
const MIXED_CATALOGUE: CodEligibilityEntry[] = [
  { id: FREE_ID, minPrepaidAmount: 0 },
  { id: ALSO_FREE_ID, minPrepaidAmount: 0 },
  { id: BARRED_ID, minPrepaidAmount: 500 },
];

describe("summariseCartPrepayment", () => {
  it("reports a cart of eligible pieces as owing nothing up front", () => {
    expect(
      summariseCartPrepayment(
        [
          { productId: FREE_ID, qty: 2 },
          { productId: ALSO_FREE_ID, qty: 1 },
        ],
        MIXED_CATALOGUE,
      ),
    ).toEqual({ isCodEligible: true, minimumPrepayment: 0 });
  });

  it("multiplies the floor by the quantity, because the field is per unit", () => {
    expect(
      summariseCartPrepayment([{ productId: BARRED_ID, qty: 3 }], MIXED_CATALOGUE),
    ).toEqual({ isCodEligible: false, minimumPrepayment: 1500 });
  });

  it("withdraws eligibility from the whole cart for one barred piece, and sums only that piece", () => {
    expect(
      summariseCartPrepayment(
        [
          { productId: FREE_ID, qty: 4 },
          { productId: BARRED_ID, qty: 1 },
        ],
        MIXED_CATALOGUE,
      ),
    ).toEqual({ isCodEligible: false, minimumPrepayment: 500 });
  });

  it("sums two lines of one product separately, as the cart holds them", () => {
    expect(
      summariseCartPrepayment(
        [
          { productId: BARRED_ID, qty: 1 },
          { productId: BARRED_ID, qty: 2 },
        ],
        MIXED_CATALOGUE,
      ),
    ).toEqual({ isCodEligible: false, minimumPrepayment: 1500 });
  });

  /**
   * The line the pricing core has already accepted cannot reach this, because both catalogues
   * are built from the same active products. It fails towards collecting the money anyway.
   */
  it("answers null for a cart naming a product the catalogue does not hold", () => {
    expect(
      summariseCartPrepayment([{ productId: "P999" }].map((line) => ({ ...line, qty: 1 })), MIXED_CATALOGUE),
    ).toBeNull();
  });

  it("refuses an empty cart rather than passing vacuously, like isCartCodEligible", () => {
    expect(summariseCartPrepayment([], MIXED_CATALOGUE)).toEqual({
      isCodEligible: false,
      minimumPrepayment: 0,
    });
  });

  it("agrees with isCartCodEligible about the real catalogue as it reads today", () => {
    const catalogue = getCodEligibilityCatalogue();
    const wholeCatalogueAsACart = catalogue.map((entry) => ({
      productId: entry.id,
      qty: 1,
    }));
    const everyFloorOnce = catalogue.reduce(
      (running, entry) => running + entry.minPrepaidAmount,
      0,
    );

    expect(everyFloorOnce).toBeGreaterThan(0);
    expect(summariseCartPrepayment(wholeCatalogueAsACart, catalogue)).toEqual({
      isCodEligible: isCartCodEligible(catalogue),
      minimumPrepayment: everyFloorOnce,
    });
  });
});

describe("parsePaymentPath", () => {
  it("reads a body that names no path as full prepayment, which is what it always meant", () => {
    expect(parsePaymentPath(undefined)).toBe("full");
    expect(parsePaymentPath(null)).toBe("full");
  });

  it("reads each of the three words it knows", () => {
    expect(parsePaymentPath("cod")).toBe("cod");
    expect(parsePaymentPath("partial")).toBe("partial");
    expect(parsePaymentPath("full")).toBe("full");
  });

  it("falls to full prepayment for anything else, rather than refusing the order", () => {
    for (const nonsense of ["COD", "free", 0, {}, [], true, "prepaid"]) {
      expect(parsePaymentPath(nonsense), JSON.stringify(nonsense)).toBe("full");
    }
  });
});

const ELIGIBLE = { isCodEligible: true, minimumPrepayment: 0 };
const BARRED = { isCodEligible: false, minimumPrepayment: 500 };

describe("resolvePaymentPlan", () => {
  it("prices full prepayment at the full total, whatever the cart holds, when the cart is not cash-on-delivery-eligible", () => {
    for (const summary of [BARRED, null]) {
      expect(resolvePaymentPlan("full", { subtotal: 2000, shipping: 0, summary })).toEqual({
        path: "full",
        paymentType: "prepaid",
        amountPrepaid: 2000,
        amountDue: 0,
        total: 2000,
        onlineDiscount: 0,
      });
    }
  });

  it("prices cash on delivery as nothing now and everything at the door", () => {
    expect(resolvePaymentPlan("cod", { subtotal: 2000, shipping: 0, summary: ELIGIBLE })).toEqual({
      path: "cod",
      paymentType: "cod",
      amountPrepaid: 0,
      amountDue: 2000,
      total: 2000,
      onlineDiscount: 0,
    });
  });

  it("prices a part payment as the floor now and the remainder at the door", () => {
    expect(resolvePaymentPlan("partial", { subtotal: 2000, shipping: 0, summary: BARRED })).toEqual({
      path: "partial",
      paymentType: "partial_cod",
      amountPrepaid: 500,
      amountDue: 1500,
      total: 2000,
      onlineDiscount: 0,
    });
  });

  it("refuses cash on delivery on a cart holding a piece that requires prepayment", () => {
    expect(resolvePaymentPlan("cod", { subtotal: 2000, shipping: 0, summary: BARRED })).toBeNull();
  });

  it("refuses a part payment on a cart with no floor to part-pay", () => {
    expect(
      resolvePaymentPlan("partial", { subtotal: 2000, shipping: 0, summary: ELIGIBLE }),
    ).toBeNull();
  });

  /**
   * The validator permits a `minPrepaidAmount` above the piece's own price as an advisory
   * (ADR-058), so a floor can reach or pass the order total. Refusing it here is what keeps
   * `amountDue` positive on every `partial_cod` row ever written.
   */
  it("refuses a part payment whose floor has reached or passed the total", () => {
    for (const subtotal of [500, 400, 1]) {
      expect(
        resolvePaymentPlan("partial", { subtotal, shipping: 0, summary: BARRED }),
        `subtotal ${subtotal}`,
      ).toBeNull();
    }
  });

  it("refuses cash on delivery, but never full prepayment, on a cart it could not reason about", () => {
    expect(resolvePaymentPlan("cod", { subtotal: 2000, shipping: 0, summary: null })).toBeNull();
    expect(
      resolvePaymentPlan("partial", { subtotal: 2000, shipping: 0, summary: null }),
    ).toBeNull();
    expect(
      resolvePaymentPlan("full", { subtotal: 2000, shipping: 0, summary: null }),
    ).not.toBeNull();
  });

  it("never decides from what the cart is worth, only from what is in it", () => {
    const cheapAndBarred = resolvePaymentPlan("cod", { subtotal: 50, shipping: 0, summary: BARRED });
    const expensiveAndEligible = resolvePaymentPlan("cod", {
      subtotal: 90_000,
      shipping: 0,
      summary: ELIGIBLE,
    });

    expect(cheapAndBarred).toBeNull();
    expect(expensiveAndEligible).not.toBeNull();
  });
});

/**
 * [ADR-063](/docs/decisions/ADR-063-online-payment-discount.md): 5% off the product subtotal,
 * and only for paying online in full on a cart every line of which is cash-on-delivery-eligible.
 */
describe("the online-payment discount on resolvePaymentPlan", () => {
  it("discounts full prepayment by 5% of the subtotal on a cash-on-delivery-eligible cart", () => {
    const plan = resolvePaymentPlan("full", { subtotal: 2000, shipping: 99, summary: ELIGIBLE });

    expect(plan).toEqual({
      path: "full",
      paymentType: "prepaid",
      amountPrepaid: 1999,
      amountDue: 0,
      total: 1999,
      onlineDiscount: 100,
    });
  });

  it("never discounts shipping, only the subtotal", () => {
    const noShipping = resolvePaymentPlan("full", { subtotal: 2000, shipping: 0, summary: ELIGIBLE });
    const withShipping = resolvePaymentPlan("full", {
      subtotal: 2000,
      shipping: 99,
      summary: ELIGIBLE,
    });

    expect(noShipping?.onlineDiscount).toBe(100);
    expect(withShipping?.onlineDiscount).toBe(100);
    expect(withShipping?.total).toBe(noShipping!.total + 99);
  });

  it("never discounts cash on delivery, which keeps today's price", () => {
    const plan = resolvePaymentPlan("cod", { subtotal: 2000, shipping: 0, summary: ELIGIBLE });
    expect(plan?.onlineDiscount).toBe(0);
    expect(plan?.amountDue).toBe(2000);
  });

  /**
   * The partial-payment path, and the "pay in full" option on a partial-payment-eligible cart,
   * are both completely unaffected by this feature — the regression this whole describe block
   * exists to pin down.
   */
  it("never discounts a cart holding any piece that requires prepayment, on either of its two options", () => {
    const payInFull = resolvePaymentPlan("full", { subtotal: 2000, shipping: 0, summary: BARRED });
    const payMinimum = resolvePaymentPlan("partial", {
      subtotal: 2000,
      shipping: 0,
      summary: BARRED,
    });

    expect(payInFull).toEqual({
      path: "full",
      paymentType: "prepaid",
      amountPrepaid: 2000,
      amountDue: 0,
      total: 2000,
      onlineDiscount: 0,
    });
    expect(payMinimum?.onlineDiscount).toBe(0);
  });

  it("never discounts full prepayment when eligibility could not be established", () => {
    const plan = resolvePaymentPlan("full", { subtotal: 2000, shipping: 0, summary: null });
    expect(plan?.onlineDiscount).toBe(0);
    expect(plan?.amountPrepaid).toBe(2000);
  });

  it("rounds to the nearest rupee, via the one function both the plan and any preview must share", () => {
    for (const subtotal of [1, 9, 10, 11, 99, 101, 647, 1649, 12_499]) {
      const plan = resolvePaymentPlan("full", { subtotal, shipping: 0, summary: ELIGIBLE });
      expect(plan?.onlineDiscount, `subtotal ${subtotal}`).toBe(
        calculateOnlinePaymentDiscount(subtotal),
      );
      expect(Number.isInteger(plan?.onlineDiscount), `subtotal ${subtotal}`).toBe(true);
    }
  });
});

/**
 * The invariant the whole payment-type scheme rests on, asserted as one property over all
 * three paths rather than as three separate checks of individual fields. It is what makes
 * "money outstanding" one query against `orders` rather than three cases, and a path that
 * broke it would put a permanent, quiet lie about money into a table nothing else audits.
 */
describe("amountPrepaid + amountDue = total, on every path", () => {
  const CASES: ReadonlyArray<{
    path: PaymentPath;
    summary: typeof ELIGIBLE | typeof BARRED;
  }> = [
    { path: "full", summary: ELIGIBLE },
    { path: "full", summary: BARRED },
    { path: "cod", summary: ELIGIBLE },
    { path: "partial", summary: BARRED },
  ];

  it("holds for every path across a wide range of subtotals", () => {
    for (const { path, summary } of CASES) {
      for (const subtotal of [1, 210, 259, 501, 2000, 12_499, 99_999]) {
        const plan = resolvePaymentPlan(path, { subtotal, shipping: 0, summary });
        if (plan === null) continue;

        expect(plan.amountPrepaid + plan.amountDue, `${path} at ${subtotal}`).toBe(plan.total);
        expect(plan.amountPrepaid, `${path} at ${subtotal}`).toBeGreaterThanOrEqual(0);
        expect(plan.amountDue, `${path} at ${subtotal}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is what captureOrder checks before it writes, on every path, discounted or not", () => {
    for (const { path, summary } of CASES) {
      const plan = resolvePaymentPlan(path, { subtotal: 1951, shipping: 49, summary });
      if (plan === null) continue;

      expect(
        isBalancedOrderPayment(
          { subtotal: plan.total - 49, shippingFee: 49, total: plan.total },
          {
            paymentType: plan.paymentType,
            amountPrepaid: plan.amountPrepaid,
            amountDue: plan.amountDue,
          },
        ),
        path,
      ).toBe(true);
    }
  });

  it("refuses a hand-built split that does not add up, whichever way it is wrong", () => {
    const pricing = { subtotal: 1951, shippingFee: 49, total: 2000 };

    for (const payment of [
      { paymentType: "cod" as const, amountPrepaid: 0, amountDue: 1999 },
      { paymentType: "cod" as const, amountPrepaid: 0, amountDue: 2001 },
      { paymentType: "partial_cod" as const, amountPrepaid: 500, amountDue: 2000 },
      { paymentType: "prepaid" as const, amountPrepaid: 2000, amountDue: 1 },
      { paymentType: "prepaid" as const, amountPrepaid: -1, amountDue: 2001 },
      { paymentType: "cod" as const, amountPrepaid: 3000, amountDue: -1000 },
    ]) {
      expect(isBalancedOrderPayment(pricing, payment), JSON.stringify(payment)).toBe(false);
    }
  });

  it("marks the three exact splits as balanced and nothing else at that total", () => {
    const pricing = { subtotal: 1951, shippingFee: 49, total: 2000 };

    expect(
      isBalancedOrderPayment(pricing, {
        paymentType: "prepaid",
        amountPrepaid: 2000,
        amountDue: 0,
      }),
    ).toBe(true);
    expect(
      isBalancedOrderPayment(pricing, {
        paymentType: "cod",
        amountPrepaid: 0,
        amountDue: 2000,
      }),
    ).toBe(true);
    expect(
      isBalancedOrderPayment(pricing, {
        paymentType: "partial_cod",
        amountPrepaid: 500,
        amountDue: 1500,
      }),
    ).toBe(true);
  });
});
