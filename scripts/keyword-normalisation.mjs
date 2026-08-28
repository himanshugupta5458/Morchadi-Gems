/**
 * The one implementation of keyword normalisation, shared by `lib/keyword-collision-check.ts`
 * and `scripts/validate-products.mjs`.
 *
 * It lives here, as plain ESM with no imports and no side effects, because the validator has to
 * stay runnable as `node scripts/validate-products.mjs` over the JSON with no TypeScript loader
 * — so the shared code cannot be the `.ts` file, and the `.ts` file imports this instead.
 *
 * It is one module rather than two copies because the two copies had already drifted: the
 * validator's `normaliseKeywordLoosely` never lower-cased, so its `[^a-z0-9]+` pass stripped
 * every capital letter as if it were punctuation and "Gold Nath" normalised to "old ath". The
 * near-duplicate advisory was therefore comparing keywords the storefront's copy would never
 * produce.
 */

const MINIMUM_LENGTH_TO_DEPLURALISE = 4;

/**
 * Lower-cased, whitespace-collapsed. This is what "the same keyword" means for a hard
 * collision — a search engine does not distinguish the case of a query, so neither does this.
 *
 * @param {string} keyword
 * @returns {string}
 */
export function canonicaliseKeyword(keyword) {
  return keyword.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Punctuation dropped, word order discarded, a trailing plural `s` removed from words long
 * enough for that to be safe (`bangles` → `bangle`, but `glass` is left alone). Two keywords
 * with the same loose form are the same *idea* spelled differently.
 *
 * This is deliberately a stated rule rather than a similarity score. ADR-051 already made this
 * call for the material allow-lists — a fuzzy match is an answer nobody gave — and the same
 * reasoning holds here, which is why a loose match is only ever an advisory. It tells a writer
 * where to look; it never decides anything.
 *
 * @param {string} keyword
 * @returns {string}
 */
export function looselyNormaliseKeyword(keyword) {
  return canonicaliseKeyword(keyword)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) =>
      word.length >= MINIMUM_LENGTH_TO_DEPLURALISE &&
      word.endsWith("s") &&
      !word.endsWith("ss")
        ? word.slice(0, -1)
        : word,
    )
    .sort()
    .join(" ");
}
