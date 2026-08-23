/**
 * Mechanical validator for Draft A objects — the structured intermediate that
 * `.claude/skills/draft-a-skills.md` produces and ADR-051 records the design of.
 *
 * WHAT THIS FILE DOES NOT DO, stated first because an earlier design would have.
 * There is no allow-list membership check here. The skill's "always propose, always confirm"
 * revision removed the pre-approval gate on material, plating and stone phrases: every
 * candidate value now goes to owner review regardless of what any curated file says, so there
 * is nothing for a validator to check membership against. `data/material-phrases.json` is not
 * read, `data/stone-terms.json` is not read, and no phrase in any Draft A object is compared
 * against a vocabulary of permitted phrases. Whether "18K gold-plated stainless steel" is a
 * claim this shop will make is an owner decision made in review, and a script that tried to
 * answer it would be re-importing exactly the judgement the review step exists to hold.
 *
 * What is left is what a machine can actually decide: STRUCTURE and PROVENANCE.
 *
 * - Structure — is the object the shape the schema states, with the fields that must be empty
 *   at this stage actually empty. A populated price or a populated image list is not a
 *   difference of opinion, it is a phase-1 rule broken.
 * - Provenance — is every candidate carrying the source quote the owner needs in order to
 *   confirm it, and does that quote actually appear in the source text. The containment check
 *   in `checkQuotedPhraseContainment` is the load-bearing one: a model can invent a fluent
 *   quote as easily as it can invent a fluent claim, and an invented quote is worse than an
 *   invented claim because it reads as an audit trail.
 *
 * Two exported check functions, deliberately separate, run at two different moments:
 *
 * - `validateDraftA` — Parts A/B. "Did the extraction skill produce well-formed output?"
 *   Runs on the skill's output BEFORE any human has looked at it. Every attribute must be
 *   `confirmed: false` here, prices must be null, images must be empty.
 * - `validatePublishReadiness` — Part D. "Has review actually happened, and is this thing
 *   ready to become a product?" Runs much later, after owner review and after the separate
 *   manual image-assignment step. Its expectations are close to the inverse: confirmed true,
 *   a real price, at least one image.
 *
 * Only the first is wired to the CLI. The second is exported for the Phase 2 pipeline, which
 * is not designed yet (ADR-051, decision 5).
 */

import { globSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/**
 * The ten categories of ADR-020, which `types/product.ts` and `scripts/validate-products.mjs`
 * also hard-code. Duplicated rather than imported because this file must stay runnable as a
 * plain script over draft JSON with no application code loaded.
 */
const CATEGORY_SLUGS = [
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
];

const FLAGGED_CONTENT_TYPES = [
  "boilerplate-discarded",
  "review-markup-discarded",
  "brand-mismatch",
];

const SOURCE_ORIGINS = ["migrated-text", "owner-notes"];

const KNOWN_TRADE_TERM = "known-trade-term";

/**
 * Rule identifiers, printed with every finding so a failure can be fixed without reading this
 * file. The letter is the part of the specification, the number its rule within that part.
 */
const RULES = {
  category: "A1",
  pricingNull: "A2",
  imagesEmpty: "A3",
  personalized: "A4",
  flaggedContentType: "A5",
  attributeConfirmedFalse: "B1",
  sourcePairing: "B2",
  quotedPhraseContainment: "B3",
  tradeTermDisplayTerm: "B4",
  shape: "S1",
  postReviewConfirmed: "D1",
  postReviewCategory: "D2",
  postReviewPersonalized: "D3",
  postReviewImages: "D4",
  postReviewPrice: "D5",
};

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * How a value is shown inside a finding. Long source text is truncated because a finding is
 * read in a terminal, and a 4000-character `rawContent` printed in full buries the rule that
 * failed. Truncation is marked so nobody mistakes the ellipsis for the value.
 */
function describeValue(value) {
  if (value === undefined) return "undefined (field absent)";
  if (typeof value === "string") {
    const shown = value.length > 120 ? `${value.slice(0, 120)}…[truncated]` : value;
    return JSON.stringify(shown);
  }
  if (isPlainObject(value) || Array.isArray(value)) {
    const serialised = JSON.stringify(value);
    return serialised.length > 160 ? `${serialised.slice(0, 160)}…[truncated]` : serialised;
  }
  return JSON.stringify(value) ?? String(value);
}

function makeFinding(rule, field, value, message) {
  return { rule, field, value: describeValue(value), message };
}

/**
 * Whitespace normalisation for the containment check, applied identically to both sides.
 * Newlines, tabs and runs of spaces all collapse to one space, because a quote lifted out of a
 * marketplace export routinely differs from its source by exactly that and by nothing else.
 * Nothing else is normalised — no case folding, no punctuation stripping — since the point of
 * the check is that the phrase is verbatim, and a looser comparison would start accepting the
 * paraphrases it exists to catch.
 *
 * @param {string} text
 * @returns {string}
 */
export function normaliseWhitespace(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

/**
 * The provenance check that cannot be faked by fluency: does `quotedPhrase` actually occur
 * inside `rawContent`, allowing only for whitespace differences.
 *
 * Returns `{ checked: false }` when there is nothing to compare against — `rawContent` is
 * populated by pipeline code rather than by the skill (skill rule 14), so an object can legally
 * reach this validator without it. An absent source text is not evidence of a bad quote.
 *
 * @param {unknown} quotedPhrase
 * @param {unknown} rawContent
 * @returns {{ checked: boolean, contained: boolean }}
 */
export function checkQuotedPhraseContainment(quotedPhrase, rawContent) {
  if (!isNonEmptyString(quotedPhrase) || typeof rawContent !== "string") {
    return { checked: false, contained: false };
  }

  const normalisedPhrase = normaliseWhitespace(quotedPhrase);
  const normalisedSource = normaliseWhitespace(rawContent);
  if (normalisedPhrase.length === 0) return { checked: false, contained: false };

  return { checked: true, contained: normalisedSource.includes(normalisedPhrase) };
}

function checkCategory(draft, errors) {
  const { category } = draft;
  if (category === null) return;
  if (typeof category === "string" && CATEGORY_SLUGS.includes(category)) return;

  errors.push(
    makeFinding(
      RULES.category,
      "category",
      category,
      `category must be null or one of the ten fixed slugs: ${CATEGORY_SLUGS.join(", ")}`,
    ),
  );
}

/**
 * Phase 1 writes no money. A populated `price` or `mrp` means something upstream decided a
 * price without an owner deciding it, which is the one thing ADR-001 has never allowed and
 * skill rule 9 restates. `cost` and `referencePrice` are not checked here: `referencePrice` is
 * where price figures are *supposed* to be quarantined, as a descriptive string.
 */
function checkPricingIsUnset(draft, errors) {
  const pricing = draft.pricing;
  if (!isPlainObject(pricing)) {
    errors.push(
      makeFinding(RULES.pricingNull, "pricing", pricing, "pricing must be an object"),
    );
    return;
  }

  for (const field of ["price", "mrp"]) {
    if (pricing[field] !== null) {
      errors.push(
        makeFinding(
          RULES.pricingNull,
          `pricing.${field}`,
          pricing[field],
          `pricing.${field} must be null — this skill never writes real pricing, a price is always a separate explicit owner decision`,
        ),
      );
    }
  }
}

/**
 * Image assignment is a manual step that happens between Draft A creation and publish
 * readiness. At this stage both containers are empty, and a populated one means an image was
 * attached by something that had no business attaching it.
 */
function checkImagesAreEmpty(draft, errors) {
  const images = draft.images;
  if (!isPlainObject(images)) {
    errors.push(makeFinding(RULES.imagesEmpty, "images", images, "images must be an object"));
    return;
  }

  if (!Array.isArray(images.general) || images.general.length > 0) {
    errors.push(
      makeFinding(
        RULES.imagesEmpty,
        "images.general",
        images.general,
        "images.general must be an empty array — image assignment never happens in this skill",
      ),
    );
  }

  if (!isPlainObject(images.variantImages) || Object.keys(images.variantImages).length > 0) {
    errors.push(
      makeFinding(
        RULES.imagesEmpty,
        "images.variantImages",
        images.variantImages,
        "images.variantImages must be an empty object — image assignment never happens in this skill",
      ),
    );
  }
}

function checkPersonalized(draft, errors) {
  const { personalized } = draft;
  if (personalized === true || personalized === false || personalized === null) return;

  errors.push(
    makeFinding(
      RULES.personalized,
      "personalized",
      personalized,
      "personalized must be exactly true, false or null",
    ),
  );
}

function checkFlaggedContent(draft, errors) {
  const flaggedContent = draft.flaggedContent;
  if (flaggedContent === undefined) return;

  if (!Array.isArray(flaggedContent)) {
    errors.push(
      makeFinding(
        RULES.flaggedContentType,
        "flaggedContent",
        flaggedContent,
        "flaggedContent must be an array",
      ),
    );
    return;
  }

  flaggedContent.forEach((entry, index) => {
    const type = isPlainObject(entry) ? entry.type : undefined;
    if (typeof type === "string" && FLAGGED_CONTENT_TYPES.includes(type)) return;

    errors.push(
      makeFinding(
        RULES.flaggedContentType,
        `flaggedContent[${index}].type`,
        type,
        `flaggedContent type must be one of: ${FLAGGED_CONTENT_TYPES.join(", ")}`,
      ),
    );
  });
}

/**
 * Parts B1, B2, B3 and B4, walked once per attribute so a single entry's findings stay
 * together in the output.
 *
 * B1 is the one that reads backwards on first encounter: `confirmed: true` is a HARD FAILURE
 * here. This function validates the skill's output before any human has seen it, and an
 * attribute that already claims confirmation at that point is claiming a review that did not
 * happen. The opposite expectation lives in `validatePublishReadiness`.
 */
function checkAttributes(draft, errors, warnings) {
  const attributes = draft.attributes;
  if (attributes === undefined) {
    errors.push(
      makeFinding(
        RULES.shape,
        "attributes",
        attributes,
        "attributes must be present as an array",
      ),
    );
    return;
  }

  if (!Array.isArray(attributes)) {
    errors.push(
      makeFinding(RULES.shape, "attributes", attributes, "attributes must be an array"),
    );
    return;
  }

  const rawContent = isPlainObject(draft.sourceNotes) ? draft.sourceNotes.rawContent : undefined;

  attributes.forEach((attribute, index) => {
    const field = `attributes[${index}]`;

    if (!isPlainObject(attribute)) {
      errors.push(
        makeFinding(RULES.shape, field, attribute, "each attributes entry must be an object"),
      );
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(attribute, "confirmed")) {
      errors.push(
        makeFinding(
          RULES.attributeConfirmedFalse,
          `${field}.confirmed`,
          undefined,
          "confirmed must be present on every attribute",
        ),
      );
    } else if (attribute.confirmed !== false) {
      errors.push(
        makeFinding(
          RULES.attributeConfirmedFalse,
          `${field}.confirmed`,
          attribute.confirmed,
          "confirmed must be false at extraction time — nothing is confirmed before a human has looked at it",
        ),
      );
    }

    checkAttributeSource(attribute, field, rawContent, errors);
    checkTradeTermDisplayTerm(attribute, field, warnings);
  });
}

/**
 * B2 and B3. `source: null` is legal — an attribute can be a stray real fact with no quotable
 * origin (skill rule 16). What is not legal is a half-populated source: an origin with no
 * quote is a claim with no evidence, and a quote with no origin cannot say whether it came
 * from migrated text or from the owner's own notes, which is the distinction the fresh path
 * depends on.
 */
function checkAttributeSource(attribute, field, rawContent, errors) {
  const source = attribute.source;
  if (source === null || source === undefined) return;

  if (!isPlainObject(source)) {
    errors.push(
      makeFinding(RULES.sourcePairing, `${field}.source`, source, "source must be an object or null"),
    );
    return;
  }

  const { origin, quotedPhrase } = source;
  const originValid = typeof origin === "string" && SOURCE_ORIGINS.includes(origin);
  const quoteValid = isNonEmptyString(quotedPhrase);

  if (!originValid) {
    errors.push(
      makeFinding(
        RULES.sourcePairing,
        `${field}.source.origin`,
        origin,
        `source.origin must be present alongside source.quotedPhrase and be one of: ${SOURCE_ORIGINS.join(", ")}`,
      ),
    );
  }

  if (!quoteValid) {
    errors.push(
      makeFinding(
        RULES.sourcePairing,
        `${field}.source.quotedPhrase`,
        quotedPhrase,
        "source.quotedPhrase must be present alongside source.origin and be a non-empty string",
      ),
    );
  }

  if (!quoteValid) return;

  const containment = checkQuotedPhraseContainment(quotedPhrase, rawContent);
  if (containment.checked && !containment.contained) {
    errors.push(
      makeFinding(
        RULES.quotedPhraseContainment,
        `${field}.source.quotedPhrase`,
        quotedPhrase,
        "quotedPhrase does not appear verbatim in sourceNotes.rawContent after whitespace normalisation — the quote was invented or paraphrased, which makes the provenance trail a fake",
      ),
    );
  }
}

/**
 * B4, the only warning in Parts A/B. A trade-term match means the lookup found a name to
 * record, so a match with no `displayTerm` suggests the lookup wrote half its result — worth a
 * look at the code rather than at the product. Not a hard failure, because the attribute's
 * value can still be correct and the owner still confirms it either way.
 */
function checkTradeTermDisplayTerm(attribute, field, warnings) {
  if (attribute.stoneSource !== KNOWN_TRADE_TERM) return;
  if (isNonEmptyString(attribute.displayTerm)) return;

  warnings.push(
    makeFinding(
      RULES.tradeTermDisplayTerm,
      `${field}.displayTerm`,
      attribute.displayTerm,
      `stoneSource is "${KNOWN_TRADE_TERM}" but displayTerm is missing — a trade-term match implies there was a trade name to record, so the stone-terms.json lookup may have a bug`,
    ),
  );
}

/**
 * Parts A and B: did the extraction skill produce well-formed output?
 *
 * This is NOT a publish-readiness check. It runs on the skill's output at the moment it is
 * produced, before review, and it deliberately fails objects that look "more finished" than
 * they should — a confirmed attribute, a real price, an attached image.
 *
 * @param {unknown} draft
 * @param {{ label?: string }} [options]
 * @returns {{ productId: string | null, label: string, errors: Array<{ rule: string, field: string, value: string, message: string }>, warnings: Array<{ rule: string, field: string, value: string, message: string }> }}
 */
export function validateDraftA(draft, options = {}) {
  const label = options.label ?? "(unnamed object)";
  const errors = [];
  const warnings = [];

  if (!isPlainObject(draft)) {
    return {
      productId: null,
      label,
      errors: [makeFinding(RULES.shape, "(root)", draft, "a Draft A object must be a JSON object")],
      warnings,
    };
  }

  checkCategory(draft, errors);
  checkPricingIsUnset(draft, errors);
  checkImagesAreEmpty(draft, errors);
  checkPersonalized(draft, errors);
  checkFlaggedContent(draft, errors);
  checkAttributes(draft, errors, warnings);

  return {
    productId: typeof draft.productId === "string" ? draft.productId : null,
    label,
    errors,
    warnings,
  };
}

/**
 * Part D. THE PUBLISH-READINESS CHECK, and a different question from `validateDraftA`.
 *
 * `validateDraftA` asks "did the extraction skill produce well-formed output?" and runs before
 * a human has seen the object. This function asks "has the owner's review actually happened,
 * and is there enough here to become a real product?" and runs after it. The two are not
 * stricter and looser versions of each other — on three fields they expect opposite things,
 * and that is the design rather than a contradiction:
 *
 * | Field | validateDraftA (pre-review) | validatePublishReadiness (post-review) |
 * | --- | --- | --- |
 * | `attributes[].confirmed` | must be `false` | must be `true` |
 * | `pricing.price` | must be `null` | must be a positive number |
 * | `images.general` | must be empty | must hold at least one entry |
 *
 * Image assignment and pricing are separate manual steps that happen *between* the two checks,
 * which is why a value that is a hard failure in the first is a hard requirement in the second.
 *
 * It is not wired to the CLI on purpose. The Phase 2 pipeline that would call it — owner review
 * and promotion into `data/products.json` — is not designed yet (ADR-051, decision 5), and
 * running it over freshly extracted drafts would fail every one of them by design.
 *
 * This function does not re-run Parts A and B. An object reaching publish readiness is expected
 * to have passed `validateDraftA` when it was created; the checks that still hold at both ends
 * of review — the source pairing, the quote containment — are worth running again by calling
 * both functions, which a Phase 2 caller can do.
 *
 * @param {unknown} draft
 * @param {{ label?: string }} [options]
 * @returns {{ productId: string | null, label: string, errors: Array<{ rule: string, field: string, value: string, message: string }>, warnings: Array<{ rule: string, field: string, value: string, message: string }> }}
 */
export function validatePublishReadiness(draft, options = {}) {
  const label = options.label ?? "(unnamed object)";
  const errors = [];
  const warnings = [];

  if (!isPlainObject(draft)) {
    return {
      productId: null,
      label,
      errors: [makeFinding(RULES.shape, "(root)", draft, "a Draft A object must be a JSON object")],
      warnings,
    };
  }

  const attributes = draft.attributes;
  if (!Array.isArray(attributes)) {
    errors.push(
      makeFinding(RULES.shape, "attributes", attributes, "attributes must be an array"),
    );
  } else {
    attributes.forEach((attribute, index) => {
      const confirmed = isPlainObject(attribute) ? attribute.confirmed : undefined;
      if (confirmed === true) return;

      errors.push(
        makeFinding(
          RULES.postReviewConfirmed,
          `attributes[${index}].confirmed`,
          confirmed,
          "every attribute must be confirmed: true before publish — an unconfirmed candidate has not been through owner review",
        ),
      );
    });
  }

  const { category } = draft;
  if (!(typeof category === "string" && CATEGORY_SLUGS.includes(category))) {
    errors.push(
      makeFinding(
        RULES.postReviewCategory,
        "category",
        category,
        `category must be non-null and one of the ten fixed slugs before publish: ${CATEGORY_SLUGS.join(", ")}`,
      ),
    );
  }

  const { personalized } = draft;
  if (personalized !== true && personalized !== false) {
    errors.push(
      makeFinding(
        RULES.postReviewPersonalized,
        "personalized",
        personalized,
        "personalized must be resolved to true or false before publish — null means the question is still open",
      ),
    );
  }

  const general = isPlainObject(draft.images) ? draft.images.general : undefined;
  if (!Array.isArray(general) || general.length === 0) {
    errors.push(
      makeFinding(
        RULES.postReviewImages,
        "images.general",
        general,
        "images.general must hold at least one image before publish — image assignment is the manual step between Draft A creation and this check",
      ),
    );
  }

  const price = isPlainObject(draft.pricing) ? draft.pricing.price : undefined;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    errors.push(
      makeFinding(
        RULES.postReviewPrice,
        "pricing.price",
        price,
        "pricing.price must be a positive number before publish — the owner's explicit price decision",
      ),
    );
  }

  return {
    productId: typeof draft.productId === "string" ? draft.productId : null,
    label,
    errors,
    warnings,
  };
}

/**
 * Turns one command-line argument into a list of JSON file paths. A directory is read
 * recursively for `*.json`; anything else is handed to `globSync`, which covers both a literal
 * file path and a pattern like `drafts/P0*.json`.
 *
 * @param {string} target
 * @returns {string[]}
 */
export function resolveBatchFiles(target) {
  let stats = null;
  try {
    stats = statSync(target);
  } catch {
    stats = null;
  }

  if (stats?.isDirectory()) {
    return collectJsonFilesRecursively(target).sort();
  }

  if (stats?.isFile()) {
    return [target];
  }

  return globSync(target)
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

function collectJsonFilesRecursively(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectJsonFilesRecursively(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      found.push(path);
    }
  }
  return found;
}

/**
 * How a file is named in the output. Repository-relative where that is shorter and clearer,
 * and left as given when the path sits outside the repository, since a relative path that
 * climbs out through `../..` is harder to read than the original.
 *
 * @param {string} path
 * @returns {string}
 */
export function describeBatchFilePath(path) {
  const fromRepoRoot = relative(REPO_ROOT, path);
  if (fromRepoRoot.length === 0) return basename(path);
  if (fromRepoRoot.startsWith("..")) return path;
  return fromRepoRoot;
}

/**
 * Reads one file into the Draft A objects it holds. A batch file may be a single object or an
 * array of them; both are common ways to hand a run's output around, and labelling an array
 * element by its index keeps a finding traceable to a position in the file even when the object
 * has no `productId` yet.
 *
 * @param {string} path
 * @returns {{ objects: Array<{ value: unknown, label: string }>, parseError: string | null }}
 */
export function readBatchFile(path) {
  const label = describeBatchFilePath(path);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { objects: [], parseError: `${label}: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (Array.isArray(parsed)) {
    return {
      objects: parsed.map((value, index) => ({ value, label: `${label}#${index}` })),
      parseError: null,
    };
  }

  return { objects: [{ value: parsed, label }], parseError: null };
}

/**
 * Runs the Parts A/B check across a whole batch and returns the per-object results plus the
 * counts the summary prints. Pure over the filesystem read, so the reporting shape is testable
 * without a terminal.
 *
 * @param {Array<{ value: unknown, label: string }>} objects
 * @returns {{ results: ReturnType<typeof validateDraftA>[], checked: number, passedClean: number, failed: number, withWarnings: number }}
 */
export function validateBatch(objects) {
  const results = objects.map(({ value, label }) => validateDraftA(value, { label }));

  return {
    results,
    checked: results.length,
    passedClean: results.filter((r) => r.errors.length === 0 && r.warnings.length === 0).length,
    failed: results.filter((r) => r.errors.length > 0).length,
    withWarnings: results.filter((r) => r.warnings.length > 0).length,
  };
}

/**
 * One finding, over three lines: the rule and the offending field with its value, the rule in
 * words, and the productId. Everything needed to fix an extraction run without coming back to
 * this file or to the task that specified it.
 *
 * @param {{ rule: string, field: string, value: string, message: string }} finding
 * @param {"error" | "warning"} severity
 * @param {string | null} productId
 * @returns {string}
 */
export function formatFinding(finding, severity, productId) {
  const marker = severity === "warning" ? "warning" : "error  ";
  return [
    `      ${marker} ${finding.rule}  ${finding.field} = ${finding.value}`,
    `              ${finding.message}`,
    `              productId: ${productId ?? "(none)"}`,
  ].join("\n");
}

function printResult(result) {
  const status = result.errors.length > 0 ? "FAIL" : result.warnings.length > 0 ? "WARN" : "PASS";
  const id = result.productId ?? "(no productId)";
  console.log(`  ${status}  ${id.padEnd(12)} ${result.label}`);

  for (const error of result.errors) console.log(formatFinding(error, "error", result.productId));
  for (const warning of result.warnings) {
    console.log(formatFinding(warning, "warning", result.productId));
  }
}

function runCli(argv) {
  const target = argv[0];
  if (!target) {
    console.error("Usage: node scripts/validate-draft-a.mjs <directory | glob>");
    console.error("  Validates Draft A extraction output — structure and provenance only.");
    return 2;
  }

  const files = resolveBatchFiles(target);
  if (files.length === 0) {
    console.error(`No JSON files matched: ${target}`);
    return 2;
  }

  const objects = [];
  const parseErrors = [];
  for (const file of files) {
    const { objects: fileObjects, parseError } = readBatchFile(file);
    if (parseError) parseErrors.push(parseError);
    objects.push(...fileObjects);
  }

  const summary = validateBatch(objects);

  console.log("Draft A validation — structure and provenance only, no phrase allow-list");
  console.log(`Target: ${target} (${files.length} file(s))\n`);

  for (const result of summary.results) printResult(result);

  if (parseErrors.length > 0) {
    console.error(`\nUNREADABLE — ${parseErrors.length} file(s) are not valid JSON:`);
    for (const parseError of parseErrors) console.error(`  - ${parseError}`);
  }

  console.log("\nBatch summary");
  console.log(`  objects checked   ${summary.checked}`);
  console.log(`  passed clean      ${summary.passedClean}`);
  console.log(`  failed (hard)     ${summary.failed}`);
  console.log(`  with warnings     ${summary.withWarnings}`);

  if (summary.failed > 0 || parseErrors.length > 0) {
    console.error("\nFAIL — Draft A objects violate structure or provenance rules.");
    return 1;
  }

  console.log("\nPASS — every Draft A object is well-formed and its provenance checks out.");
  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(runCli(process.argv.slice(2)));
}
