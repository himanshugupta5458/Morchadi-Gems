import { describe, expect, it } from "vitest";

import catalogue from "@/data/products.json";
import committedMap from "@/data/keyword-map.json";
import {
  buildKeywordMap,
  canonicaliseKeyword as canonicaliseInScript,
  serialiseKeywordMap,
} from "@/scripts/backfill-keyword-map.mjs";
import {
  canonicaliseKeyword,
  checkPrimaryKeywordCollision,
  checkPrimaryKeywordCollisionAgainstCatalogue,
  getKeywordMap,
  looselyNormaliseKeyword,
  type KeywordMap,
} from "@/lib/keyword-collision-check";

type CatalogueProduct = {
  id: string;
  status?: string;
  seo: { primaryKeyword: string; secondaryKeywords: string[] };
};

const products = catalogue as unknown as CatalogueProduct[];

/**
 * `scripts/backfill-keyword-map.mjs` is plain JavaScript and carries no type information, so its
 * return value arrives as a structurally empty object. This is the same cast-through-unknown
 * boundary `lib/products.ts` uses for the catalogue JSON, kept in one place rather than repeated
 * at every call.
 */
function buildMap(input: unknown[]): KeywordMap {
  return buildKeywordMap(input) as unknown as KeywordMap;
}
const publishedProducts = products.filter((product) => product.status !== "draft");

/**
 * A small hand-built map for the behavioural tests. The real catalogue is used separately, for
 * the backfill correctness tests below — a fixture proves the rule, the real catalogue proves the
 * backfill, and neither job is done well by the other.
 */
const FIXTURE_MAP: KeywordMap = {
  generatedBy: "fixture",
  source: "fixture",
  productCount: 3,
  primary: {
    "gold-plated initial ring": ["P001"],
    "cubic zirconia stud earrings": ["P002"],
  },
  secondary: {
    "adjustable ring for women": ["P001", "P003"],
    "everyday studs": ["P002"],
  },
};

describe("canonicaliseKeyword", () => {
  it("lower-cases and collapses whitespace, because a query has no case", () => {
    expect(canonicaliseKeyword("  Gold-Plated   Initial Ring ")).toBe(
      "gold-plated initial ring",
    );
  });

  it("agrees with the backfill script's own canonicaliser", () => {
    for (const product of publishedProducts) {
      expect(canonicaliseKeyword(product.seo.primaryKeyword)).toBe(
        canonicaliseInScript(product.seo.primaryKeyword),
      );
    }
  });
});

describe("looselyNormaliseKeyword", () => {
  it("discards word order and punctuation", () => {
    expect(looselyNormaliseKeyword("thin gold-plated ring")).toBe(
      looselyNormaliseKeyword("gold-plated thin ring"),
    );
  });

  it("treats a plural and its singular as the same word", () => {
    expect(looselyNormaliseKeyword("lacquered bangles")).toBe(
      looselyNormaliseKeyword("lacquered bangle"),
    );
  });

  it("leaves a double-s word alone rather than mangling it", () => {
    expect(looselyNormaliseKeyword("glass")).toBe("glass");
  });

  it("does not collapse genuinely different keywords", () => {
    expect(looselyNormaliseKeyword("gold-plated ring")).not.toBe(
      looselyNormaliseKeyword("gold-plated bracelet"),
    );
  });
});

describe("hard collisions — the only blocking case", () => {
  it("blocks a candidate that is another product's primary keyword", () => {
    const report = checkPrimaryKeywordCollision("gold-plated initial ring", FIXTURE_MAP);

    expect(report.blocked).toBe(true);
    expect(report.hard).toHaveLength(1);
    expect(report.hard[0].kind).toBe("primary-duplicate");
    expect(report.hard[0].productIds).toEqual(["P001"]);
  });

  it("blocks regardless of case and surrounding whitespace", () => {
    const report = checkPrimaryKeywordCollision(
      "  GOLD-Plated Initial Ring  ",
      FIXTURE_MAP,
    );
    expect(report.blocked).toBe(true);
    expect(report.hard[0].kind).toBe("primary-duplicate");
  });

  it("does not block a product colliding with its own existing keyword", () => {
    const report = checkPrimaryKeywordCollision("gold-plated initial ring", FIXTURE_MAP, {
      ignoreProductId: "P001",
    });

    expect(report.blocked).toBe(false);
    expect(report.hard).toHaveLength(0);
  });

  it("does not block a keyword nobody has taken", () => {
    const report = checkPrimaryKeywordCollision("emerald drop anklet", FIXTURE_MAP);

    expect(report.blocked).toBe(false);
    expect(report.hard).toHaveLength(0);
    expect(report.advisory).toHaveLength(0);
  });
});

describe("advisory overlaps — reported, never blocking", () => {
  it("reports a candidate that is someone else's secondary keyword without blocking", () => {
    const report = checkPrimaryKeywordCollision("adjustable ring for women", FIXTURE_MAP);

    expect(report.blocked).toBe(false);
    expect(report.hard).toHaveLength(0);
    expect(report.advisory).toHaveLength(1);
    expect(report.advisory[0].kind).toBe("secondary-overlap");
    expect(report.advisory[0].productIds).toEqual(["P001", "P003"]);
  });

  it("reports a near-match against a primary keyword without blocking", () => {
    const report = checkPrimaryKeywordCollision("initial gold plated ring", FIXTURE_MAP);

    expect(report.blocked).toBe(false);
    expect(report.hard).toHaveLength(0);
    expect(report.advisory.map((entry) => entry.kind)).toContain("primary-near-match");
    expect(report.advisory[0].matched).toBe("gold-plated initial ring");
  });

  it("reports a near-match against a secondary keyword without blocking", () => {
    const report = checkPrimaryKeywordCollision("ring for women adjustable", FIXTURE_MAP);

    expect(report.blocked).toBe(false);
    expect(report.advisory.map((entry) => entry.kind)).toContain("secondary-near-match");
  });

  it("suppresses an advisory that only names the product being written for", () => {
    const report = checkPrimaryKeywordCollision("everyday studs", FIXTURE_MAP, {
      ignoreProductId: "P002",
    });

    expect(report.advisory).toHaveLength(0);
  });

  it("never sets blocked from an advisory, however many there are", () => {
    const report = checkPrimaryKeywordCollision("adjustable ring for women", FIXTURE_MAP);
    expect(report.advisory.length).toBeGreaterThan(0);
    expect(report.blocked).toBe(false);
  });
});

describe("a hard collision and an advisory can coexist", () => {
  const map: KeywordMap = {
    ...FIXTURE_MAP,
    primary: { "everyday studs": ["P009"] },
    secondary: { "everyday studs": ["P002"] },
  };

  it("blocks on the primary while still reporting the secondary overlap", () => {
    const report = checkPrimaryKeywordCollision("everyday studs", map);

    expect(report.blocked).toBe(true);
    expect(report.hard).toHaveLength(1);
    expect(report.advisory).toHaveLength(1);
    expect(report.advisory[0].kind).toBe("secondary-overlap");
  });
});

describe("the backfill against the real catalogue", () => {
  const built: KeywordMap = buildMap(products);

  it("reads every published product and no drafts", () => {
    expect(publishedProducts.length).toBeGreaterThan(0);
    expect(built.productCount).toBe(publishedProducts.length);
  });

  it("indexes every published product's primary keyword", () => {
    for (const product of publishedProducts) {
      const canonical = canonicaliseKeyword(product.seo.primaryKeyword);
      expect(built.primary[canonical]).toContain(product.id);
    }
  });

  it("indexes every published product's secondary keywords", () => {
    for (const product of publishedProducts) {
      for (const keyword of product.seo.secondaryKeywords) {
        expect(built.secondary[canonicaliseKeyword(keyword)]).toContain(product.id);
      }
    }
  });

  it("invents no keyword that is not in the catalogue", () => {
    const fromCatalogue = new Set(
      publishedProducts.flatMap((product) => [
        canonicaliseKeyword(product.seo.primaryKeyword),
        ...product.seo.secondaryKeywords.map(canonicaliseKeyword),
      ]),
    );

    for (const keyword of Object.keys(built.primary)) {
      expect(fromCatalogue.has(keyword)).toBe(true);
    }
    for (const keyword of Object.keys(built.secondary)) {
      expect(fromCatalogue.has(keyword)).toBe(true);
    }
  });

  it("excludes a draft product's keywords", () => {
    const draft = {
      id: "P900",
      status: "draft",
      seo: {
        primaryKeyword: "unreleased draft keyword",
        secondaryKeywords: ["unreleased draft secondary"],
      },
    };
    const withDraft: KeywordMap = buildMap([...products, draft]);

    expect(withDraft.productCount).toBe(publishedProducts.length);
    expect(withDraft.primary["unreleased draft keyword"]).toBeUndefined();
    expect(withDraft.secondary["unreleased draft secondary"]).toBeUndefined();
  });

  it("is deterministic — same input, byte-identical output", () => {
    expect(serialiseKeywordMap(buildMap(products))).toBe(serialiseKeywordMap(built));
  });

  it("sorts keywords and product ids, so a diff shows a real change", () => {
    expect(Object.keys(built.primary)).toEqual([...Object.keys(built.primary)].sort());
    for (const ids of Object.values(built.secondary)) {
      expect(ids).toEqual([...ids].sort());
    }
  });
});

describe("the committed map matches the catalogue", () => {
  it("is not stale — data/keyword-map.json equals a fresh backfill", () => {
    expect(committedMap).toEqual(buildMap(products));
  });

  it("is what getKeywordMap returns", () => {
    expect(getKeywordMap()).toEqual(committedMap);
  });
});

describe("the real catalogue has no hard collisions", () => {
  it("gives every published product a primary keyword no other product owns", () => {
    const map = getKeywordMap();
    const collisions = Object.entries(map.primary).filter(([, ids]) => ids.length > 1);

    expect(collisions).toEqual([]);
  });

  it("clears every product's own primary keyword when it is re-checked for itself", () => {
    for (const product of publishedProducts) {
      const report = checkPrimaryKeywordCollisionAgainstCatalogue(
        product.seo.primaryKeyword,
        { ignoreProductId: product.id },
      );
      expect(report.blocked).toBe(false);
    }
  });

  it("blocks every product's primary keyword when a different product proposes it", () => {
    for (const product of publishedProducts) {
      const report = checkPrimaryKeywordCollisionAgainstCatalogue(
        product.seo.primaryKeyword,
        { ignoreProductId: "P900" },
      );
      expect(report.blocked).toBe(true);
      expect(report.hard[0].productIds).toEqual([product.id]);
    }
  });
});
