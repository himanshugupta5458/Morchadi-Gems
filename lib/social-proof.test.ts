import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SOCIAL_PROOF_DISPLAY_LIMIT,
  getAllSocialProof,
  getSocialProof,
} from "@/lib/social-proof";

const RAW_FILE = readFileSync("data/social-proof.json", "utf8");

/**
 * The gate for `data/social-proof.json`. There is no `validate:social-proof` script because
 * there is nothing a plain-Node script would check that this cannot: the file is small, it is
 * read by one module, and every rule below is about a claim the site would make out loud.
 *
 * A curated post is an assertion about a real customer, so the rules are the ones ADR-034 set
 * for the catalogue: an entry says who, shows what, and can be checked.
 */
describe("the curated social proof file", () => {
  it("is a JSON array", () => {
    expect(Array.isArray(JSON.parse(RAW_FILE))).toBe(true);
  });

  it("carries a stable, unique id on every entry", () => {
    const ids = getAllSocialProof().map((entry) => entry.id);

    for (const id of ids) expect(id.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every entry at a photograph that is actually on disk", () => {
    for (const entry of getAllSocialProof()) {
      expect(entry.image.startsWith("/"), entry.id).toBe(true);
      expect(existsSync(join("public", entry.image)), `${entry.id}: ${entry.image}`).toBe(true);
    }
  });

  it("describes every photograph for a screen reader, and not by repeating the quote", () => {
    for (const entry of getAllSocialProof()) {
      expect(entry.alt.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.alt.trim(), entry.id).not.toBe(entry.quote.trim());
    }
  });

  it("gives every entry something to say", () => {
    for (const entry of getAllSocialProof()) {
      expect(entry.quote.trim().length, entry.id).toBeGreaterThan(0);
    }
  });

  it("links to a real post when it links at all", () => {
    for (const entry of getAllSocialProof()) {
      if (entry.sourceUrl === undefined) continue;
      expect(entry.sourceUrl.startsWith("https://"), entry.id).toBe(true);
    }
  });

  it("caps what the home page shows without dropping anything from the file", () => {
    expect(getSocialProof().length).toBeLessThanOrEqual(SOCIAL_PROOF_DISPLAY_LIMIT);
    expect(getSocialProof(Number.POSITIVE_INFINITY)).toEqual(getAllSocialProof());
  });

  /**
   * It ships empty. Not a placeholder to fill in later with something invented — the section
   * renders nothing at all until a real post exists, which is the same rule
   * `BUSINESS.socialProfileUrls` follows.
   */
  it("holds no invented entry today", () => {
    expect(getAllSocialProof()).toEqual([]);
  });
});
