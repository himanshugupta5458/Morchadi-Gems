import { describe, expect, it } from "vitest";

import {
  checkQuotedPhraseContainment,
  formatFinding,
  normaliseWhitespace,
  validateBatch,
  validateDraftA,
  validatePublishReadiness,
} from "@/scripts/validate-draft-a.mjs";

/**
 * Every fixture in this file is synthetic. No real Draft A object exists yet — the extraction
 * skill has never been run for real, because ADR-051 leaves it blocked on owner work — so a
 * fixture drawn from "real data" would be a fixture drawn from nothing. These are hand-written
 * to the schema in `.claude/skills/draft-a-skills.md` instead.
 *
 * Note what is NOT tested anywhere below: that a material or stone phrase is a permitted one.
 * There is no allow-list in this design and the validator never checks membership against any
 * vocabulary, so `"unobtanium plated moonstone"` is a perfectly valid candidate value here.
 * What is tested is that it arrives with a source quote, and that the quote is real.
 */

type Finding = { rule: string; field: string; value: string; message: string };
type Result = {
  productId: string | null;
  label: string;
  errors: Finding[];
  warnings: Finding[];
};

const RAW_CONTENT =
  "Elegant gold-plated brass ring set with American Diamond stones. Free size.\n" +
  "Dispatch within 2 days. Free returns within 7 days. ★★★★☆ (12 reviews)";

function cleanDraft(): Record<string, unknown> {
  return {
    productId: "P050",
    sourceType: "migrated",
    category: "rings",
    subcategory: null,
    variants: [{ optionName: "Colour", values: ["Golden", "Silver"] }],
    attributes: [
      {
        label: "Material",
        value: "gold-plated brass",
        displayTerm: null,
        stoneSource: null,
        source: { origin: "migrated-text", quotedPhrase: "gold-plated brass" },
        confirmed: false,
      },
      {
        label: "Stone",
        value: "cubic zirconia",
        displayTerm: "American Diamond",
        stoneSource: "known-trade-term",
        source: { origin: "migrated-text", quotedPhrase: "American Diamond stones" },
        confirmed: false,
      },
    ],
    images: { general: [], variantImages: {} },
    pricing: { price: null, mrp: null, cost: null, referencePrice: "₹499 (old site)" },
    personalized: false,
    suggestedCollections: ["gifting"],
    sourceNotes: { rawContent: RAW_CONTENT, referenceTitle: "Gold Ring" },
    flaggedContent: [
      {
        type: "boilerplate-discarded",
        detail: "Removed shipping/return-policy paragraph",
        sourceContext: "Dispatch within 2 days. Free returns within 7 days.",
      },
    ],
    notes: [],
    status: "draft",
    generatedBy: null,
  };
}

function reviewedDraft(): Record<string, unknown> {
  const draft = cleanDraft();
  for (const attribute of draft.attributes as Record<string, unknown>[]) {
    attribute.confirmed = true;
  }
  draft.images = { general: ["/products/P050.webp"], variantImages: {} };
  draft.pricing = { price: 499, mrp: 999, cost: 180, referencePrice: "₹499 (old site)" };
  draft.personalized = false;
  return draft;
}

function withAttribute(overrides: Record<string, unknown>): Record<string, unknown> {
  const draft = cleanDraft();
  draft.attributes = [
    {
      label: "Material",
      value: "gold-plated brass",
      displayTerm: null,
      stoneSource: null,
      source: { origin: "migrated-text", quotedPhrase: "gold-plated brass" },
      confirmed: false,
      ...overrides,
    },
  ];
  return draft;
}

function rulesIn(result: Result): string[] {
  return result.errors.map((error) => error.rule);
}

function warningRulesIn(result: Result): string[] {
  return result.warnings.map((warning) => warning.rule);
}

describe("the clean baseline fixture", () => {
  it("passes with no errors and no warnings", () => {
    const result: Result = validateDraftA(cleanDraft());

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.productId).toBe("P050");
  });

  it("does not object to a material phrase no allow-list would contain", () => {
    const draft = withAttribute({
      value: "18K gold-plated stainless steel over unobtanium",
      source: { origin: "migrated-text", quotedPhrase: "gold-plated brass" },
    });

    expect(validateDraftA(draft).errors).toEqual([]);
  });
});

describe("A1 — category is null or one of the ten fixed values", () => {
  it("accepts null", () => {
    const draft = cleanDraft();
    draft.category = null;

    expect(rulesIn(validateDraftA(draft))).not.toContain("A1");
  });

  it.each([
    "rings",
    "earrings",
    "nose-pins",
    "bracelets",
    "bangles",
    "anklets",
    "hair-accessories",
    "necklaces",
    "watches",
    "pendants",
  ])("accepts the fixed value %s", (category) => {
    const draft = cleanDraft();
    draft.category = category;

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("rejects a near-miss singular", () => {
    const draft = cleanDraft();
    draft.category = "ring";
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toContain("A1");
    expect(result.errors[0].field).toBe("category");
    expect(result.errors[0].value).toBe('"ring"');
  });

  it("rejects an invented category", () => {
    const draft = cleanDraft();
    draft.category = "brooches";

    expect(rulesIn(validateDraftA(draft))).toContain("A1");
  });

  it("rejects an absent category, since undefined is not null", () => {
    const draft = cleanDraft();
    delete draft.category;

    expect(rulesIn(validateDraftA(draft))).toContain("A1");
  });
});

describe("A2 — pricing.price and pricing.mrp are always null", () => {
  it("accepts both null with a quarantined referencePrice", () => {
    expect(rulesIn(validateDraftA(cleanDraft()))).not.toContain("A2");
  });

  it("rejects a populated price", () => {
    const draft = cleanDraft();
    draft.pricing = { price: 499, mrp: null, cost: null, referencePrice: null };
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toContain("A2");
    expect(result.errors[0].field).toBe("pricing.price");
    expect(result.errors[0].value).toBe("499");
  });

  it("rejects a populated mrp", () => {
    const draft = cleanDraft();
    draft.pricing = { price: null, mrp: 999, cost: null, referencePrice: null };

    expect(validateDraftA(draft).errors[0].field).toBe("pricing.mrp");
  });

  it("rejects a price of zero, because zero is a decision and null is the absence of one", () => {
    const draft = cleanDraft();
    draft.pricing = { price: 0, mrp: null, cost: null, referencePrice: null };

    expect(rulesIn(validateDraftA(draft))).toContain("A2");
  });

  it("reports both fields when both are populated", () => {
    const draft = cleanDraft();
    draft.pricing = { price: 499, mrp: 999, cost: null, referencePrice: null };

    expect(rulesIn(validateDraftA(draft))).toEqual(["A2", "A2"]);
  });
});

describe("A3 — images stay empty at Draft A", () => {
  it("accepts an empty array and an empty object", () => {
    expect(rulesIn(validateDraftA(cleanDraft()))).not.toContain("A3");
  });

  it("rejects a populated images.general", () => {
    const draft = cleanDraft();
    draft.images = { general: ["/products/P050.webp"], variantImages: {} };
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toContain("A3");
    expect(result.errors[0].field).toBe("images.general");
  });

  it("rejects a populated images.variantImages", () => {
    const draft = cleanDraft();
    draft.images = { general: [], variantImages: { Golden: ["/products/P050-golden.webp"] } };

    expect(validateDraftA(draft).errors[0].field).toBe("images.variantImages");
  });

  it("rejects images.general given as an object rather than an array", () => {
    const draft = cleanDraft();
    draft.images = { general: {}, variantImages: {} };

    expect(rulesIn(validateDraftA(draft))).toContain("A3");
  });
});

describe("A4 — personalized is exactly true, false or null", () => {
  it.each([true, false, null])("accepts %s", (personalized) => {
    const draft = cleanDraft();
    draft.personalized = personalized;

    expect(rulesIn(validateDraftA(draft))).not.toContain("A4");
  });

  it("rejects the string 'true'", () => {
    const draft = cleanDraft();
    draft.personalized = "true";
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toContain("A4");
    expect(result.errors[0].value).toBe('"true"');
  });

  it("rejects an absent field", () => {
    const draft = cleanDraft();
    delete draft.personalized;

    expect(rulesIn(validateDraftA(draft))).toContain("A4");
  });

  it("rejects 'unknown'", () => {
    const draft = cleanDraft();
    draft.personalized = "unknown";

    expect(rulesIn(validateDraftA(draft))).toContain("A4");
  });
});

describe("A5 — flaggedContent types come from the fixed enum", () => {
  it.each(["boilerplate-discarded", "review-markup-discarded", "brand-mismatch"])(
    "accepts %s",
    (type) => {
      const draft = cleanDraft();
      draft.flaggedContent = [{ type, detail: "d", sourceContext: null }];

      expect(validateDraftA(draft).errors).toEqual([]);
    },
  );

  it("accepts an empty flaggedContent array", () => {
    const draft = cleanDraft();
    draft.flaggedContent = [];

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("rejects an invented type and names the index", () => {
    const draft = cleanDraft();
    draft.flaggedContent = [
      { type: "boilerplate-discarded", detail: "d", sourceContext: null },
      { type: "price-discarded", detail: "d", sourceContext: null },
    ];
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toEqual(["A5"]);
    expect(result.errors[0].field).toBe("flaggedContent[1].type");
    expect(result.errors[0].value).toBe('"price-discarded"');
  });

  it("rejects an entry with no type at all", () => {
    const draft = cleanDraft();
    draft.flaggedContent = [{ detail: "d", sourceContext: null }];

    expect(rulesIn(validateDraftA(draft))).toContain("A5");
  });
});

describe("B1 — confirmed is present and false before review", () => {
  it("accepts confirmed: false", () => {
    expect(rulesIn(validateDraftA(cleanDraft()))).not.toContain("B1");
  });

  it("rejects confirmed: true, which claims a review that has not happened", () => {
    const draft = withAttribute({ confirmed: true });
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toContain("B1");
    expect(result.errors[0].field).toBe("attributes[0].confirmed");
    expect(result.errors[0].value).toBe("true");
  });

  it("rejects a missing confirmed field", () => {
    const attribute = {
      label: "Material",
      value: "gold-plated brass",
      displayTerm: null,
      stoneSource: null,
      source: { origin: "migrated-text", quotedPhrase: "gold-plated brass" },
    };
    const draft = cleanDraft();
    draft.attributes = [attribute];
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toContain("B1");
    expect(result.errors[0].value).toBe("undefined (field absent)");
  });

  it("rejects the string 'false'", () => {
    expect(rulesIn(validateDraftA(withAttribute({ confirmed: "false" })))).toContain("B1");
  });

  it("accepts an empty attributes array", () => {
    const draft = cleanDraft();
    draft.attributes = [];

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("rejects an absent attributes array", () => {
    const draft = cleanDraft();
    delete draft.attributes;

    expect(rulesIn(validateDraftA(draft))).toContain("S1");
  });
});

describe("B2 — origin and quotedPhrase travel together or not at all", () => {
  it("accepts source: null, since a stray real fact need not be quoted", () => {
    const draft = withAttribute({ label: "Weight", value: "12 g", source: null });

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it.each(["migrated-text", "owner-notes"])("accepts the origin %s", (origin) => {
    const draft = withAttribute({
      source: { origin, quotedPhrase: "gold-plated brass" },
    });

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("rejects an origin with no quotedPhrase", () => {
    const draft = withAttribute({ source: { origin: "migrated-text" } });
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toEqual(["B2"]);
    expect(result.errors[0].field).toBe("attributes[0].source.quotedPhrase");
  });

  it("rejects a quotedPhrase with no origin", () => {
    const draft = withAttribute({ source: { quotedPhrase: "gold-plated brass" } });
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toEqual(["B2"]);
    expect(result.errors[0].field).toBe("attributes[0].source.origin");
  });

  it("rejects an origin outside the fixed pair", () => {
    const draft = withAttribute({
      source: { origin: "image-description", quotedPhrase: "gold-plated brass" },
    });
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toEqual(["B2"]);
    expect(result.errors[0].value).toBe('"image-description"');
  });

  it("rejects an empty-string quotedPhrase", () => {
    const draft = withAttribute({
      source: { origin: "migrated-text", quotedPhrase: "   " },
    });

    expect(rulesIn(validateDraftA(draft))).toEqual(["B2"]);
  });
});

describe("B3 — the quotedPhrase-containment check", () => {
  it("passes on an exact match", () => {
    const draft = withAttribute({
      source: { origin: "migrated-text", quotedPhrase: "gold-plated brass ring" },
    });

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("fails on a paraphrase that never appears in rawContent", () => {
    const draft = withAttribute({
      value: "gold-plated brass",
      source: { origin: "migrated-text", quotedPhrase: "brass with a gold plating" },
    });
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toEqual(["B3"]);
    expect(result.errors[0].field).toBe("attributes[0].source.quotedPhrase");
    expect(result.errors[0].value).toBe('"brass with a gold plating"');
    expect(result.errors[0].message).toContain("verbatim");
  });

  it("fails on a wholly invented quote", () => {
    const draft = withAttribute({
      source: { origin: "migrated-text", quotedPhrase: "925 sterling silver, hallmarked" },
    });

    expect(rulesIn(validateDraftA(draft))).toEqual(["B3"]);
  });

  it("passes when the quote differs only by collapsed whitespace", () => {
    const draft = withAttribute({
      source: {
        origin: "migrated-text",
        quotedPhrase: "gold-plated    brass\n\tring",
      },
    });

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("passes when rawContent carries the newline and the quote does not", () => {
    const draft = cleanDraft();
    draft.sourceNotes = {
      rawContent: "Set with American\nDiamond stones",
      referenceTitle: null,
    };
    draft.attributes = [
      {
        label: "Stone",
        value: "cubic zirconia",
        displayTerm: "American Diamond",
        stoneSource: "known-trade-term",
        source: { origin: "migrated-text", quotedPhrase: "American Diamond stones" },
        confirmed: false,
      },
    ];

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("passes when the quote is a substring of a larger sentence", () => {
    const draft = withAttribute({
      source: { origin: "migrated-text", quotedPhrase: "American Diamond" },
    });

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("does not check containment when rawContent is null, since pipeline code populates it", () => {
    const draft = withAttribute({
      source: { origin: "migrated-text", quotedPhrase: "a phrase from nowhere at all" },
    });
    draft.sourceNotes = { rawContent: null, referenceTitle: "Gold Ring" };

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("is case-sensitive, because verbatim means verbatim", () => {
    const draft = withAttribute({
      source: { origin: "migrated-text", quotedPhrase: "Gold-Plated Brass" },
    });

    expect(rulesIn(validateDraftA(draft))).toEqual(["B3"]);
  });

  describe("checkQuotedPhraseContainment directly", () => {
    it("reports checked and contained on an exact match", () => {
      expect(checkQuotedPhraseContainment("gold-plated brass", RAW_CONTENT)).toEqual({
        checked: true,
        contained: true,
      });
    });

    it("reports checked and not contained on a paraphrase", () => {
      expect(checkQuotedPhraseContainment("brass, gold plated", RAW_CONTENT)).toEqual({
        checked: true,
        contained: false,
      });
    });

    it("reports unchecked when rawContent is null", () => {
      expect(checkQuotedPhraseContainment("gold-plated brass", null)).toEqual({
        checked: false,
        contained: false,
      });
    });

    it("normalises whitespace on both sides", () => {
      expect(
        checkQuotedPhraseContainment("gold-plated\n brass", "Elegant   gold-plated brass ring"),
      ).toEqual({ checked: true, contained: true });
    });
  });

  describe("normaliseWhitespace", () => {
    it("collapses runs of spaces, newlines and tabs and trims the ends", () => {
      expect(normaliseWhitespace("  gold-plated \n\n\t brass  ")).toBe("gold-plated brass");
    });

    it("leaves an already-normal string alone", () => {
      expect(normaliseWhitespace("gold-plated brass")).toBe("gold-plated brass");
    });
  });
});

describe("B4 — a known-trade-term match without a displayTerm is a warning", () => {
  it("stays silent when displayTerm is present", () => {
    expect(validateDraftA(cleanDraft()).warnings).toEqual([]);
  });

  it("warns, without failing, when displayTerm is null", () => {
    const draft = cleanDraft();
    draft.attributes = [
      {
        label: "Stone",
        value: "cubic zirconia",
        displayTerm: null,
        stoneSource: "known-trade-term",
        source: { origin: "migrated-text", quotedPhrase: "American Diamond stones" },
        confirmed: false,
      },
    ];
    const result: Result = validateDraftA(draft);

    expect(result.errors).toEqual([]);
    expect(warningRulesIn(result)).toEqual(["B4"]);
    expect(result.warnings[0].field).toBe("attributes[0].displayTerm");
    expect(result.warnings[0].message).toContain("stone-terms.json");
  });

  it("warns when displayTerm is an empty string", () => {
    const draft = withAttribute({
      label: "Stone",
      stoneSource: "known-trade-term",
      displayTerm: "",
    });

    expect(warningRulesIn(validateDraftA(draft))).toEqual(["B4"]);
  });

  it("stays silent for an unverified-guess with no displayTerm", () => {
    const draft = withAttribute({
      label: "Stone",
      stoneSource: "unverified-guess",
      displayTerm: null,
    });

    expect(validateDraftA(draft).warnings).toEqual([]);
  });

  it("stays silent for a non-stone attribute", () => {
    const draft = withAttribute({ label: "Weight", stoneSource: null, displayTerm: null });

    expect(validateDraftA(draft).warnings).toEqual([]);
  });
});

describe("shape failures degrade rather than throw", () => {
  it.each([null, "a string", 42, ["an", "array"]])("reports %s as a root failure", (draft) => {
    const result: Result = validateDraftA(draft);

    expect(rulesIn(result)).toEqual(["S1"]);
    expect(result.productId).toBeNull();
  });

  it("reports a non-object attributes entry", () => {
    const draft = cleanDraft();
    draft.attributes = ["gold-plated brass"];

    expect(rulesIn(validateDraftA(draft))).toEqual(["S1"]);
  });

  it("reports a non-object pricing block", () => {
    const draft = cleanDraft();
    draft.pricing = null;

    expect(rulesIn(validateDraftA(draft))).toContain("A2");
  });

  it("reports a non-array flaggedContent", () => {
    const draft = cleanDraft();
    draft.flaggedContent = "none";

    expect(rulesIn(validateDraftA(draft))).toContain("A5");
  });

  it("survives a missing sourceNotes block", () => {
    const draft = cleanDraft();
    delete draft.sourceNotes;

    expect(validateDraftA(draft).errors).toEqual([]);
  });

  it("keeps the label it was given so a finding is traceable to its file", () => {
    const result: Result = validateDraftA(cleanDraft(), { label: "drafts/batch.json#3" });

    expect(result.label).toBe("drafts/batch.json#3");
  });
});

describe("Part D — validatePublishReadiness, the publish gate", () => {
  it("passes a fully reviewed object", () => {
    const result: Result = validatePublishReadiness(reviewedDraft());

    expect(result.errors).toEqual([]);
  });

  it("D1 rejects an attribute still awaiting confirmation", () => {
    const draft = reviewedDraft();
    (draft.attributes as Record<string, unknown>[])[1].confirmed = false;
    const result: Result = validatePublishReadiness(draft);

    expect(rulesIn(result)).toEqual(["D1"]);
    expect(result.errors[0].field).toBe("attributes[1].confirmed");
  });

  it("D2 rejects a null category", () => {
    const draft = reviewedDraft();
    draft.category = null;

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D2"]);
  });

  it("D2 rejects a category outside the fixed list", () => {
    const draft = reviewedDraft();
    draft.category = "brooches";

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D2"]);
  });

  it("D3 rejects a null personalized", () => {
    const draft = reviewedDraft();
    draft.personalized = null;

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D3"]);
  });

  it.each([true, false])("D3 accepts personalized: %s", (personalized) => {
    const draft = reviewedDraft();
    draft.personalized = personalized;

    expect(validatePublishReadiness(draft).errors).toEqual([]);
  });

  it("D4 rejects an empty images.general", () => {
    const draft = reviewedDraft();
    draft.images = { general: [], variantImages: {} };

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D4"]);
  });

  it("D5 rejects a null price", () => {
    const draft = reviewedDraft();
    draft.pricing = { price: null, mrp: 999, cost: 180, referencePrice: null };

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D5"]);
  });

  it.each([0, -1])("D5 rejects a non-positive price of %s", (price) => {
    const draft = reviewedDraft();
    draft.pricing = { price, mrp: 999, cost: 180, referencePrice: null };

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D5"]);
  });

  it("D5 rejects a price given as a string", () => {
    const draft = reviewedDraft();
    draft.pricing = { price: "499", mrp: 999, cost: 180, referencePrice: null };

    expect(rulesIn(validatePublishReadiness(draft))).toEqual(["D5"]);
  });

  it("reports every unmet requirement at once", () => {
    const draft = cleanDraft();

    expect(rulesIn(validatePublishReadiness(draft)).sort()).toEqual([
      "D1",
      "D1",
      "D4",
      "D5",
    ]);
  });

  it("degrades rather than throwing on a non-object", () => {
    expect(rulesIn(validatePublishReadiness(null))).toEqual(["S1"]);
  });
});

describe("the two checks are inverses on the fields review changes", () => {
  it("a freshly extracted draft fails publish readiness", () => {
    const draft = cleanDraft();

    expect(validateDraftA(draft).errors).toEqual([]);
    expect(validatePublishReadiness(draft).errors.length).toBeGreaterThan(0);
  });

  it("a reviewed draft fails the extraction-output check", () => {
    const draft = reviewedDraft();

    expect(validatePublishReadiness(draft).errors).toEqual([]);
    expect(rulesIn(validateDraftA(draft)).sort()).toEqual(["A2", "A2", "A3", "B1", "B1"]);
  });
});

describe("Part C — batch reporting", () => {
  it("counts checked, clean, failed and warned objects separately", () => {
    const failing = cleanDraft();
    failing.category = "ring";

    const warning = cleanDraft();
    (warning.attributes as Record<string, unknown>[])[1].displayTerm = null;

    const both = cleanDraft();
    both.personalized = "maybe";
    (both.attributes as Record<string, unknown>[])[1].displayTerm = null;

    const summary = validateBatch([
      { value: cleanDraft(), label: "a.json" },
      { value: failing, label: "b.json" },
      { value: warning, label: "c.json" },
      { value: both, label: "d.json" },
    ]);

    expect(summary.checked).toBe(4);
    expect(summary.passedClean).toBe(1);
    expect(summary.failed).toBe(2);
    expect(summary.withWarnings).toBe(2);
  });

  it("carries each object's label through to its result", () => {
    const summary = validateBatch([
      { value: cleanDraft(), label: "batch.json#0" },
      { value: cleanDraft(), label: "batch.json#1" },
    ]);

    expect(summary.results.map((result: Result) => result.label)).toEqual([
      "batch.json#0",
      "batch.json#1",
    ]);
  });

  it("counts an empty batch as nothing rather than as a pass", () => {
    expect(validateBatch([])).toMatchObject({ checked: 0, passedClean: 0, failed: 0 });
  });

  it("prints a finding with its rule, field, value, message and productId", () => {
    const draft = cleanDraft();
    draft.category = "ring";
    const result: Result = validateDraftA(draft, { label: "b.json" });
    const printed: string = formatFinding(result.errors[0], "error", result.productId);

    expect(printed).toContain("A1");
    expect(printed).toContain("category");
    expect(printed).toContain('"ring"');
    expect(printed).toContain("productId: P050");
  });

  it("marks a warning as a warning", () => {
    const draft = withAttribute({ stoneSource: "known-trade-term", displayTerm: null });
    const result: Result = validateDraftA(draft);

    expect(formatFinding(result.warnings[0], "warning", result.productId)).toContain("warning");
  });

  it("names the object even when it has no productId", () => {
    const draft = cleanDraft();
    delete draft.productId;
    const result: Result = validateDraftA(draft, { label: "b.json" });
    draft.category = "ring";

    expect(result.productId).toBeNull();
    expect(formatFinding(validateDraftA(draft).errors[0], "error", null)).toContain(
      "productId: (none)",
    );
  });
});
