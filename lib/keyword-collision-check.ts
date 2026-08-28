import keywordMapData from "@/data/keyword-map.json";
import {
  canonicaliseKeyword as canonicaliseKeywordShared,
  looselyNormaliseKeyword as looselyNormaliseKeywordShared,
} from "@/scripts/keyword-normalisation.mjs";

/** One keyword to the products claiming it, exactly the `{ keyword: [productId] }` shape. */
export type KeywordIndex = Record<string, string[]>;

export interface KeywordMap {
  generatedBy: string;
  source: string;
  productCount: number;
  /** Every published product's `seo.primaryKeyword`. A keyword here is owned. */
  primary: KeywordIndex;
  /** Every published product's `seo.secondaryKeywords`. Overlap here is expected. */
  secondary: KeywordIndex;
}

/**
 * `hard` blocks; `advisory` never does. The split is the whole point of this module: the
 * collision rule in `.claude/skills/meta-skills.md` says no two products may share a
 * primaryKeyword, and says nothing about secondary terms — because two rings genuinely are both
 * adjustable, and forbidding the overlap would push the writer into inventing a difference that
 * does not exist. See [ADR-036](/docs/decisions/ADR-036-product-seo-metadata-pass.md).
 */
export type KeywordCollisionSeverity = "hard" | "advisory";

export type KeywordCollisionKind =
  /** Another product's primaryKeyword, matched exactly. The only blocking case. */
  | "primary-duplicate"
  /** The candidate is already a secondary term somewhere else. */
  | "secondary-overlap"
  /** Same words, different punctuation or order, against another product's primaryKeyword. */
  | "primary-near-match"
  /** Same words, different punctuation or order, against another product's secondary term. */
  | "secondary-near-match";

export interface KeywordCollision {
  severity: KeywordCollisionSeverity;
  kind: KeywordCollisionKind;
  /** The keyword already in the map that the candidate ran into. */
  matched: string;
  productIds: string[];
  message: string;
}

export interface KeywordCollisionReport {
  candidate: string;
  canonical: string;
  /** True only when a hard collision was found. Advisories never set this. */
  blocked: boolean;
  hard: KeywordCollision[];
  advisory: KeywordCollision[];
}

export interface KeywordCollisionOptions {
  /**
   * The product the candidate is being written *for*. Its own existing keywords are skipped, so
   * re-running the check while rewriting P005's metadata does not report P005 colliding with
   * itself.
   */
  ignoreProductId?: string;
}

/**
 * The typed face of the shared normalisers in `scripts/keyword-normalisation.mjs`. The
 * implementation is plain ESM so that `scripts/validate-products.mjs` can run it with no
 * TypeScript loader; these wrappers exist so that every caller on this side of the boundary
 * still gets `string -> string` rather than the inferred `any` an untyped import would hand
 * them. There is one implementation, and it is not this file's.
 */

/**
 * Lower-cased, whitespace-collapsed. This is what "the same keyword" means for a hard
 * collision — a search engine does not distinguish the case of a query, so neither does this.
 */
export function canonicaliseKeyword(keyword: string): string {
  return canonicaliseKeywordShared(keyword);
}

/**
 * Punctuation dropped, word order discarded, a trailing plural `s` removed from words long
 * enough for that to be safe (`bangles` → `bangle`, but `glass` is left alone). Two keywords
 * with the same loose form are the same *idea* spelled differently. Only ever advisory: it
 * tells a writer where to look, it never decides anything.
 */
export function looselyNormaliseKeyword(keyword: string): string {
  return looselyNormaliseKeywordShared(keyword);
}

function claimantsOf(
  index: KeywordIndex,
  keyword: string,
  ignoreProductId: string | undefined,
): string[] {
  const ids = index[keyword] ?? [];
  return ignoreProductId === undefined
    ? [...ids]
    : ids.filter((productId) => productId !== ignoreProductId);
}

function findLooseMatches(
  index: KeywordIndex,
  candidateCanonical: string,
  ignoreProductId: string | undefined,
): { matched: string; productIds: string[] }[] {
  const candidateLoose = looselyNormaliseKeyword(candidateCanonical);
  if (candidateLoose.length === 0) return [];

  return Object.keys(index)
    .filter(
      (keyword) =>
        keyword !== candidateCanonical &&
        looselyNormaliseKeyword(keyword) === candidateLoose,
    )
    .map((keyword) => ({
      matched: keyword,
      productIds: claimantsOf(index, keyword, ignoreProductId),
    }))
    .filter((match) => match.productIds.length > 0);
}

/**
 * Checks a candidate `primaryKeyword` against the site-wide map. Pure: it reads the map it is
 * given and nothing else, so the skill, the validator and the tests all drive the same code.
 *
 * Only one condition blocks — the candidate is already another *published* product's
 * primaryKeyword. Everything else is reported and permitted.
 */
export function checkPrimaryKeywordCollision(
  candidate: string,
  map: KeywordMap,
  options: KeywordCollisionOptions = {},
): KeywordCollisionReport {
  const { ignoreProductId } = options;
  const canonical = canonicaliseKeyword(candidate);

  const hard: KeywordCollision[] = [];
  const advisory: KeywordCollision[] = [];

  const primaryOwners = claimantsOf(map.primary, canonical, ignoreProductId);
  if (primaryOwners.length > 0) {
    hard.push({
      severity: "hard",
      kind: "primary-duplicate",
      matched: canonical,
      productIds: primaryOwners,
      message: `"${canonical}" is already the primary keyword of ${primaryOwners.join(", ")}. Two products cannot target the same primary keyword. Differentiate by the distinguishing option (colour, motif, size).`,
    });
  }

  const secondaryOwners = claimantsOf(map.secondary, canonical, ignoreProductId);
  if (secondaryOwners.length > 0) {
    advisory.push({
      severity: "advisory",
      kind: "secondary-overlap",
      matched: canonical,
      productIds: secondaryOwners,
      message: `"${canonical}" is already a secondary keyword of ${secondaryOwners.join(", ")}. Permitted, since a secondary term is a claim about the product rather than a reservation, but worth a look if the two products are close.`,
    });
  }

  for (const match of findLooseMatches(map.primary, canonical, ignoreProductId)) {
    advisory.push({
      severity: "advisory",
      kind: "primary-near-match",
      matched: match.matched,
      productIds: match.productIds,
      message: `"${canonical}" differs from ${match.productIds.join(", ")}'s primary keyword "${match.matched}" only by word order or punctuation. Not a block, but the two will compete for the same query.`,
    });
  }

  for (const match of findLooseMatches(map.secondary, canonical, ignoreProductId)) {
    advisory.push({
      severity: "advisory",
      kind: "secondary-near-match",
      matched: match.matched,
      productIds: match.productIds,
      message: `"${canonical}" is a near-match of the secondary keyword "${match.matched}" on ${match.productIds.join(", ")}.`,
    });
  }

  return { candidate, canonical, blocked: hard.length > 0, hard, advisory };
}

/**
 * The committed map. Derived from `data/products.json` by
 * `scripts/backfill-keyword-map.mjs` and re-checked against the catalogue on every gate run, so
 * a stale copy fails the build rather than answering a collision question wrongly.
 */
export function getKeywordMap(): KeywordMap {
  return keywordMapData as unknown as KeywordMap;
}

/** Convenience wrapper for the common case: check a candidate against the committed map. */
export function checkPrimaryKeywordCollisionAgainstCatalogue(
  candidate: string,
  options: KeywordCollisionOptions = {},
): KeywordCollisionReport {
  return checkPrimaryKeywordCollision(candidate, getKeywordMap(), options);
}
