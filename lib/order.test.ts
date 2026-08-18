import { describe, expect, it } from "vitest";
import type { CatalogueEntry } from "@/types/product";
import type { OrderItemErrorCode } from "@/types/order";
import { FLAT_SHIPPING_RATE } from "@/lib/config";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/quantity";
import { buildOrderFromCart, parseOrderItems } from "@/lib/order";

function makeEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    id: "nk-001",
    name: "Kundan Rani Haar",
    price: 1000,
    mrp: 9999,
    image: "/products/nk-001.webp",
    inStock: true,
    ...overrides,
  };
}

const NECKLACE = makeEntry();
const EARRING = makeEntry({
  id: "er-001",
  name: "Polki Jhumkas",
  price: 250,
  mrp: 8888,
});
const SOLD_OUT_RING = makeEntry({
  id: "rg-001",
  name: "Temple Gold Ring",
  price: 700,
  mrp: 7777,
  inStock: false,
});

const CATALOGUE: CatalogueEntry[] = [NECKLACE, EARRING, SOLD_OUT_RING];

function errorCodesFor(items: { productId: string; qty: number }[]): OrderItemErrorCode[] {
  return buildOrderFromCart(items, CATALOGUE).errors.map((error) => error.code);
}

describe("buildOrderFromCart — a valid order", () => {
  it("prices a multi-item order from the catalogue", () => {
    const result = buildOrderFromCart(
      [
        { productId: NECKLACE.id, qty: 2 },
        { productId: EARRING.id, qty: 3 },
      ],
      CATALOGUE,
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.subtotal).toBe(2 * 1000 + 3 * 250);
    expect(result.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(result.total).toBe(2750 + FLAT_SHIPPING_RATE);
  });

  it("echoes line items with the catalogue's name, unit price and line total", () => {
    const result = buildOrderFromCart([{ productId: EARRING.id, qty: 4 }], CATALOGUE);

    expect(result.lineItems).toEqual([
      {
        productId: "er-001",
        name: "Polki Jhumkas",
        unitPrice: 250,
        qty: 4,
        lineTotal: 1000,
      },
    ]);
  });

  it("charges shipping once per order, not once per line", () => {
    const oneLine = buildOrderFromCart([{ productId: NECKLACE.id, qty: 1 }], CATALOGUE);
    const twoLines = buildOrderFromCart(
      [
        { productId: NECKLACE.id, qty: 1 },
        { productId: EARRING.id, qty: 1 },
      ],
      CATALOGUE,
    );

    expect(oneLine.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(twoLines.shipping).toBe(FLAT_SHIPPING_RATE);
  });

  it("accepts the quantity bounds themselves", () => {
    const atMinimum = buildOrderFromCart(
      [{ productId: NECKLACE.id, qty: MIN_QUANTITY }],
      CATALOGUE,
    );
    const atMaximum = buildOrderFromCart(
      [{ productId: NECKLACE.id, qty: MAX_QUANTITY }],
      CATALOGUE,
    );

    expect(atMinimum.valid).toBe(true);
    expect(atMaximum.valid).toBe(true);
    expect(atMaximum.subtotal).toBe(MAX_QUANTITY * 1000);
  });
});

describe("buildOrderFromCart — the server is the only source of prices", () => {
  it("ignores any amount the client attached to a line", () => {
    const tamperedItems = [
      { productId: NECKLACE.id, qty: 1, price: 1, lineTotal: 1, total: 1 },
      { productId: EARRING.id, qty: 1, price: 0, mrp: 0 },
    ];

    const result = buildOrderFromCart(tamperedItems, CATALOGUE);

    expect(result.valid).toBe(true);
    expect(result.subtotal).toBe(1250);
    expect(result.total).toBe(1250 + FLAT_SHIPPING_RATE);
    expect(result.lineItems.map((lineItem) => lineItem.unitPrice)).toEqual([1000, 250]);
  });

  it("never reads mrp, so a compare-at price cannot become a charge", () => {
    const inflatedMrp = makeEntry({ id: "nk-002", price: 500, mrp: 250_000 });

    const result = buildOrderFromCart([{ productId: "nk-002", qty: 2 }], [inflatedMrp]);

    expect(result.subtotal).toBe(1000);
    expect(result.total).toBe(1000 + FLAT_SHIPPING_RATE);
  });

  it("strips client-sent fields out of the line items it produces", () => {
    const spoofedItems = [
      { productId: NECKLACE.id, qty: 1, name: "Free Necklace", price: 0 },
    ];

    const result = buildOrderFromCart(spoofedItems, CATALOGUE);

    expect(result.lineItems[0]).toEqual({
      productId: "nk-001",
      name: "Kundan Rani Haar",
      unitPrice: 1000,
      qty: 1,
      lineTotal: 1000,
    });
  });
});

describe("buildOrderFromCart — refusals", () => {
  it("refuses an empty order", () => {
    const result = buildOrderFromCart([], CATALOGUE);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        productId: null,
        code: "EMPTY_CART",
        message: "There is nothing in this order.",
      },
    ]);
  });

  it("refuses an unknown product id", () => {
    expect(errorCodesFor([{ productId: "does-not-exist", qty: 1 }])).toEqual([
      "UNKNOWN_PRODUCT",
    ]);
  });

  it("refuses a sold-out product", () => {
    expect(errorCodesFor([{ productId: SOLD_OUT_RING.id, qty: 1 }])).toEqual([
      "OUT_OF_STOCK",
    ]);
  });

  it("names the sold-out piece in the error so the shopper knows which to remove", () => {
    const result = buildOrderFromCart(
      [{ productId: SOLD_OUT_RING.id, qty: 1 }],
      CATALOGUE,
    );

    expect(result.errors[0].message).toContain("Temple Gold Ring");
    expect(result.errors[0].productId).toBe("rg-001");
  });

  it.each([
    ["zero", 0],
    ["above the maximum", MAX_QUANTITY + 1],
    ["negative", -3],
    ["fractional", 1.5],
    ["not a number", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("refuses a quantity that is %s", (_label, qty) => {
    expect(errorCodesFor([{ productId: NECKLACE.id, qty }])).toEqual([
      "INVALID_QUANTITY",
    ]);
  });

  it("refuses a repeated product rather than merging it past the per-line cap", () => {
    const result = buildOrderFromCart(
      [
        { productId: NECKLACE.id, qty: MAX_QUANTITY },
        { productId: NECKLACE.id, qty: MAX_QUANTITY },
      ],
      CATALOGUE,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(["DUPLICATE_PRODUCT"]);
  });

  it("collects every fault in a mixed order, not just the first", () => {
    const result = buildOrderFromCart(
      [
        { productId: NECKLACE.id, qty: 2 },
        { productId: "ghost-001", qty: 1 },
        { productId: SOLD_OUT_RING.id, qty: 1 },
        { productId: EARRING.id, qty: 99 },
      ],
      CATALOGUE,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual([
      "UNKNOWN_PRODUCT",
      "OUT_OF_STOCK",
      "INVALID_QUANTITY",
    ]);
    expect(result.errors.map((error) => error.productId)).toEqual([
      "ghost-001",
      "rg-001",
      "er-001",
    ]);
  });

  it("zeroes every amount on a refusal, so a rejected order cannot be charged", () => {
    const result = buildOrderFromCart(
      [
        { productId: NECKLACE.id, qty: 2 },
        { productId: SOLD_OUT_RING.id, qty: 1 },
      ],
      CATALOGUE,
    );

    expect(result.valid).toBe(false);
    expect(result.lineItems).toEqual([]);
    expect(result.subtotal).toBe(0);
    expect(result.shipping).toBe(0);
    expect(result.total).toBe(0);
  });

  it("refuses an order against an empty catalogue", () => {
    expect(buildOrderFromCart([{ productId: NECKLACE.id, qty: 1 }], []).valid).toBe(
      false,
    );
  });
});

describe("parseOrderItems", () => {
  it("keeps only the product id and quantity", () => {
    expect(
      parseOrderItems([{ productId: "nk-001", qty: 2, price: 1, name: "spoofed" }]),
    ).toEqual([{ productId: "nk-001", qty: 2 }]);
  });

  it.each([
    ["not an array", { productId: "nk-001", qty: 1 }],
    ["null", null],
    ["a string", "nk-001"],
    ["an array of strings", ["nk-001"]],
    ["missing a product id", [{ qty: 1 }]],
    ["carrying an empty product id", [{ productId: "", qty: 1 }]],
    ["carrying a numeric product id", [{ productId: 7, qty: 1 }]],
  ])("rejects a payload that is %s", (_label, payload) => {
    expect(parseOrderItems(payload)).toBeNull();
  });

  it("passes a non-numeric quantity through as NaN so it is refused per product", () => {
    const items = parseOrderItems([{ productId: "nk-001", qty: "10" }]);

    expect(items).not.toBeNull();
    expect(Number.isNaN(items?.[0].qty)).toBe(true);
    expect(errorCodesFor(items ?? [])).toEqual(["INVALID_QUANTITY"]);
  });

  it("reads an empty array as an empty order rather than a malformed one", () => {
    expect(parseOrderItems([])).toEqual([]);
  });
});
