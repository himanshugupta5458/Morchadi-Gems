import { describe, expect, it } from "vitest";
import { isCartCodEligible } from "@/lib/cod";
import { getCodEligibilityCatalogue, getAllProducts } from "@/lib/products";
import {
  isValidMinPrepaidAmount,
  minPrepaidExceedsPrice,
} from "@/scripts/min-prepaid-rule.mjs";

describe("isCartCodEligible", () => {
  it("offers cash on delivery when every line requires no prepayment", () => {
    expect(
      isCartCodEligible([
        { minPrepaidAmount: 0 },
        { minPrepaidAmount: 0 },
        { minPrepaidAmount: 0 },
      ]),
    ).toBe(true);
  });

  it("offers cash on delivery for a single eligible line", () => {
    expect(isCartCodEligible([{ minPrepaidAmount: 0 }])).toBe(true);
  });

  it("withdraws cash on delivery when one line among several requires prepayment", () => {
    expect(
      isCartCodEligible([
        { minPrepaidAmount: 0 },
        { minPrepaidAmount: 500 },
        { minPrepaidAmount: 0 },
      ]),
    ).toBe(false);
  });

  it("withdraws cash on delivery when the prepaying line is the last one", () => {
    expect(
      isCartCodEligible([{ minPrepaidAmount: 0 }, { minPrepaidAmount: 1 }]),
    ).toBe(false);
  });

  it("refuses cash on delivery when every line requires prepayment", () => {
    expect(
      isCartCodEligible([{ minPrepaidAmount: 500 }, { minPrepaidAmount: 1200 }]),
    ).toBe(false);
  });

  it("refuses cash on delivery for an empty cart rather than passing vacuously", () => {
    expect(isCartCodEligible([])).toBe(false);
  });

  it("treats the smallest possible prepayment as disqualifying", () => {
    expect(isCartCodEligible([{ minPrepaidAmount: 1 }])).toBe(false);
  });

  it("decides from the pieces in the basket and never from what it is worth", () => {
    const cheapButBarred = [{ minPrepaidAmount: 5 }, { minPrepaidAmount: 5 }];
    const expensiveButEligible = [
      { minPrepaidAmount: 0 },
      { minPrepaidAmount: 0 },
    ];

    expect(isCartCodEligible(cheapButBarred)).toBe(false);
    expect(isCartCodEligible(expensiveButEligible)).toBe(true);
  });
});

describe("getCodEligibilityCatalogue", () => {
  it("carries an entry for every active product", () => {
    expect(getCodEligibilityCatalogue()).toHaveLength(getAllProducts().length);
  });

  it("exposes the minimum prepaid amount and the id, and no amount to price against", () => {
    const [entry] = getCodEligibilityCatalogue();

    expect(Object.keys(entry).sort()).toEqual(["id", "minPrepaidAmount"]);
  });

  it("reports the whole catalogue as cash-on-delivery eligible today", () => {
    expect(isCartCodEligible(getCodEligibilityCatalogue())).toBe(true);
  });
});

describe("the validator's minPrepaidAmount rules", () => {
  it("fails a product whose pricing block is missing the field entirely", () => {
    expect(isValidMinPrepaidAmount(undefined)).toBe(false);
  });

  it("accepts zero, which is what marks a piece cash-on-delivery eligible", () => {
    expect(isValidMinPrepaidAmount(0)).toBe(true);
  });

  it("accepts a whole number of rupees above zero", () => {
    expect(isValidMinPrepaidAmount(500)).toBe(true);
  });

  it("fails a negative amount", () => {
    expect(isValidMinPrepaidAmount(-1)).toBe(false);
  });

  it("fails a fractional amount, since the catalogue deals in whole rupees", () => {
    expect(isValidMinPrepaidAmount(499.5)).toBe(false);
  });

  it("fails an amount written as a string", () => {
    expect(isValidMinPrepaidAmount("500")).toBe(false);
  });

  it("raises an advisory, not a failure, when the amount exceeds the item's own price", () => {
    expect(minPrepaidExceedsPrice(900, 800)).toBe(true);
    expect(isValidMinPrepaidAmount(900)).toBe(true);
  });

  it("says nothing when the amount equals the item's price", () => {
    expect(minPrepaidExceedsPrice(800, 800)).toBe(false);
  });

  it("says nothing when the amount is below the item's price", () => {
    expect(minPrepaidExceedsPrice(200, 800)).toBe(false);
  });

  it("stays quiet about a malformed amount rather than reporting it twice", () => {
    expect(minPrepaidExceedsPrice(-5, 800)).toBe(false);
    expect(minPrepaidExceedsPrice(undefined, 800)).toBe(false);
  });
});

describe("the catalogue on disk", () => {
  it("gives every product a valid minPrepaidAmount", () => {
    const invalid = getAllProducts().filter(
      (product) => !isValidMinPrepaidAmount(product.pricing.minPrepaidAmount),
    );

    expect(invalid.map((product) => product.id)).toEqual([]);
  });

  it("designates no product as requiring prepayment yet", () => {
    const requiringPrepayment = getAllProducts().filter(
      (product) => product.pricing.minPrepaidAmount > 0,
    );

    expect(requiringPrepayment.map((product) => product.id)).toEqual([]);
  });
});
