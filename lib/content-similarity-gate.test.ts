import { describe, expect, it } from "vitest";

import catalogue from "@/data/products.json";
import {
  SIMILARITY_THRESHOLD,
  compareAgainstCatalogue,
  describeSimilarityGate,
  evaluateSimilarityGate,
  peakScore,
  selectActiveSimilarityInputs,
  type SimilarityInput,
} from "@/lib/content-similarity";
import type { Product } from "@/types/product";

const CATALOGUE_DESCRIPTION =
  "A slim gold-tone band with a softly waved face carrying the single initial you choose. The open back adjusts to whichever finger you want it on.";

function entry(id: string, description: string): SimilarityInput {
  return {
    id,
    category: "rings",
    description,
    specs: { material: "Gold plated stainless steel", type: "Adjustable open band" },
  };
}

const NEIGHBOURS: SimilarityInput[] = [
  entry("P001", CATALOGUE_DESCRIPTION),
  entry(
    "P002",
    "A glass-fronted locket on a fine chain, opening to hold a photograph small enough to keep private.",
  ),
];

/**
 * P900 rather than an id near the real range, and this matters more here than in a hermetic
 * fixture: the candidates below are scored against the REAL catalogue, and
 * `compareAgainstCatalogue` filters out `entry.id === candidate.id`. A synthetic id that a real
 * product later takes would silently shrink the comparison population by one rather than fail
 * loudly. This file used P050 until the end-to-end run of 2026-08-23 added a real P050 and the
 * count assertion below broke. Keep synthetic ids in the P9xx range, as
 * `lib/product-status.test.ts` does. See the ADR-053 addendum.
 */
const SYNTHETIC_ID = "P900";

/** Word-for-word the same as P001. Nothing scores higher than this, so it is the ceiling case. */
const VERBATIM_COPY = entry(SYNTHETIC_ID, CATALOGUE_DESCRIPTION);

/** Shares nothing but function words with either neighbour. */
const ORIGINAL = entry(
  SYNTHETIC_ID,
  "Sixteen lacquered bangles arrive as a stack, each one thin enough that the whole set weighs less than a single kada.",
);

describe("SIMILARITY_THRESHOLD, as shipped", () => {
  it("is null — the gate is advisory until a calibration run sets a number", () => {
    expect(SIMILARITY_THRESHOLD).toBeNull();
  });
});

describe("peakScore", () => {
  it("returns the highest of the three measures", () => {
    expect(peakScore({ raw: 0.1, normalised: 0.4, opening: 0.2 })).toEqual({
      measure: "normalised",
      score: 0.4,
    });
    expect(peakScore({ raw: 0.9, normalised: 0.4, opening: 0.2 })).toEqual({
      measure: "raw",
      score: 0.9,
    });
  });

  it("breaks a tie in raw, normalised, opening order", () => {
    expect(peakScore({ raw: 0.5, normalised: 0.5, opening: 0.5 }).measure).toBe("raw");
    expect(peakScore({ raw: 0.1, normalised: 0.5, opening: 0.5 }).measure).toBe("normalised");
  });
});

describe("compareAgainstCatalogue", () => {
  it("scores every entry, highest peak first", () => {
    const comparisons = compareAgainstCatalogue(VERBATIM_COPY, NEIGHBOURS);

    expect(comparisons).toHaveLength(2);
    expect(comparisons[0].againstProductId).toBe("P001");
    expect(comparisons[0].scores.raw).toBe(1);
    expect(comparisons[0].peak.score).toBeGreaterThan(comparisons[1].peak.score);
  });

  it("excludes any entry carrying the candidate's own id", () => {
    const comparisons = compareAgainstCatalogue(entry("P001", "Anything at all."), NEIGHBOURS);
    expect(comparisons.map((comparison) => comparison.againstProductId)).toEqual(["P002"]);
  });

  it("carries all three scores of the existing engine on every comparison", () => {
    const [first] = compareAgainstCatalogue(VERBATIM_COPY, NEIGHBOURS);
    expect(Object.keys(first.scores).sort()).toEqual(["normalised", "opening", "raw"]);
  });
});

describe("the gate with no threshold set", () => {
  it("never blocks a verbatim copy of a live description", () => {
    const report = evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, null);

    expect(report.blocked).toBe(false);
    expect(report.advisory).toBe(true);
    expect(report.exceeded).toEqual([]);
    expect(report.threshold).toBeNull();
  });

  it("still computes and reports every score", () => {
    const report = evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, null);

    expect(report.comparedAgainst).toBe(2);
    expect(report.comparisons).toHaveLength(2);
    expect(report.comparisons[0].scores.raw).toBe(1);
  });

  it("defaults to the shipped constant, which is null", () => {
    expect(evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS).blocked).toBe(false);
    expect(evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS).advisory).toBe(true);
  });

  it("says plainly that nothing blocks", () => {
    expect(describeSimilarityGate(evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS))).toContain(
      "ADVISORY",
    );
  });
});

describe("the gate with a threshold set", () => {
  it("blocks a comparison whose peak sits above it", () => {
    const report = evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, 0.5);

    expect(report.blocked).toBe(true);
    expect(report.advisory).toBe(false);
    expect(report.exceeded).toHaveLength(1);
    expect(report.exceeded[0].againstProductId).toBe("P001");
  });

  it("passes copy that scores below it", () => {
    const report = evaluateSimilarityGate(ORIGINAL, NEIGHBOURS, 0.5);

    expect(report.blocked).toBe(false);
    expect(report.exceeded).toEqual([]);
    expect(report.comparisons).toHaveLength(2);
  });

  it("passes a score exactly equal to it — above means above", () => {
    const report = evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, 1);

    expect(report.comparisons[0].peak.score).toBe(1);
    expect(report.blocked).toBe(false);
  });

  it("blocks on any one of the three measures, not only the raw one", () => {
    const templated = entry(
      SYNTHETIC_ID,
      "A slim silver-tone band with a softly waved face carrying the single motif you choose. The open back adjusts to whichever finger you want it on.",
    );
    const report = evaluateSimilarityGate(templated, NEIGHBOURS, 0.5);

    expect(report.blocked).toBe(true);
    expect(report.exceeded[0].peak.score).toBeGreaterThan(0.5);
  });

  it("reports how it decided", () => {
    expect(describeSimilarityGate(evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, 0.5))).toContain(
      "BLOCKED",
    );
    expect(describeSimilarityGate(evaluateSimilarityGate(ORIGINAL, NEIGHBOURS, 0.5))).toContain(
      "PASS",
    );
  });

  it("turning the gate on is the only change — nothing else about the run differs", () => {
    const advisoryRun = evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, null);
    const blockingRun = evaluateSimilarityGate(VERBATIM_COPY, NEIGHBOURS, 0.5);

    expect(blockingRun.comparisons).toEqual(advisoryRun.comparisons);
  });
});

describe("the comparison population", () => {
  const products = catalogue as unknown as Product[];

  it("is every active product in the real catalogue and no draft", () => {
    const inputs = selectActiveSimilarityInputs(products);
    const activeIds = products.filter((product) => product.status === "active").map((product) => product.id);

    expect(inputs.map((input) => input.id)).toEqual(activeIds);
  });

  it("scores a candidate against all of them without a threshold and refuses nothing", () => {
    const report = evaluateSimilarityGate(ORIGINAL, selectActiveSimilarityInputs(products));

    expect(report.comparedAgainst).toBe(products.filter((product) => product.status === "active").length);
    expect(report.blocked).toBe(false);
  });
});
