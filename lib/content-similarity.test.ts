import { describe, expect, it } from "vitest";
import {
  OPENING_SHINGLE_SIZE,
  OPENING_WORD_LIMIT,
  SHINGLE_SIZE,
  buildNormalisationVocabulary,
  buildShingles,
  extractOpeningSentence,
  jaccardSimilarity,
  normaliseDescription,
  normalisedSimilarity,
  openingSentenceSimilarity,
  rawSimilarity,
  scoreProductPair,
  toSimilarityInput,
  tokenise,
  type SimilarityInput,
} from "@/lib/content-similarity";
import { getAllProducts } from "@/lib/products";

const goldRing: SimilarityInput = {
  id: "T001",
  category: "rings",
  description:
    "A slim gold plated brass ring set with a pink cubic zirconia baguette, sized free size for every finger.",
  specs: {
    material: "Gold plated brass",
    stone: "Pink cubic zirconia baguette",
    size: "Free size",
    type: "Fixed band",
  },
};

const silverAnklet: SimilarityInput = {
  id: "T002",
  category: "anklets",
  description:
    "A slim silver plated brass anklet set with a green cubic zirconia baguette, sized free size for every ankle.",
  specs: {
    material: "Silver plated brass",
    stone: "Green cubic zirconia baguette",
    size: "Free size",
    type: "Set of two anklets",
  },
};

const swatchedClip: SimilarityInput = {
  id: "T003",
  category: "hair-accessories",
  description: "An Antique Gold satin clip with a Lilac Shimmer tail.",
  specs: { material: "Satin fabric on a metal hair clip" },
  options: [
    { name: "Colour", values: ["Antique Gold", "Lilac Shimmer", "Ivory White"] },
  ],
};

describe("tokenise", () => {
  it("lowercases and splits on every non-alphanumeric run", () => {
    expect(tokenise("Gold-plated brass, 18K!")).toEqual([
      "gold",
      "plated",
      "brass",
      "18k",
    ]);
  });

  it("returns no tokens for text that is only punctuation", () => {
    expect(tokenise("  —  ,. ")).toEqual([]);
  });
});

describe("buildShingles", () => {
  it("produces one shingle per window of the configured width", () => {
    expect([...buildShingles(["a", "b", "c", "d", "e"], 4)]).toEqual([
      "a b c d",
      "b c d e",
    ]);
  });

  it("collapses a text shorter than the window into a single shingle", () => {
    expect([...buildShingles(["a", "b"], 4)]).toEqual(["a b"]);
  });

  it("produces nothing for an empty token list", () => {
    expect(buildShingles([], 4).size).toBe(0);
  });
});

describe("jaccardSimilarity", () => {
  it("scores two empty sets 0 rather than 1", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it("is intersection over union", () => {
    expect(jaccardSimilarity(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBeCloseTo(
      2 / 4,
      10,
    );
  });
});

describe("rawSimilarity", () => {
  const passage =
    "The teardrop hangs point down and stays that way instead of spinning to show its back.";

  it("scores identical text exactly 1", () => {
    expect(rawSimilarity(passage, passage)).toBe(1);
  });

  it("scores identical text 1 regardless of casing and punctuation", () => {
    expect(rawSimilarity("Gold-plated brass, hung on a chain.", "gold plated brass hung on a chain")).toBe(1);
  });

  it("scores completely disjoint text 0", () => {
    expect(
      rawSimilarity(
        "quartz analogue movement fastened underneath",
        "meenakari enamel bangle supplied loose",
      ),
    ).toBe(0);
  });

  it("scores a near-duplicate high", () => {
    const original =
      "This gold plated locket necklace has a clear glass front and a hinged case, so it opens, takes whatever you want to carry in it, and closes again.";
    const nearDuplicate =
      "This gold plated locket pendant has a clear glass front and a hinged case, so it opens, takes whatever you want to carry in it, and closes again.";
    expect(rawSimilarity(original, nearDuplicate)).toBeGreaterThan(0.7);
  });

  it("scores unrelated prose of the same register low", () => {
    const left =
      "Keep it out of the shower and wipe the window with a dry cloth when it fogs from moisture or perfume.";
    const right =
      "A quartz movement drives the hands and the strap fastens with a lobster clasp at the wrist.";
    expect(rawSimilarity(left, right)).toBeLessThan(0.05);
  });

  it("falls with the shared run length, so a wider shingle is never more permissive", () => {
    const left = "one two three four five six seven eight";
    const right = "one two three four nine ten eleven twelve";
    expect(rawSimilarity(left, right, 3)).toBeGreaterThan(rawSimilarity(left, right, 5));
  });
});

describe("buildNormalisationVocabulary", () => {
  it("reads category, stone, material and size terms from the product's own record", () => {
    const vocabulary = buildNormalisationVocabulary(goldRing);
    expect(vocabulary.category.has("rings")).toBe(true);
    expect(vocabulary.category.has("ring")).toBe(true);
    expect(vocabulary.stone.has("zirconia")).toBe(true);
    expect(vocabulary.material.has("brass")).toBe(true);
    expect(vocabulary.size.has("free")).toBe(true);
  });

  it("splits a multi-word category slug and singularises each part", () => {
    const vocabulary = buildNormalisationVocabulary(swatchedClip);
    expect(vocabulary.category.has("hair")).toBe(true);
    expect(vocabulary.category.has("accessories")).toBe(true);
    expect(vocabulary.category.has("accessory")).toBe(true);
  });

  it("takes colour terms from a Colour option's values and nowhere else", () => {
    expect([...buildNormalisationVocabulary(swatchedClip).colour].sort()).toEqual([
      "antique",
      "gold",
      "ivory",
      "lilac",
      "shimmer",
      "white",
    ]);
    expect(buildNormalisationVocabulary(goldRing).colour.size).toBe(0);
  });

  it("keeps connective words inside a spec value out of the vocabulary", () => {
    const vocabulary = buildNormalisationVocabulary({
      ...goldRing,
      specs: { ...goldRing.specs, material: "Gold plated brass with a glass front" },
    });
    expect(vocabulary.material.has("with")).toBe(false);
    expect(vocabulary.material.has("glass")).toBe(true);
  });

  it("holds no vocabulary for a spec key the product does not carry", () => {
    expect(buildNormalisationVocabulary(swatchedClip).stone.size).toBe(0);
  });
});

describe("normaliseDescription", () => {
  it("replaces category, material, stone and size tokens and leaves everything else alone", () => {
    expect(normaliseDescription(goldRing.description, buildNormalisationVocabulary(goldRing))).toBe(
      "a slim <material> <material> <material> <category> set with a <stone> <stone> <stone> <stone> sized <size> <size> for every finger",
    );
  });

  it("leaves prose that names nothing in the product's record untouched", () => {
    const untouched = "it is light enough to forget about by mid morning";
    expect(normaliseDescription(untouched, buildNormalisationVocabulary(goldRing))).toBe(untouched);
  });

  it("replaces a colour token that only a Colour option licenses", () => {
    expect(
      normaliseDescription(swatchedClip.description, buildNormalisationVocabulary(swatchedClip)),
    ).toBe("an <colour> <colour> <material> <material> with a <colour> <colour> tail");
  });

  it("replaces a bare numeric token even when no size spec names it", () => {
    expect(normaliseDescription("worn on 3 fingers", buildNormalisationVocabulary(swatchedClip))).toBe(
      "worn on <size> fingers",
    );
  });

  it("applies category before material when a token sits in both", () => {
    const overlapping: SimilarityInput = {
      id: "T004",
      category: "watches",
      description: "the watch dial",
      specs: { material: "Watch grade stainless steel" },
    };
    expect(normaliseDescription(overlapping.description, buildNormalisationVocabulary(overlapping))).toBe(
      "the <category> dial",
    );
  });
});

describe("normalisedSimilarity", () => {
  it("scores a shared template far higher than the raw comparison does", () => {
    const raw = rawSimilarity(goldRing.description, silverAnklet.description);
    const normalised = normalisedSimilarity(goldRing, silverAnklet);
    expect(normalised).toBeGreaterThan(raw);
    expect(normalised).toBeGreaterThan(0.7);
  });

  it("scores two products whose descriptions differ only in their own spec terms 1", () => {
    expect(
      normalisedSimilarity(
        { ...goldRing, description: "a gold plated brass ring with pink cubic zirconia" },
        {
          ...silverAnklet,
          description: "a silver plated brass anklet with green cubic zirconia",
        },
      ),
    ).toBe(1);
  });

  it("does not raise the score of two products that share no template", () => {
    expect(
      normalisedSimilarity(goldRing, {
        ...silverAnklet,
        description: "Quartz hands sweep beneath a domed window that fastens at the wrist.",
      }),
    ).toBeLessThan(0.05);
  });
});

describe("extractOpeningSentence", () => {
  it("stops at the first sentence terminator", () => {
    expect(extractOpeningSentence("First one. Second one. Third one.")).toBe("First one.");
  });

  it("does not treat a decimal point as a terminator", () => {
    expect(extractOpeningSentence("Sizes 2.4 and 2.6 are stocked. Others are not.")).toBe(
      "Sizes 2.4 and 2.6 are stocked.",
    );
  });

  it("truncates a long opening sentence to the word limit", () => {
    const runOn = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
    expect(extractOpeningSentence(runOn).split(" ")).toHaveLength(OPENING_WORD_LIMIT);
  });

  it("falls back to the word limit when the text has no terminator at all", () => {
    const unterminated = Array.from({ length: 30 }, () => "chain").join(" ");
    expect(extractOpeningSentence(unterminated).split(" ")).toHaveLength(OPENING_WORD_LIMIT);
  });
});

describe("openingSentenceSimilarity", () => {
  it("scores a shared opening 1 even when the rest of the copy diverges", () => {
    expect(
      openingSentenceSimilarity(
        "Made for everyday wear. The band is fixed and does not adjust.",
        "Made for everyday wear. The hoop opens on a pressure fit.",
      ),
    ).toBe(1);
  });

  it("scores products whose openings differ 0 even when their bodies match", () => {
    const shared = " Afterwards both descriptions continue with exactly the same body copy.";
    expect(
      openingSentenceSimilarity(
        `A quartz dial reads the hour.${shared}`,
        `Twelve charms float behind glass.${shared}`,
      ),
    ).toBe(0);
  });

  it("uses the narrower opening shingle rather than the whole-description one", () => {
    expect(OPENING_SHINGLE_SIZE).toBeLessThan(SHINGLE_SIZE);
  });
});

describe("scoreProductPair", () => {
  it("returns all three scores, each in the unit interval", () => {
    const scores = scoreProductPair(goldRing, silverAnklet);
    for (const score of [scores.raw, scores.normalised, scores.opening]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("scores a product against itself 1 on every metric", () => {
    const scores = scoreProductPair(goldRing, goldRing);
    expect(scores).toEqual({ raw: 1, normalised: 1, opening: 1 });
  });
});

describe("against the live catalogue", () => {
  const products = getAllProducts().map(toSimilarityInput);

  it("accepts every real product record without special-casing", () => {
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      const scores = scoreProductPair(product, product);
      expect(scores.raw).toBe(1);
      expect(scores.normalised).toBe(1);
    }
  });

  it("finds at least one normalisation term for every real product", () => {
    for (const product of products) {
      const vocabulary = buildNormalisationVocabulary(product);
      const termCount =
        vocabulary.category.size +
        vocabulary.stone.size +
        vocabulary.material.size +
        vocabulary.colour.size +
        vocabulary.size.size;
      expect(termCount, product.id).toBeGreaterThan(0);
    }
  });

  it("is symmetric — the pair order never changes a score", () => {
    const [first, second, third] = products;
    expect(scoreProductPair(first, second)).toEqual(scoreProductPair(second, first));
    expect(scoreProductPair(first, third)).toEqual(scoreProductPair(third, first));
  });
});
