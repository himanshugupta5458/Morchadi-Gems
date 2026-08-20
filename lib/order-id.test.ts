import { describe, expect, it, vi } from "vitest";
import {
  MAX_ORDER_ID_ATTEMPTS,
  ORDER_ID_ALPHABET,
  ORDER_ID_EXCLUDED_CHARACTERS,
  ORDER_ID_LENGTH,
  generateOrderIdCandidate,
  generateUniqueOrderId,
} from "@/lib/order-id";

const GENERATION_SAMPLE_SIZE = 5_000;

function sampleCandidates(count: number): string[] {
  return Array.from({ length: count }, () => generateOrderIdCandidate());
}

describe("the order id alphabet", () => {
  it("is the thirty-one unambiguous uppercase alphanumerics", () => {
    expect(ORDER_ID_ALPHABET).toBe("23456789ABCDEFGHJKMNPQRSTUVWXYZ");
    expect(ORDER_ID_ALPHABET).toHaveLength(31);
    expect(new Set(ORDER_ID_ALPHABET).size).toBe(31);
  });

  it("excludes exactly zero, capital O, one, capital I and capital L", () => {
    expect(ORDER_ID_EXCLUDED_CHARACTERS).toBe("0O1IL");

    for (const excluded of ORDER_ID_EXCLUDED_CHARACTERS) {
      expect(ORDER_ID_ALPHABET).not.toContain(excluded);
    }

    for (const character of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      expect(
        ORDER_ID_ALPHABET.includes(character),
        `${character} should ${ORDER_ID_EXCLUDED_CHARACTERS.includes(character) ? "not " : ""}be in the alphabet`,
      ).toBe(!ORDER_ID_EXCLUDED_CHARACTERS.includes(character));
    }
  });
});

describe("a generated order id", () => {
  it("is always ten characters", () => {
    expect(ORDER_ID_LENGTH).toBe(10);

    for (const candidate of sampleCandidates(GENERATION_SAMPLE_SIZE)) {
      expect(candidate).toHaveLength(10);
    }
  });

  it("never contains an ambiguous character, across many generations", () => {
    const ambiguous = /[0O1IL]/;

    for (const candidate of sampleCandidates(GENERATION_SAMPLE_SIZE)) {
      expect(ambiguous.test(candidate), candidate).toBe(false);
      expect(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/.test(candidate), candidate).toBe(
        true,
      );
    }
  });

  it("uses every character of the alphabet and no other, given enough draws", () => {
    const seen = new Set(sampleCandidates(GENERATION_SAMPLE_SIZE).join(""));

    expect(Array.from(seen).sort().join("")).toBe(
      Array.from(ORDER_ID_ALPHABET).sort().join(""),
    );
  });

  it("does not repeat itself, which is the property the retry is a backstop for", () => {
    const candidates = sampleCandidates(GENERATION_SAMPLE_SIZE);

    expect(new Set(candidates).size).toBe(candidates.length);
  });
});

describe("the uniqueness retry", () => {
  it("returns the first candidate the database does not already hold", async () => {
    const isTaken = vi.fn().mockResolvedValue(false);

    const orderId = await generateUniqueOrderId(isTaken);

    expect(isTaken).toHaveBeenCalledTimes(1);
    expect(isTaken).toHaveBeenCalledWith(orderId);
    expect(orderId).toHaveLength(ORDER_ID_LENGTH);
  });

  it("draws again on a collision, and returns the id it drew second", async () => {
    const isTaken = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const orderId = await generateUniqueOrderId(isTaken);

    expect(isTaken).toHaveBeenCalledTimes(2);
    expect(isTaken.mock.calls[0][0]).not.toBe(orderId);
    expect(isTaken.mock.calls[1][0]).toBe(orderId);
  });

  it("keeps redrawing across several collisions in a row", async () => {
    const isTaken = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    const orderId = await generateUniqueOrderId(isTaken);

    expect(isTaken).toHaveBeenCalledTimes(4);
    expect(orderId).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
  });

  it("gives up rather than spinning forever when every candidate is refused", async () => {
    const isTaken = vi.fn().mockResolvedValue(true);

    await expect(generateUniqueOrderId(isTaken)).rejects.toThrow(
      `Could not find a free order id in ${MAX_ORDER_ID_ATTEMPTS} attempts`,
    );
    expect(isTaken).toHaveBeenCalledTimes(MAX_ORDER_ID_ATTEMPTS);
  });
});
