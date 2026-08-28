/**
 * The one list of promotional adjectives barred from a product's search and social copy, and
 * the one function that decides whether a field trips it.
 *
 * A meta field is written for a person to read in a search result, which rules out the
 * promotional vocabulary the copy skills already bar from the description. It is enforced in
 * code as well as in the skill so that a hand-edit to `data/products.json` fails the gate.
 *
 * It lives here, as plain ESM with no imports and no side effects, because both enforcement
 * points need it and neither can import the other: `scripts/validate-products.mjs` validates
 * the catalogue and calls `process.exit` at module scope, so a test file cannot import it, and
 * the validator itself must stay runnable with no TypeScript loader. Two copies is what the
 * repository had, and they had drifted — the validator held sixteen words and
 * `lib/product-seo.test.ts` held a fifteen-word regex missing "statement".
 *
 * Matching is on word boundaries rather than substrings. "Statement" as a substring would fail
 * a field for containing "statements", which is the same word, but the precise semantics is
 * what makes a hyphenated entry like "must-have" behave, and it is the semantics the test copy
 * already used.
 */

/** @type {readonly string[]} */
export const BANNED_META_ADJECTIVES = [
  "stunning",
  "exquisite",
  "gorgeous",
  "breathtaking",
  "must-have",
  "elevate",
  "effortless",
  "timeless",
  "versatile",
  "statement",
  "luxurious",
  "radiant",
  "captivating",
  "dainty",
  "charming",
  "graceful",
];

/**
 * The morphological variants the copy skills bar alongside the root — "elevates", "elevating",
 * "effortlessly". Applied only to the roots that actually inflect, so "timeless" does not also
 * bar "timelessness"-shaped words nobody writes.
 */
const INFLECTING_ROOTS = new Set(["elevate", "effortless"]);

function toPattern(adjective) {
  const escaped = adjective.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return INFLECTING_ROOTS.has(adjective) ? `${escaped}\\w*` : escaped;
}

/**
 * The barred adjectives a single field uses, in list order. Empty for a clean field, so a
 * caller can report every offence in one message rather than the first.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findBannedMetaAdjectives(text) {
  return BANNED_META_ADJECTIVES.filter((adjective) =>
    new RegExp(`\\b${toPattern(adjective)}\\b`, "i").test(text),
  );
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function usesBannedMetaAdjective(text) {
  return findBannedMetaAdjectives(text).length > 0;
}
