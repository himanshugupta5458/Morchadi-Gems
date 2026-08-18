import { describe, expect, it } from "vitest";
import type { CreateOrderItem } from "@/types/order";
import { mergeOrderItemsByProduct, buildOrderFromCart, parseOrderItems } from "@/lib/order";
import {
  ORDER_TAG_VALUE_LIMIT,
  toOrderOptionTags,
  validateOrderLineOptions,
  type OrderOptionEntry,
} from "@/lib/order-options";
import { MAX_QUANTITY } from "@/lib/quantity";

const INITIAL_RING: OrderOptionEntry = {
  id: "P001",
  name: "Wave Band Initial Ring",
  options: [
    { name: "Letter", type: "dropdown", values: ["A", "B", "C"], default: "A" },
  ],
};

const WATCH_RING: OrderOptionEntry = {
  id: "P010",
  name: "Mini Watch Ring",
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
  ],
};

const PLAIN_NECKLACE: OrderOptionEntry = { id: "nk-001", name: "Kundan Rani Haar" };

const CATALOGUE: OrderOptionEntry[] = [INITIAL_RING, WATCH_RING, PLAIN_NECKLACE];

const PRICING_CATALOGUE = [
  { id: "P001", name: "Wave Band Initial Ring", price: 400, inStock: true },
  { id: "nk-001", name: "Kundan Rani Haar", price: 1000, inStock: true },
];

describe("mergeOrderItemsByProduct", () => {
  it("collapses two selections of one product into one priced line", () => {
    const merged = mergeOrderItemsByProduct([
      { productId: "P001", qty: 1, selectedOptions: { Letter: "A" } },
      { productId: "P001", qty: 2, selectedOptions: { Letter: "B" } },
    ]);

    expect(merged).toEqual([{ productId: "P001", qty: 3 }]);
  });

  it("leaves a cart of distinct products alone", () => {
    const items: CreateOrderItem[] = [
      { productId: "P001", qty: 1 },
      { productId: "nk-001", qty: 2 },
    ];

    expect(mergeOrderItemsByProduct(items)).toEqual(items);
  });

  it("carries no option data into the pricing core", () => {
    const [merged] = mergeOrderItemsByProduct([
      { productId: "P001", qty: 1, selectedOptions: { Letter: "A" } },
    ]);

    expect(merged).not.toHaveProperty("selectedOptions");
  });

  it("lets the merged order price like one line of the summed quantity", () => {
    const twoLines = buildOrderFromCart(
      mergeOrderItemsByProduct([
        { productId: "P001", qty: 1, selectedOptions: { Letter: "A" } },
        { productId: "P001", qty: 2, selectedOptions: { Letter: "B" } },
      ]),
      PRICING_CATALOGUE,
    );
    const oneLine = buildOrderFromCart([{ productId: "P001", qty: 3 }], PRICING_CATALOGUE);

    expect(twoLines.total).toBe(oneLine.total);
    expect(twoLines.subtotal).toBe(400 * 3);
  });

  it("still refuses a summed quantity above the per-product cap", () => {
    const order = buildOrderFromCart(
      mergeOrderItemsByProduct([
        { productId: "P001", qty: MAX_QUANTITY, selectedOptions: { Letter: "A" } },
        { productId: "P001", qty: 1, selectedOptions: { Letter: "B" } },
      ]),
      PRICING_CATALOGUE,
    );

    expect(order.valid).toBe(false);
    expect(order.errors.map((error) => error.code)).toEqual(["INVALID_QUANTITY"]);
  });
});

describe("validateOrderLineOptions", () => {
  it("summarizes one line's recorded choice", () => {
    const result = validateOrderLineOptions(
      [{ productId: "P001", qty: 1, selectedOptions: { Letter: "B" } }],
      CATALOGUE,
    );

    expect(result.errors).toEqual([]);
    expect(result.summary).toBe("P001:Letter=B");
  });

  it("summarizes every optioned line, in cart order", () => {
    const result = validateOrderLineOptions(
      [
        { productId: "P001", qty: 1, selectedOptions: { Letter: "A" } },
        { productId: "nk-001", qty: 1 },
        { productId: "P010", qty: 1, selectedOptions: { Colour: "Golden" } },
      ],
      CATALOGUE,
    );

    expect(result.summary).toBe("P001:Letter=A; P010:Colour=Golden");
  });

  it("records the default for an optioned line that sent no selection", () => {
    const result = validateOrderLineOptions([{ productId: "P001", qty: 1 }], CATALOGUE);

    expect(result.summary).toBe("P001:Letter=A");
  });

  it("has nothing to say about an order of products without options", () => {
    const result = validateOrderLineOptions([{ productId: "nk-001", qty: 2 }], CATALOGUE);

    expect(result).toEqual({ errors: [], summary: "" });
  });

  it("refuses a value the catalogue no longer offers rather than substituting one", () => {
    const result = validateOrderLineOptions(
      [{ productId: "P001", qty: 1, selectedOptions: { Letter: "X" } }],
      CATALOGUE,
    );

    expect(result.errors).toEqual([
      {
        productId: "P001",
        code: "INVALID_OPTION",
        message: "The option you chose for Wave Band Initial Ring is no longer available.",
      },
    ]);
    expect(result.summary).toBe("");
  });

  it("refuses a selection naming a group the product does not have", () => {
    const result = validateOrderLineOptions(
      [{ productId: "nk-001", qty: 1, selectedOptions: { Letter: "A" } }],
      CATALOGUE,
    );

    expect(result.errors.map((error) => error.code)).toEqual(["INVALID_OPTION"]);
  });

  it("leaves an unknown product to the pricing core, so it is reported once", () => {
    const result = validateOrderLineOptions(
      [{ productId: "gone-001", qty: 1, selectedOptions: { Letter: "A" } }],
      CATALOGUE,
    );

    expect(result.errors).toEqual([]);
  });

  it("reports every bad line, not just the first", () => {
    const result = validateOrderLineOptions(
      [
        { productId: "P001", qty: 1, selectedOptions: { Letter: "X" } },
        { productId: "P010", qty: 1, selectedOptions: { Colour: "Bronze" } },
      ],
      CATALOGUE,
    );

    expect(result.errors.map((error) => error.productId)).toEqual(["P001", "P010"]);
  });

  it("keeps two selections of one product as two entries in the summary", () => {
    const result = validateOrderLineOptions(
      [
        { productId: "P001", qty: 1, selectedOptions: { Letter: "A" } },
        { productId: "P001", qty: 2, selectedOptions: { Letter: "C" } },
      ],
      CATALOGUE,
    );

    expect(result.summary).toBe("P001:Letter=A; P001:Letter=C");
  });

  it("reads a selection out of an untrusted request body and validates it", () => {
    const items = parseOrderItems([
      { productId: "P001", qty: 1, price: 1, selectedOptions: { Letter: "B" } },
    ]);

    expect(validateOrderLineOptions(items ?? [], CATALOGUE).summary).toBe("P001:Letter=B");
  });
});

describe("toOrderOptionTags", () => {
  it("sends nothing when there is nothing to record", () => {
    expect(toOrderOptionTags("")).toEqual({});
  });

  it("puts a short summary in one tag", () => {
    expect(toOrderOptionTags("P001:Letter=A; P010:Colour=Golden")).toEqual({
      options: "P001:Letter=A; P010:Colour=Golden",
    });
  });

  it("splits a long summary across tags instead of truncating it", () => {
    const manyLines = Array.from(
      { length: 25 },
      (_unused, index) => `P0${index}:Letter=A`,
    ).join("; ");

    const tags = toOrderOptionTags(manyLines);

    expect(Object.keys(tags)).toEqual(["options", "options_2"]);
    expect(Object.values(tags).join("; ")).toBe(manyLines);
  });

  it("keeps every tag value inside the gateway's limit", () => {
    const manyLines = Array.from(
      { length: 200 },
      (_unused, index) => `P${index}:Letter=A`,
    ).join("; ");

    for (const value of Object.values(toOrderOptionTags(manyLines))) {
      expect(value.length).toBeLessThanOrEqual(ORDER_TAG_VALUE_LIMIT);
    }
  });

  it("says how many lines it had to leave out rather than trailing off", () => {
    const manyLines = Array.from(
      { length: 200 },
      (_unused, index) => `P${index}:Letter=A`,
    ).join("; ");

    const tags = toOrderOptionTags(manyLines);

    expect(Object.keys(tags)).toHaveLength(3);
    expect(tags.options_3).toMatch(/\+\d+ more$/);
  });
});
