import { describe, expect, it } from "vitest";
import { MAX_QUANTITY, MIN_QUANTITY, clampQuantity } from "@/lib/quantity";

describe("clampQuantity", () => {
  it("passes through values inside the range", () => {
    for (let value = MIN_QUANTITY; value <= MAX_QUANTITY; value += 1) {
      expect(clampQuantity(value)).toBe(value);
    }
  });

  it("clamps below the minimum", () => {
    expect(clampQuantity(0)).toBe(MIN_QUANTITY);
    expect(clampQuantity(-5)).toBe(MIN_QUANTITY);
  });

  it("clamps above the maximum", () => {
    expect(clampQuantity(11)).toBe(MAX_QUANTITY);
    expect(clampQuantity(9999)).toBe(MAX_QUANTITY);
  });

  it("floors fractional values", () => {
    expect(clampQuantity(2.9)).toBe(2);
    expect(clampQuantity(1.1)).toBe(1);
  });

  it("falls back to the minimum for NaN and Infinity", () => {
    expect(clampQuantity(Number.NaN)).toBe(MIN_QUANTITY);
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(MIN_QUANTITY);
    expect(clampQuantity(Number.NEGATIVE_INFINITY)).toBe(MIN_QUANTITY);
  });

  it("never returns a value outside the range for any input", () => {
    const inputs = [-100, -1, 0, 1, 5, 10, 10.5, 11, 1e9, Number.NaN];

    for (const input of inputs) {
      const result = clampQuantity(input);
      expect(result).toBeGreaterThanOrEqual(MIN_QUANTITY);
      expect(result).toBeLessThanOrEqual(MAX_QUANTITY);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});
