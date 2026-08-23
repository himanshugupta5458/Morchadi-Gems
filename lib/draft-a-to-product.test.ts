import { describe, expect, it } from "vitest";

import {
  buildProductFromDraft,
  canonicaliseSpecLabel,
  checkCandidatePrimaryKeyword,
  formatSpecValue,
  mapAttributesToSpecs,
  mapCollections,
  mapImagesToMedia,
  mapPricing,
  mapVariantsToOptions,
  resolveSpecKey,
  type AuthoredContent,
  type DraftA,
  type DraftAttribute,
} from "@/lib/draft-a-to-product";
import type { KeywordMap } from "@/lib/keyword-collision-check";
import type { Product, ProductSeo } from "@/types/product";

/**
 * A confirmed attribute, which is the only kind that may reach a spec. Written as a builder so a
 * test says only what it is varying — an attribute differing from the happy path in one field is
 * the whole point of most cases below.
 */
function attribute(overrides: Partial<DraftAttribute> = {}): DraftAttribute {
  return {
    label: "Material",
    value: "gold-plated brass",
    displayTerm: null,
    stoneSource: null,
    source: { origin: "migrated-text", quotedPhrase: "gold-plated brass" },
    confirmed: true,
    ...overrides,
  };
}

const SEO: ProductSeo = {
  primaryKeyword: "gold-plated bow ring",
  secondaryKeywords: ["adjustable ring for women", "cubic zirconia ring"],
  metaTitle: "Gold-Plated Bow Ring on an Adjustable Band",
  metaDescription:
    "A gold-plated bow ring on an adjustable band, set with clear cubic zirconia. Sized to fit most fingers, and returns run 7 days.",
  imageAlt: "Gold-tone adjustable band ring topped with a small cubic zirconia bow",
  ogTitle: "Adjustable Bow Ring in Gold Tone",
  ogDescription: "A gold-plated band topped with a little cubic zirconia bow, made to wear every day.",
  ogImage: "/products/P900.webp",
};

const CONTENT: AuthoredContent = {
  name: "Cubic Zirconia Bow Ring",
  description: "A gold-tone band carrying a small cubic zirconia bow, open at the back so it adjusts.",
  seo: SEO,
};

function draft(overrides: Partial<DraftA> = {}): DraftA {
  return {
    productId: "P900",
    sourceType: "migrated",
    category: "rings",
    subcategory: null,
    variants: [],
    attributes: [
      attribute(),
      attribute({ label: "Stone", value: "cubic zirconia", source: null }),
      attribute({ label: "Type", value: "adjustable open band", source: null }),
    ],
    images: { general: ["/products/P900.webp"], variantImages: {} },
    pricing: { price: 210, mrp: 299, cost: 126, referencePrice: "₹499 (old site)" },
    personalized: false,
    suggestedCollections: [],
    status: "draft",
    ...overrides,
  };
}

describe("spec label canonicalisation", () => {
  it("lower-cases, drops punctuation and collapses whitespace", () => {
    expect(canonicaliseSpecLabel("  Closure   Type ")).toBe("closure type");
    expect(canonicaliseSpecLabel("Chain-Length")).toBe("chain length");
    expect(canonicaliseSpecLabel("Material:")).toBe("material");
  });

  it("resolves every documented synonym onto its canonical key", () => {
    expect(resolveSpecKey("Metal")).toBe("material");
    expect(resolveSpecKey("Plating")).toBe("material");
    expect(resolveSpecKey("Base Material")).toBe("material");
    expect(resolveSpecKey("Gemstone")).toBe("stone");
    expect(resolveSpecKey("Product Type")).toBe("type");
    expect(resolveSpecKey("Chain Length")).toBe("size");
    expect(resolveSpecKey("Dimensions")).toBe("size");
    expect(resolveSpecKey("Clasp")).toBe("closure");
    expect(resolveSpecKey("Color")).toBe("colour");
  });

  it("leaves an unrecognised label as its own lower-case key rather than coercing it", () => {
    expect(resolveSpecKey("Movement")).toBe("movement");
    expect(resolveSpecKey("Bulb count")).toBe("bulb count");
  });
});

describe("spec value formatting", () => {
  it("upper-cases the first character and collapses whitespace", () => {
    expect(formatSpecValue("  gold plated   brass ")).toBe("Gold plated brass");
  });

  it("leaves the rest of the value exactly as the owner confirmed it", () => {
    expect(formatSpecValue("cat's-eye centre inside a CZ halo")).toBe(
      "Cat's-eye centre inside a CZ halo",
    );
    expect(formatSpecValue("18K gold-plated stainless steel")).toBe(
      "18K gold-plated stainless steel",
    );
  });
});

describe("mapAttributesToSpecs", () => {
  it("produces the real specs shape: lower-case keys, sentence-cased string values", () => {
    const { specs, issues } = mapAttributesToSpecs([
      attribute(),
      attribute({ label: "Stone", value: "cubic zirconia" }),
      attribute({ label: "Closure type", value: "lobster clasp" }),
      attribute({ label: "Sizes", value: "adjustable, free size" }),
    ]);

    expect(specs).toEqual({
      material: "Gold-plated brass",
      stone: "Cubic zirconia",
      closure: "Lobster clasp",
      size: "Adjustable, free size",
    });
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    for (const key of Object.keys(specs)) expect(key).toBe(key.toLowerCase());
    for (const value of Object.values(specs)) expect(typeof value).toBe("string");
  });

  it("writes the technical value and never the trade name", () => {
    const { specs, issues } = mapAttributesToSpecs([
      attribute({
        label: "Stone",
        value: "cubic zirconia",
        displayTerm: "American Diamond",
        stoneSource: "known-trade-term",
      }),
    ]);

    expect(specs.stone).toBe("Cubic zirconia");
    expect(JSON.stringify(specs)).not.toContain("American Diamond");
    expect(issues.some((issue) => issue.field.endsWith(".displayTerm"))).toBe(true);
  });

  it("files an unrecognised label under its own key and says so as an advisory", () => {
    const { specs, issues } = mapAttributesToSpecs([
      attribute(),
      attribute({ label: "Movement", value: "quartz analogue" }),
    ]);

    expect(specs.movement).toBe("Quartz analogue");
    const advisories = issues.filter((issue) => issue.severity === "advisory");
    expect(advisories).toHaveLength(1);
    expect(advisories[0].message).toContain("specs.movement");
  });

  it("refuses two attributes that resolve to one spec key rather than picking a winner", () => {
    const { specs, issues } = mapAttributesToSpecs([
      attribute({ label: "Material", value: "stainless steel" }),
      attribute({ label: "Plating", value: "18K gold" }),
    ]);

    const errors = issues.filter((issue) => issue.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("specs.material");
    expect(specs.material).toBe("Stainless steel");
  });

  it("refuses an unconfirmed attribute", () => {
    const { issues } = mapAttributesToSpecs([attribute({ confirmed: false })]);
    expect(issues.some((issue) => issue.field === "attributes[0].confirmed")).toBe(true);
  });

  it("refuses a blank label or a blank value", () => {
    const blankLabel = mapAttributesToSpecs([attribute({ label: "   " })]);
    expect(blankLabel.issues.some((issue) => issue.field === "attributes[0].label")).toBe(true);

    const blankValue = mapAttributesToSpecs([attribute({ value: "" })]);
    expect(blankValue.issues.some((issue) => issue.field === "attributes[0].value")).toBe(true);
  });

  it("refuses an attribute list that maps to no spec at all", () => {
    const { specs, issues } = mapAttributesToSpecs([]);
    expect(specs).toEqual({});
    expect(issues.some((issue) => issue.field === "attributes")).toBe(true);
  });

  it("notes an unverified stone guess without refusing it", () => {
    const { specs, issues } = mapAttributesToSpecs([
      attribute({ label: "Stone", value: "glass or cubic zirconia", stoneSource: "unverified-guess" }),
    ]);

    expect(specs.stone).toBe("Glass or cubic zirconia");
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(issues.some((issue) => issue.field === "attributes[0].stoneSource")).toBe(true);
  });
});

describe("mapVariantsToOptions", () => {
  it("carries the values through and defaults to the first one", () => {
    const { options, issues } = mapVariantsToOptions(
      [{ optionName: "Colour", values: ["Golden", "Silver"] }],
      { Colour: "swatch" },
    );

    expect(options).toEqual([
      { name: "Colour", type: "swatch", values: ["Golden", "Silver"], default: "Golden" },
    ]);
    expect(issues).toEqual([]);
  });

  it("refuses to guess the control type from the number of values", () => {
    const { options, issues } = mapVariantsToOptions(
      [{ optionName: "Shape", values: ["Heart", "Round", "Oval", "Square"] }],
      {},
    );

    expect(options).toEqual([]);
    expect(issues[0].message).toContain("no control type");
  });

  it("refuses an option with no values and a duplicated option name", () => {
    const empty = mapVariantsToOptions([{ optionName: "Letter", values: [] }], { Letter: "dropdown" });
    expect(empty.issues.some((issue) => issue.field === "variants[0].values")).toBe(true);

    const duplicated = mapVariantsToOptions(
      [
        { optionName: "Colour", values: ["Golden"] },
        { optionName: "colour", values: ["Silver"] },
      ],
      { Colour: "swatch", colour: "swatch" },
    );
    expect(duplicated.options).toHaveLength(1);
    expect(duplicated.issues.some((issue) => issue.field === "variants[1].optionName")).toBe(true);
  });
});

describe("mapImagesToMedia", () => {
  const colourOption = {
    name: "Colour",
    type: "swatch" as const,
    values: ["Golden", "Silver"],
    default: "Golden",
  };

  it("renames general to media.images and omits variantImages when empty", () => {
    const { media, issues } = mapImagesToMedia(
      { general: ["/products/P900.webp"], variantImages: {} },
      [],
    );

    expect(media).toEqual({ images: ["/products/P900.webp"] });
    expect("variantImages" in media).toBe(false);
    expect(issues).toEqual([]);
  });

  it("passes an OptionName:value key through unchanged", () => {
    const { media, issues } = mapImagesToMedia(
      {
        general: ["/products/P900.webp"],
        variantImages: { "Colour:Golden": "/products/P900-golden.webp" },
      },
      [colourOption],
    );

    expect(media.variantImages).toEqual({ "Colour:Golden": "/products/P900-golden.webp" });
    expect(issues).toEqual([]);
  });

  it("refuses a variant key naming an option or a value the product does not offer", () => {
    const unknownOption = mapImagesToMedia(
      { general: ["/a.webp"], variantImages: { "Finish:Matte": "/b.webp" } },
      [colourOption],
    );
    expect(unknownOption.issues[0].message).toContain("no option named");

    const unknownValue = mapImagesToMedia(
      { general: ["/a.webp"], variantImages: { "Colour:Rose": "/b.webp" } },
      [colourOption],
    );
    expect(unknownValue.issues[0].message).toContain('has no value "Rose"');
  });

  it("refuses a malformed key and an empty general list", () => {
    const malformed = mapImagesToMedia(
      { general: ["/a.webp"], variantImages: { Golden: "/b.webp" } },
      [colourOption],
    );
    expect(malformed.issues[0].message).toContain("OptionName:value");

    const noImages = mapImagesToMedia({ general: [], variantImages: {} }, []);
    expect(noImages.issues.some((issue) => issue.field === "images.general")).toBe(true);
  });
});

describe("mapPricing", () => {
  it("carries a fully decided price through", () => {
    const { pricing, issues } = mapPricing({ price: 210, mrp: 299, cost: 126, referencePrice: null });
    expect(pricing).toEqual({ price: 210, mrp: 299, cost: 126 });
    expect(issues).toEqual([]);
  });

  it("falls back to price when mrp is unset, and says the page will show no discount", () => {
    const { pricing, issues } = mapPricing({ price: 210, mrp: null, cost: 126, referencePrice: null });
    expect(pricing).toEqual({ price: 210, mrp: 210, cost: 126 });
    expect(issues.some((issue) => issue.severity === "advisory" && issue.field === "pricing.mrp")).toBe(
      true,
    );
  });

  it("refuses a missing cost rather than inventing one", () => {
    const { pricing, issues } = mapPricing({ price: 210, mrp: 299, cost: null, referencePrice: null });
    expect(pricing).toBeNull();
    expect(issues.some((issue) => issue.field === "pricing.cost")).toBe(true);
  });

  it("refuses an mrp below the price", () => {
    const { pricing } = mapPricing({ price: 210, mrp: 199, cost: 126, referencePrice: null });
    expect(pricing).toBeNull();
  });
});

describe("mapCollections", () => {
  it("keeps the two taggable collections and refuses a derived one", () => {
    const kept = mapCollections(["gifting", "anti-tarnish"]);
    expect(kept.collections).toEqual(["gifting", "anti-tarnish"]);
    expect(kept.issues).toEqual([]);

    const derived = mapCollections(["best-sellers"]);
    expect(derived.collections).toEqual([]);
    expect(derived.issues[0].message).toContain("derived from flags");
  });
});

describe("buildProductFromDraft", () => {
  it("assembles a record in the catalogue's own shape, always as a draft", () => {
    const { product, errors } = buildProductFromDraft({ draft: draft(), content: CONTENT });

    expect(errors).toEqual([]);
    expect(product).toEqual({
      id: "P900",
      name: "Cubic Zirconia Bow Ring",
      category: "rings",
      status: "draft",
      pricing: { price: 210, mrp: 299, cost: 126 },
      media: { images: ["/products/P900.webp"] },
      specs: {
        material: "Gold-plated brass",
        stone: "Cubic zirconia",
        type: "Adjustable open band",
      },
      description: CONTENT.description,
      seo: SEO,
      stock: { inStock: true },
      flags: { featured: false, isNew: true },
    });
  });

  it("never emits an active record, whatever the draft says its own status is", () => {
    const { product } = buildProductFromDraft({
      draft: draft({ status: "active" }),
      content: CONTENT,
    });
    expect(product?.status).toBe("draft");
  });

  it("carries options, variant images and collections when the draft has them", () => {
    const { product, errors } = buildProductFromDraft({
      draft: draft({
        variants: [{ optionName: "Colour", values: ["Golden", "Silver"] }],
        images: {
          general: ["/products/P900.webp"],
          variantImages: { "Colour:Golden": "/products/P900-golden.webp" },
        },
        suggestedCollections: ["gifting"],
      }),
      content: CONTENT,
      optionTypes: { Colour: "swatch" },
    });

    expect(errors).toEqual([]);
    expect(product?.options).toEqual([
      { name: "Colour", type: "swatch", values: ["Golden", "Silver"], default: "Golden" },
    ]);
    expect(product?.media.variantImages).toEqual({ "Colour:Golden": "/products/P900-golden.webp" });
    expect(product?.collections).toEqual(["gifting"]);
  });

  it("omits collections and options entirely rather than writing empty ones", () => {
    const { product } = buildProductFromDraft({ draft: draft(), content: CONTENT });
    expect(product === null ? true : "collections" in product).toBe(false);
    expect(product === null ? true : "options" in product).toBe(false);
  });

  it("returns no product at all when any mapping errors", () => {
    const { product, errors } = buildProductFromDraft({
      draft: draft({ attributes: [attribute({ confirmed: false })] }),
      content: CONTENT,
    });

    expect(product).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("refuses a category outside the ten fixed slugs", () => {
    const { product, errors } = buildProductFromDraft({
      draft: draft({ category: "jewellery" }),
      content: CONTENT,
    });

    expect(product).toBeNull();
    expect(errors.some((issue) => issue.field === "category")).toBe(true);
  });

  it("flags a personalised piece that offers nothing to personalise", () => {
    const { advisories } = buildProductFromDraft({
      draft: draft({ personalized: true }),
      content: CONTENT,
    });

    expect(advisories.some((issue) => issue.field === "personalized")).toBe(true);
  });
});

describe("checkCandidatePrimaryKeyword", () => {
  const committed: KeywordMap = {
    generatedBy: "test",
    source: "test",
    productCount: 1,
    primary: { "gold-plated initial ring": ["P001"] },
    secondary: { "adjustable letter ring": ["P001"] },
  };

  function record(id: string, status: "draft" | "active", primaryKeyword: string): Product {
    return {
      id,
      name: id,
      category: "rings",
      status,
      pricing: { price: 210, mrp: 299, cost: 126 },
      media: { images: [`/products/${id}.webp`] },
      specs: { material: "Gold plated brass" },
      description: "A ring.",
      seo: { ...SEO, primaryKeyword },
      stock: { inStock: true },
      flags: { featured: false, isNew: true },
    };
  }

  it("blocks on a published product's primary keyword", () => {
    const result = checkCandidatePrimaryKeyword("Gold-Plated Initial Ring", committed, []);
    expect(result.blocked).toBe(true);
    expect(result.published.hard[0].productIds).toEqual(["P001"]);
  });

  it("blocks on an unpublished record's primary keyword, which the committed map cannot see", () => {
    const catalogue = [record("P900", "draft", "gold-plated bow ring")];
    const result = checkCandidatePrimaryKeyword("gold-plated bow ring", committed, catalogue);

    expect(result.published.blocked).toBe(false);
    expect(result.pendingDrafts.blocked).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it("ignores the product being written for, so a rewrite does not collide with itself", () => {
    const catalogue = [record("P900", "draft", "gold-plated bow ring")];
    const result = checkCandidatePrimaryKeyword("gold-plated bow ring", committed, catalogue, "P900");
    expect(result.blocked).toBe(false);
  });

  it("passes a keyword nothing claims", () => {
    const result = checkCandidatePrimaryKeyword("green enamel kada", committed, []);
    expect(result.blocked).toBe(false);
  });
});
