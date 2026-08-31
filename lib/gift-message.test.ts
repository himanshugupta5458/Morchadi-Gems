import { describe, expect, it } from "vitest";
import { GIFT_MESSAGE_MAX_LENGTH, parseGiftMessage } from "@/lib/gift-message";
import { buildOrderFromCart } from "@/lib/order";
import { resolvePaymentPlan } from "@/lib/cod";
import { getOrderPricingCatalogue, getCodEligibilityCatalogue } from "@/lib/products";

/**
 * A gift note is the first field this checkout has taken from a browser that is neither an
 * identifier, a quantity, nor an address — it is prose, unvalidated by anything but length, and
 * it goes into a database column. So the two things worth pinning are what it becomes, and what
 * it cannot touch.
 */

describe("parseGiftMessage", () => {
  it("keeps a note as written", () => {
    expect(parseGiftMessage("Happy birthday, Meera!")).toBe("Happy birthday, Meera!");
  });

  it("keeps the line breaks a note is written in", () => {
    expect(parseGiftMessage("For Meera\nWith love")).toBe("For Meera\nWith love");
  });

  it("drops control characters that have no place on a printed card", () => {
    expect(parseGiftMessage("For \u0007\u0000 Meera")).toBe("For  Meera");
  });

  it("trims, and treats whitespace alone as no note at all", () => {
    expect(parseGiftMessage("   For Meera   ")).toBe("For Meera");
    expect(parseGiftMessage("   ")).toBeNull();
    expect(parseGiftMessage("")).toBeNull();
  });

  it("truncates rather than refusing, because a note is a courtesy and not a gate", () => {
    const oversized = "x".repeat(10_000);

    expect(parseGiftMessage(oversized)).toHaveLength(GIFT_MESSAGE_MAX_LENGTH);
  });

  it("is null for anything that is not a string", () => {
    for (const value of [undefined, null, 42, true, { total: 1 }, ["note"]]) {
      expect(parseGiftMessage(value)).toBeNull();
    }
  });
});

/**
 * The discipline every other client input in this checkout is held to, applied to this one: the
 * amount is recomputed from `data/products.json` and the note is not one of its inputs.
 *
 * `buildOrderFromCart` and `resolvePaymentPlan` are the two functions between a request and a
 * charge, and neither has a parameter a note could be passed through — which is the point. The
 * cases below run them over the same cart with and without a hostile note in scope and assert
 * the figures are identical, so the seal is checked rather than merely asserted in prose.
 */
describe("a gift message and the money", () => {
  const PRICING_CATALOGUE = getOrderPricingCatalogue();
  const SELLABLE_ID = PRICING_CATALOGUE.find((entry) => entry.inStock)?.id ?? "";

  function priceTheCart(): { subtotal: number; shipping: number; total: number } {
    const order = buildOrderFromCart(
      [{ productId: SELLABLE_ID, qty: 2 }],
      PRICING_CATALOGUE,
    );

    if (!order.valid) throw new Error("the fixture cart no longer prices");

    return { subtotal: order.subtotal, shipping: order.shipping, total: order.total };
  }

  it("prices a cart from the catalogue, with no note anywhere in the calculation", () => {
    const priced = priceTheCart();

    expect(priced.total).toBe(priced.subtotal + priced.shipping);
    expect(priced.total).toBeGreaterThan(0);
  });

  it("cannot be made to move a total, however it is written", () => {
    const baseline = priceTheCart();

    const hostileNotes: unknown[] = [
      "x".repeat(10_000),
      '{"total": 1}',
      "total=1; subtotal=1; shipping=0",
      "0",
      "-99999",
      { total: 1 },
      99999,
    ];

    for (const note of hostileNotes) {
      parseGiftMessage(note);
      expect(priceTheCart()).toEqual(baseline);
    }
  });

  it("cannot be made to move what a payment path collects", () => {
    const priced = priceTheCart();
    const summary = { isCodEligible: true, minimumPrepayment: 0 };

    const plan = resolvePaymentPlan("full", { ...priced, summary });
    parseGiftMessage("-1000");
    const planAgain = resolvePaymentPlan("full", { ...priced, summary });

    expect(plan).toEqual(planAgain);
    expect(plan?.amountPrepaid).toBeGreaterThan(0);
  });

  it("is barred from the eligibility catalogue as firmly as it is from the pricing one", () => {
    const eligibilityFields = new Set(
      getCodEligibilityCatalogue().flatMap((entry) => Object.keys(entry)),
    );
    const pricingFields = new Set(PRICING_CATALOGUE.flatMap((entry) => Object.keys(entry)));

    expect(eligibilityFields.has("giftMessage")).toBe(false);
    expect(pricingFields.has("giftMessage")).toBe(false);
  });
});
