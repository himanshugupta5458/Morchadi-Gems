import { describe, expect, it } from "vitest";
import type { ProductOption } from "@/types/product";
import {
  PERSONALIZED_NOTE,
  defaultSelectedOptions,
  formatSelectedOptions,
  hasProductOptions,
  isSelectionStale,
  lineKey,
  parseSelectedOptions,
  resolveSelectedOptions,
  summarizeLineOptions,
} from "@/lib/options";

const LETTER: ProductOption = { name: "Letter", values: ["A", "B", "C"] };
const COLOUR: ProductOption = { name: "Colour", values: ["Silver", "Golden"] };
const RING_OPTIONS: ProductOption[] = [LETTER, COLOUR];

describe("lineKey", () => {
  it("is the product id alone when there are no choices", () => {
    expect(lineKey("P001")).toBe("P001");
    expect(lineKey("P001", {})).toBe("P001");
  });

  it("distinguishes two choices of one product", () => {
    expect(lineKey("P001", { Letter: "A" })).not.toBe(lineKey("P001", { Letter: "B" }));
  });

  it("is the same key however the record is ordered", () => {
    expect(lineKey("P001", { Letter: "A", Colour: "Silver" })).toBe(
      lineKey("P001", { Colour: "Silver", Letter: "A" }),
    );
  });

  it("distinguishes two products that share a choice", () => {
    expect(lineKey("P001", { Letter: "A" })).not.toBe(lineKey("P005", { Letter: "A" }));
  });

  it("cannot be forged by a value containing the separators", () => {
    expect(lineKey("P001", { Letter: "A|Colour=Golden" })).not.toBe(
      lineKey("P001", { Letter: "A", Colour: "Golden" }),
    );
  });
});

describe("defaultSelectedOptions", () => {
  it("takes the first value of every group", () => {
    expect(defaultSelectedOptions(RING_OPTIONS)).toEqual({
      Letter: "A",
      Colour: "Silver",
    });
  });

  it("is undefined for a product sold in one configuration", () => {
    expect(defaultSelectedOptions(undefined)).toBeUndefined();
    expect(defaultSelectedOptions([])).toBeUndefined();
  });
});

describe("resolveSelectedOptions", () => {
  it("keeps a requested value the catalogue still offers", () => {
    expect(resolveSelectedOptions(RING_OPTIONS, { Letter: "C", Colour: "Golden" })).toEqual({
      Letter: "C",
      Colour: "Golden",
    });
  });

  it("fills a group the request left out with its default", () => {
    expect(resolveSelectedOptions(RING_OPTIONS, { Letter: "B" })).toEqual({
      Letter: "B",
      Colour: "Silver",
    });
  });

  it("falls back to the default for a value that is not offered", () => {
    expect(resolveSelectedOptions([LETTER], { Letter: "Z" })).toEqual({ Letter: "A" });
  });

  it("drops a group the product does not have", () => {
    expect(resolveSelectedOptions([LETTER], { Letter: "B", Size: "Large" })).toEqual({
      Letter: "B",
    });
  });

  it("is undefined for a product with no options, whatever was requested", () => {
    expect(resolveSelectedOptions(undefined, { Letter: "A" })).toBeUndefined();
  });

  it("orders the record by the catalogue, not by the request", () => {
    const resolved = resolveSelectedOptions(RING_OPTIONS, {
      Colour: "Golden",
      Letter: "B",
    });

    expect(Object.keys(resolved ?? {})).toEqual(["Letter", "Colour"]);
  });
});

describe("isSelectionStale", () => {
  it("is false for a selection the catalogue still offers", () => {
    expect(isSelectionStale(RING_OPTIONS, { Letter: "A", Colour: "Golden" })).toBe(false);
  });

  it("is false when there is no selection at all", () => {
    expect(isSelectionStale(RING_OPTIONS, undefined)).toBe(false);
    expect(isSelectionStale(undefined, undefined)).toBe(false);
  });

  it("is false for an incomplete selection, which is a default waiting to be filled", () => {
    expect(isSelectionStale(RING_OPTIONS, { Letter: "A" })).toBe(false);
  });

  it("is true when the chosen value has been withdrawn", () => {
    expect(isSelectionStale([{ name: "Letter", values: ["B", "C"] }], { Letter: "A" })).toBe(
      true,
    );
  });

  it("is true when the whole group has been removed", () => {
    expect(isSelectionStale([COLOUR], { Letter: "A" })).toBe(true);
  });

  it("is true when the product no longer has options at all", () => {
    expect(isSelectionStale(undefined, { Letter: "A" })).toBe(true);
  });
});

describe("parseSelectedOptions", () => {
  it("reads a record of strings", () => {
    expect(parseSelectedOptions({ Letter: "A" })).toEqual({ Letter: "A" });
  });

  it("rejects anything that is not a plain record", () => {
    expect(parseSelectedOptions(undefined)).toBeUndefined();
    expect(parseSelectedOptions(null)).toBeUndefined();
    expect(parseSelectedOptions("Letter=A")).toBeUndefined();
    expect(parseSelectedOptions(["Letter", "A"])).toBeUndefined();
  });

  it("drops non-string and empty values rather than the whole selection", () => {
    expect(parseSelectedOptions({ Letter: "A", Colour: 7, Shape: "" })).toEqual({
      Letter: "A",
    });
  });

  it("is undefined when nothing readable survives", () => {
    expect(parseSelectedOptions({})).toBeUndefined();
    expect(parseSelectedOptions({ Letter: null })).toBeUndefined();
  });
});

describe("formatSelectedOptions", () => {
  it("reads as a sentence a shopper can check", () => {
    expect(formatSelectedOptions({ Letter: "A", Colour: "Silver" })).toBe(
      "Letter: A · Colour: Silver",
    );
  });

  it("is empty for a product sold in one configuration", () => {
    expect(formatSelectedOptions(undefined)).toBe("");
  });
});

describe("summarizeLineOptions", () => {
  it("is compact enough for order metadata", () => {
    expect(summarizeLineOptions("P001", { Letter: "A" })).toBe("P001:Letter=A");
  });

  it("sorts its pairs, so one selection has one summary", () => {
    expect(summarizeLineOptions("P001", { Letter: "A", Colour: "Golden" })).toBe(
      summarizeLineOptions("P001", { Colour: "Golden", Letter: "A" }),
    );
  });

  it("is empty when there is nothing to record", () => {
    expect(summarizeLineOptions("P002", undefined)).toBe("");
  });
});

describe("hasProductOptions", () => {
  it("separates the four personalized products from the ninety-six that are not", () => {
    expect(hasProductOptions(RING_OPTIONS)).toBe(true);
    expect(hasProductOptions([])).toBe(false);
    expect(hasProductOptions(undefined)).toBe(false);
  });
});

describe("the personalized note", () => {
  it("says both things it has to say", () => {
    expect(PERSONALIZED_NOTE).toContain("Personalized");
    expect(PERSONALIZED_NOTE).toContain("non-returnable");
  });
});
