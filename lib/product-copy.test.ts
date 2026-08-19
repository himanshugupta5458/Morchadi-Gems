import { describe, expect, it } from "vitest";
import { getAllProducts, getDescriptionParagraphs } from "@/lib/products";

const catalogue = getAllProducts();

/**
 * The four pieces whose approved copy has not been written yet. They still carry the
 * pre-content-pass one-liner, and nothing was invented to fill the gap. Listed in
 * docs/CATALOGUE-DATA-TODO.md and in ADR-035; this set shrinks as the owner's copy lands.
 */
const AWAITING_APPROVED_COPY = new Set(["P001", "P022", "P032", "P042"]);

const MIN_APPROVED_WORDS = 150;
const MAX_APPROVED_WORDS = 300;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function approvedProducts(): typeof catalogue {
  return catalogue.filter((product) => !AWAITING_APPROVED_COPY.has(product.id));
}

describe("the approved product descriptions", () => {
  it("covers forty-five of the forty-nine pieces, with four still awaiting owner copy", () => {
    expect(approvedProducts()).toHaveLength(catalogue.length - AWAITING_APPROVED_COPY.size);
  });

  it("runs to long-form prose in the house word range", () => {
    for (const product of approvedProducts()) {
      const words = wordCount(product.description);
      expect(words, product.id).toBeGreaterThanOrEqual(MIN_APPROVED_WORDS);
      expect(words, product.id).toBeLessThanOrEqual(MAX_APPROVED_WORDS);
    }
  });

  it("stores several paragraphs, separated by a blank line", () => {
    for (const product of approvedProducts()) {
      expect(getDescriptionParagraphs(product.description).length, product.id).toBeGreaterThan(
        1,
      );
    }
  });

  it("carries none of the copy pass's own review metadata", () => {
    for (const product of catalogue) {
      expect(product.description, product.id).not.toContain("[Merchandiser note:");
      expect(product.description, product.id).not.toContain("*Hook:");
      expect(product.description, product.id).not.toContain("###");
    }
  });
});

describe("the catalogue's material honesty", () => {
  function shopperFacingStrings(product: (typeof catalogue)[number]): string[] {
    return [
      product.name,
      product.description,
      ...Object.values(product.specs),
      ...(product.options ?? []).flatMap((option) => [option.name, ...option.values]),
      product.seo.metaTitle,
      product.seo.metaDescription,
      product.seo.imageAlt,
      ...(product.seo.additionalImageAlts ?? []),
      product.seo.ogTitle,
      product.seo.ogDescription,
    ];
  }

  it("claims no karat, no hallmark and no sterling silver anywhere a shopper reads", () => {
    const claim = /\b(?:9|10|14|18|22|24)\s?[Kk]\b|\b916\b|hallmark|sterling silver/i;
    for (const product of catalogue) {
      for (const text of shopperFacingStrings(product)) {
        expect(text, `${product.id}: ${text}`).not.toMatch(claim);
      }
    }
  });

  it("never calls a cubic zirconia piece crystal in its name", () => {
    for (const product of catalogue) {
      if (!/cubic zirconia/i.test(product.specs.stone ?? "")) continue;
      expect(product.name, product.id).not.toMatch(/crystal/i);
    }
  });

  it("qualifies every rhodium or silver-plated piece rather than calling it silver", () => {
    for (const product of catalogue) {
      if (!/^silver\b/i.test(product.name)) continue;
      expect(product.name, product.id).toMatch(/^Silver-(?:Tone|Plated)\b/);
    }
  });
});

describe("splitting a description into paragraphs", () => {
  it("drops the blank lines and trims what is left", () => {
    expect(getDescriptionParagraphs("First.\n\n\nSecond.\n\n")).toEqual(["First.", "Second."]);
  });

  it("returns a single paragraph unchanged", () => {
    expect(getDescriptionParagraphs("Just the one.")).toEqual(["Just the one."]);
  });
});
