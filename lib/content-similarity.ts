import type { Product } from "@/types/product";

/**
 * Shingle width for whole-description comparison. Chosen against this catalogue's real
 * shape: 45 of 49 descriptions run 162–232 words, and the remaining four are 15–21 words
 * of placeholder copy. At width 3 ordinary English function-word runs collide across
 * unrelated products; at width 5 the four short descriptions yield too few shingles for a
 * stable ratio. Width 4 keeps at least 12 shingles even for the shortest description.
 * See [ADR-053](/docs/decisions/ADR-053-draft-a-to-product-orchestration.md), which carries the
 * threshold decision. `ADR-052-content-similarity-engine.md` was planned and never written —
 * ADR-052 is the product status field.
 */
export const SHINGLE_SIZE = 4;

/**
 * Shingle width for the opening-sentence comparison, which runs over at most 20 words. One
 * differing word removes 4 of 17 shingles at width 4 but only 3 of 18 at width 3, so the
 * narrower window uses the narrower shingle to keep a single word substitution from
 * dominating the score.
 */
export const OPENING_SHINGLE_SIZE = 3;

/** The opening-sentence window: the first sentence, truncated to this many words. */
export const OPENING_WORD_LIMIT = 20;

/**
 * Function words only. This list carries no product vocabulary — every domain term the
 * normaliser replaces is read from the product's own record — and exists solely to stop
 * connective words inside a spec value ("with", "and") from being treated as material or
 * size vocabulary.
 */
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "are",
  "was",
  "were",
  "has",
  "have",
  "its",
  "but",
  "not",
  "you",
  "your",
  "our",
  "any",
  "all",
  "can",
  "will",
  "than",
  "then",
  "when",
  "while",
  "each",
  "such",
  "some",
  "only",
  "same",
  "very",
  "just",
  "out",
  "over",
  "under",
  "more",
  "most",
  "other",
  "own",
  "too",
]);

const MINIMUM_VOCABULARY_TOKEN_LENGTH = 3;

export type PlaceholderClass =
  | "category"
  | "stone"
  | "material"
  | "colour"
  | "size";

/**
 * Applied in this order, first match winning. Category is the broadest identity and is
 * removed first; size is last so a numeric token inside a material phrase is read as part
 * of the material rather than as a measurement.
 */
export const PLACEHOLDER_PRECEDENCE: readonly PlaceholderClass[] = [
  "category",
  "stone",
  "material",
  "colour",
  "size",
] as const;

export type NormalisationVocabulary = Record<PlaceholderClass, ReadonlySet<string>>;

/**
 * The subset of a catalogue record this module reads. Declared structurally so a test can
 * build a fixture without a full `Product`, and so the calibration script can pass parsed
 * JSON straight through.
 */
export interface SimilarityInput {
  id: string;
  category: string;
  description: string;
  specs: Record<string, string>;
  options?: readonly { readonly name: string; readonly values: readonly string[] }[];
}

export interface ProductPairScores {
  raw: number;
  normalised: number;
  opening: number;
}

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

export function buildShingles(
  tokens: readonly string[],
  shingleSize: number = SHINGLE_SIZE,
): Set<string> {
  if (tokens.length === 0) return new Set<string>();
  if (tokens.length <= shingleSize) return new Set<string>([tokens.join(" ")]);

  const shingles = new Set<string>();
  for (let start = 0; start + shingleSize <= tokens.length; start += 1) {
    shingles.add(tokens.slice(start, start + shingleSize).join(" "));
  }
  return shingles;
}

/**
 * Intersection over union. Two empty sets score 0 rather than 1: an absent description is
 * no evidence of duplication, and scoring it as a perfect match would put every pair of
 * empty records at the top of the report.
 */
export function jaccardSimilarity(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
  if (left.size === 0 && right.size === 0) return 0;

  let intersectionSize = 0;
  left.forEach((shingle) => {
    if (right.has(shingle)) intersectionSize += 1;
  });
  const unionSize = left.size + right.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export function rawSimilarity(
  leftDescription: string,
  rightDescription: string,
  shingleSize: number = SHINGLE_SIZE,
): number {
  return jaccardSimilarity(
    buildShingles(tokenise(leftDescription), shingleSize),
    buildShingles(tokenise(rightDescription), shingleSize),
  );
}

function singularise(token: string): string | null {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ches") || token.endsWith("shes")) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return null;
}

function collectVocabularyTokens(source: string | undefined): Set<string> {
  const collected = new Set<string>();
  if (!source) return collected;

  for (const token of tokenise(source)) {
    if (/^\d/.test(token)) {
      collected.add(token);
      continue;
    }
    if (token.length < MINIMUM_VOCABULARY_TOKEN_LENGTH) continue;
    if (FUNCTION_WORDS.has(token)) continue;
    collected.add(token);
    const singular = singularise(token);
    if (singular && singular.length >= MINIMUM_VOCABULARY_TOKEN_LENGTH) {
      collected.add(singular);
    }
  }
  return collected;
}

function collectOptionValues(
  product: SimilarityInput,
  matches: (optionName: string) => boolean,
): Set<string> {
  const collected = new Set<string>();
  for (const option of product.options ?? []) {
    if (!matches(option.name)) continue;
    for (const value of option.values) {
      collectVocabularyTokens(value).forEach((token) => collected.add(token));
    }
  }
  return collected;
}

/**
 * Every replacement term is read from the product's own record — its category slug, its
 * `specs` values, and its option values — rather than from a shared domain word list. Two
 * products therefore normalise against different vocabularies, which is the point: the
 * placeholder marks what that product specifically claims.
 */
export function buildNormalisationVocabulary(
  product: SimilarityInput,
): NormalisationVocabulary {
  return {
    category: collectVocabularyTokens(product.category.replace(/-/g, " ")),
    stone: collectVocabularyTokens(product.specs.stone),
    material: collectVocabularyTokens(product.specs.material),
    colour: collectOptionValues(product, (name) => /colou?r/i.test(name)),
    size: collectVocabularyTokens(product.specs.size),
  };
}

function classifyToken(
  token: string,
  vocabulary: NormalisationVocabulary,
): PlaceholderClass | null {
  for (const placeholderClass of PLACEHOLDER_PRECEDENCE) {
    if (vocabulary[placeholderClass].has(token)) return placeholderClass;
  }
  return /^\d+([.,]\d+)?$/.test(token) ? "size" : null;
}

/**
 * Returns the description as a normalised token string: every token the product's own
 * record identifies is replaced by its bracketed class, everything else survives verbatim.
 * What is left is the sentence skeleton, which is what template repetition lives in.
 */
export function normaliseDescription(
  description: string,
  vocabulary: NormalisationVocabulary,
): string {
  return tokenise(description)
    .map((token) => {
      const placeholderClass = classifyToken(token, vocabulary);
      return placeholderClass === null ? token : `<${placeholderClass}>`;
    })
    .join(" ");
}

export function normalisedSimilarity(
  left: SimilarityInput,
  right: SimilarityInput,
  shingleSize: number = SHINGLE_SIZE,
): number {
  return rawSimilarity(
    normaliseDescription(left.description, buildNormalisationVocabulary(left)),
    normaliseDescription(right.description, buildNormalisationVocabulary(right)),
    shingleSize,
  );
}

/**
 * The first sentence, capped at `OPENING_WORD_LIMIT` words. A description with no sentence
 * terminator falls back to its first `OPENING_WORD_LIMIT` words rather than to the whole
 * text, so the opening check never silently becomes a second whole-description check.
 */
export function extractOpeningSentence(
  description: string,
  wordLimit: number = OPENING_WORD_LIMIT,
): string {
  const trimmed = description.trim();
  const terminator = trimmed.search(/[.!?](\s|$)/);
  const firstSentence =
    terminator === -1 ? trimmed : trimmed.slice(0, terminator + 1);
  const words = firstSentence.split(/\s+/).filter((word) => word.length > 0);
  return words.slice(0, wordLimit).join(" ");
}

export function openingSentenceSimilarity(
  leftDescription: string,
  rightDescription: string,
): number {
  return rawSimilarity(
    extractOpeningSentence(leftDescription),
    extractOpeningSentence(rightDescription),
    OPENING_SHINGLE_SIZE,
  );
}

export function scoreProductPair(
  left: SimilarityInput,
  right: SimilarityInput,
): ProductPairScores {
  return {
    raw: rawSimilarity(left.description, right.description),
    normalised: normalisedSimilarity(left, right),
    opening: openingSentenceSimilarity(left.description, right.description),
  };
}

export function toSimilarityInput(product: Product): SimilarityInput {
  return {
    id: product.id,
    category: product.category,
    description: product.description,
    specs: product.specs,
    options: product.options,
  };
}

/**
 * The score at or below which a new description is allowed through. **`null` is the shipped
 * value and it means the gate is advisory**: every score is still computed and written to
 * `content-pipeline/drafts/{productId}-similarity.json`, and nothing is ever refused.
 *
 * It is `null` rather than a number because no number has been earned yet. The calibration
 * behind [ADR-053](/docs/decisions/ADR-053-draft-a-to-product-orchestration.md) ran against the
 * 49 products in this repository, which are the *survivors* of a hand-written catalogue pass
 * and not the population this gate will police — several hundred migrated listings whose copy
 * came off one old site. A threshold fitted to 49 hand-tuned descriptions would be a number
 * about the wrong catalogue, and a wrong number that blocks is worse than no number at all.
 *
 * Turning the gate on is this one assignment. Nothing else changes: the blocking path is
 * implemented, tested and exercised by `evaluateSimilarityGate` today.
 */
export const SIMILARITY_THRESHOLD: number | null = null;

export type SimilarityMeasure = keyof ProductPairScores;

/**
 * Checked in this order, and the first to hold the peak wins a tie. Raw leads because a raw
 * collision is the one a reader would notice unaided; `opening` is last because it is the
 * narrowest window and the easiest to score high by coincidence.
 */
export const SIMILARITY_MEASURE_PRECEDENCE: readonly SimilarityMeasure[] = [
  "raw",
  "normalised",
  "opening",
] as const;

export interface SimilarityPeak {
  measure: SimilarityMeasure;
  score: number;
}

export interface SimilarityComparison {
  againstProductId: string;
  scores: ProductPairScores;
  /** The highest of the three scores. This, and only this, is what a threshold is read against. */
  peak: SimilarityPeak;
}

export interface SimilarityGateReport {
  productId: string;
  /** Echoed into the report file so a stored result records which rule produced it. */
  threshold: number | null;
  /** True exactly when `threshold` is `null`. An advisory run can never set `blocked`. */
  advisory: boolean;
  blocked: boolean;
  comparedAgainst: number;
  /** Every comparison, highest peak first. Written whole, so a later calibration has the data. */
  comparisons: SimilarityComparison[];
  /** The comparisons whose peak sits above the threshold. Always empty on an advisory run. */
  exceeded: SimilarityComparison[];
}

export function peakScore(scores: ProductPairScores): SimilarityPeak {
  let peak: SimilarityPeak = { measure: "raw", score: scores.raw };
  for (const measure of SIMILARITY_MEASURE_PRECEDENCE) {
    if (scores[measure] > peak.score) peak = { measure, score: scores[measure] };
  }
  return peak;
}

/**
 * Scores one candidate against every entry it is given, excluding any record carrying the
 * candidate's own id so re-running the gate while rewriting a live description does not report
 * the product against itself.
 */
export function compareAgainstCatalogue(
  candidate: SimilarityInput,
  catalogue: readonly SimilarityInput[],
): SimilarityComparison[] {
  return catalogue
    .filter((entry) => entry.id !== candidate.id)
    .map((entry) => {
      const scores = scoreProductPair(candidate, entry);
      return { againstProductId: entry.id, scores, peak: peakScore(scores) };
    })
    .sort(
      (left, right) =>
        right.peak.score - left.peak.score ||
        left.againstProductId.localeCompare(right.againstProductId),
    );
}

/**
 * The gate itself. A comparison is refused only when its peak sits **strictly above** the
 * threshold: a score equal to the threshold passes, so a threshold of `1` reads as "refuse a
 * verbatim copy" rather than "refuse everything including a verbatim copy".
 */
export function evaluateSimilarityGate(
  candidate: SimilarityInput,
  catalogue: readonly SimilarityInput[],
  threshold: number | null = SIMILARITY_THRESHOLD,
): SimilarityGateReport {
  const comparisons = compareAgainstCatalogue(candidate, catalogue);
  const exceeded =
    threshold === null
      ? []
      : comparisons.filter((comparison) => comparison.peak.score > threshold);

  return {
    productId: candidate.id,
    threshold,
    advisory: threshold === null,
    blocked: exceeded.length > 0,
    comparedAgainst: comparisons.length,
    comparisons,
    exceeded,
  };
}

/** Every active record, as the gate's comparison population. Drafts are not live copy. */
export function selectActiveSimilarityInputs(
  catalogue: readonly Product[],
): SimilarityInput[] {
  return catalogue
    .filter((product) => product.status === "active")
    .map(toSimilarityInput);
}

export function describeSimilarityGate(report: SimilarityGateReport): string {
  const highest = report.comparisons[0];
  const headline =
    highest === undefined
      ? "no active product to compare against"
      : `highest ${highest.peak.measure} ${highest.peak.score.toFixed(3)} against ${highest.againstProductId}`;

  if (report.threshold === null) {
    return `ADVISORY (SIMILARITY_THRESHOLD is null, nothing blocks): ${headline}, across ${report.comparedAgainst} active product(s).`;
  }
  if (report.blocked) {
    return `BLOCKED at threshold ${report.threshold}: ${report.exceeded.length} comparison(s) above it, ${headline}.`;
  }
  return `PASS at threshold ${report.threshold}: ${headline}, across ${report.comparedAgainst} active product(s).`;
}
