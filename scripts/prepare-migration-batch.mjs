/**
 * Stage 0 of the Odoo migration — deterministic batch preparation, and nothing else.
 *
 * WHAT THIS FILE DOES NOT DO, stated first because the name invites the assumption.
 * It does not run Draft A extraction. It never loads `.claude/skills/draft-a-skills.md`,
 * `product-skills.md` or `meta-skills.md`, it produces no Draft A object, it proposes no
 * material, plating or stone candidate, and it writes to neither `data/products.json` nor
 * `data/keyword-map.json`. Extraction is a separate, human-supervised, Claude-driven step run
 * afterward over the queue this script builds, in reviewable sub-batches. The two are separated
 * on purpose: everything here is a decision a machine can make identically twice, and everything
 * there is a judgement that has to be read by a person. See ADR-054.
 *
 * What it does, in four parts:
 *
 * - A — Ingest a Phase B JSONL export and validate every record. A record that fails is written
 *   to `needs-attention.md` with the field and the reason. It is never silently dropped and
 *   never silently carried through as if it had passed.
 * - B — Assign real sequential productIds from P101, in a stable order, and write the
 *   `raw-block.json` whose existence IS the id reservation (ADR-051 decision 4, as reconciled in
 *   `content-pipeline/drafts/README.md`).
 * - C — Transform the Odoo variant and image shapes into this project's shapes. Image paths are
 *   SUGGESTIONS carrying their source provenance, not confirmations.
 * - D — Emit a manifest and the register rows for `docs/pipeline-prep/drafts-in-progress.md` at
 *   the new `queued` stage.
 *
 * Every decision function below is pure — it takes already-parsed JSON and returns a plain
 * object — so `lib/prepare-migration-batch.test.ts` can exercise the whole mechanism with no
 * batch on disk. The filesystem lives in `runCli` and in the two writer helpers it calls.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/**
 * The eleven category slugs this batch may carry — the ten of ADR-020 plus `gift-hampers`.
 * `types/product.ts`, `scripts/validate-products.mjs` and `scripts/validate-draft-a.mjs` all
 * hard-code the same eleven; `lib/category-vocabulary.test.ts` is what keeps the four lists from
 * drifting apart. Duplicated rather than imported so this file stays runnable as plain ESM.
 *
 * When Stage 0 was built, `gift-hampers` was accepted here and by nothing downstream, and a
 * record carrying it was queued with a warning. [ADR-055](../docs/decisions/ADR-055-category-vocabulary-and-surfacing.md)
 * closed that gap: the slug is now valid everywhere, so the warning is gone. Whether a shopper
 * can *browse* a category is a separate, storefront-side question — see `SURFACED_CATEGORIES`
 * in `types/product.ts` — and none of this script's business.
 */
export const MIGRATION_CATEGORY_SLUGS = [
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
  "gift-hampers",
];

/**
 * Below this many characters of trimmed `rawContent` there is not enough source text for
 * extraction to quote anything, so the record is a stub. A stub is allowed through only when the
 * export says so explicitly with `knownStub: true`; an unflagged short record is a data fault,
 * not a small product.
 */
export const KNOWN_STUB_MAX_CONTENT_LENGTH = 50;

/** The first id this batch assigns. The P050–P100 gap is deliberate — see ADR-054. */
export const MIGRATION_ID_START = 101;

/**
 * The highest id `data/products.json` may already hold for this script to run at all. P049 is
 * the catalogue's real maximum today; anything at or above P050 means either the script has
 * already run or the catalogue is not in the state this one-time override was written against.
 */
export const CATALOGUE_MAX_ID_CEILING = 49;

/** The register stage Stage 0 writes. Earlier than `extracted`, because extraction has not run. */
export const QUEUED_STAGE = "queued";

const PRODUCT_ID_PATTERN = /^P(\d{3,})$/;

/** @param {number} numericId */
export function formatProductId(numericId) {
  return `P${String(numericId).padStart(3, "0")}`;
}

/** @param {unknown} value @returns {number | null} */
export function parseProductId(value) {
  if (typeof value !== "string") return null;
  const match = PRODUCT_ID_PATTERN.exec(value);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * PART B, the safety check. The highest numeric productId in the catalogue, or 0 for an empty
 * one. A record whose `id` is not a `PNNN` string is a catalogue fault rather than something to
 * step over quietly, so it throws.
 *
 * @param {unknown} products
 * @returns {number}
 */
export function readMaxCatalogueProductId(products) {
  if (!Array.isArray(products)) {
    throw new Error("data/products.json must be an array of product records");
  }
  let max = 0;
  for (const [index, product] of products.entries()) {
    const id = product && typeof product === "object" ? product.id : undefined;
    const numericId = parseProductId(id);
    if (numericId === null) {
      throw new Error(
        `data/products.json[${index}] has id ${JSON.stringify(id)}, which is not a PNNN product id`,
      );
    }
    if (numericId > max) max = numericId;
  }
  return max;
}

/**
 * PART B, decision 5. Refuses to proceed unless the catalogue is in the exact state this
 * one-time override was written against. It fails loudly and it does not offer a flag to
 * override the override: a second run would assign a second product the same id, and an id with
 * two products behind it is the one defect ADR-051 decision 4 exists to prevent.
 *
 * @param {unknown} products
 * @returns {{ maxId: number, maxProductId: string }}
 */
export function assertCatalogueBelowOverrideFloor(products) {
  const maxId = readMaxCatalogueProductId(products);
  if (maxId > CATALOGUE_MAX_ID_CEILING) {
    throw new Error(
      [
        `REFUSING TO RUN — data/products.json's maximum product id is ${formatProductId(maxId)}.`,
        `This script is a one-time override that assigns ids from ${formatProductId(MIGRATION_ID_START)},`,
        `and it is only safe while the catalogue's maximum is ${formatProductId(CATALOGUE_MAX_ID_CEILING)} or lower.`,
        "A higher maximum means either this batch has already been prepared and published, or the",
        "catalogue is not in the state the override was written against. Either way the sequence is",
        "no longer the sequence this script assumes, and assigning ids on top of it would reuse",
        "numbers that are already spoken for. Re-read ADR-054 before changing anything here.",
      ].join(" "),
    );
  }
  return { maxId, maxProductId: formatProductId(maxId) };
}

/** @param {unknown} value */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The originalId as a string, used for ordering, for the image directory name and for the
 * needs-attention report. Numbers and numeric strings both occur in Odoo exports.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function readOriginalId(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isNonEmptyString(value)) return value.trim();
  return null;
}

/**
 * THE SOURCE SHAPE, and why every read below goes through a named accessor.
 *
 * Stage 0 was written against the schema ADR-054 said the Phase B export would have — every
 * provenance field at the top level, `images.main` a filename string, variant options in a
 * deduplicated top-level `attributes[]`. The export that actually arrived nests the provenance
 * under `sourceNotes`, names the image block `sourceImages`, makes `main` and `extras[]` objects
 * rather than strings, and expresses variant options as a per-variant combination list in
 * `variants[].attributes[]` while leaving top-level `attributes` an empty array in all 542
 * records.
 *
 * The reconciliation in `docs/testing/RESULT-2026-08-23-stage0-real-data-reconciliation.md`
 * measured the whole difference. Three of the mismatches rejected every record loudly; four more
 * would have written a wrong value into `raw-block.json` and exited 0. Reading through named
 * accessors rather than through inline property chains is what makes the second kind visible:
 * there is one place per field where the real path is stated, and `lib/prepare-migration-batch.test.ts`
 * pins each one against a fixture that now carries the real shape. See ADR-054's addendum.
 */

/** @param {unknown} record @returns {Record<string, unknown>} */
function readSourceNotes(record) {
  return isPlainObject(record) && isPlainObject(record.sourceNotes) ? record.sourceNotes : {};
}

/** @param {unknown} record @returns {Record<string, unknown> | null} */
function readSourceImages(record) {
  if (!isPlainObject(record)) return null;
  return isPlainObject(record.sourceImages) ? record.sourceImages : null;
}

/** @param {unknown} record @returns {Record<string, unknown>[]} */
function readVariantEntries(record) {
  if (!isPlainObject(record) || !Array.isArray(record.variants)) return [];
  return record.variants.filter(isPlainObject);
}

/**
 * The `{attribute, value}` pairs one variant combination carries. This is where the real export
 * keeps its option data; top-level `attributes[]` is empty in every record and is never read as a
 * variant source.
 *
 * @param {unknown} variant
 * @returns {{attribute: string, value: string}[]}
 */
function readVariantAttributePairs(variant) {
  if (!isPlainObject(variant) || !Array.isArray(variant.attributes)) return [];
  return variant.attributes
    .filter((pair) => isPlainObject(pair) && isNonEmptyString(pair.attribute) && isNonEmptyString(pair.value))
    .map((pair) => ({ attribute: pair.attribute.trim(), value: pair.value.trim() }));
}

/** @param {unknown} record @returns {string | null} */
function readRawContent(record) {
  const { rawContent } = readSourceNotes(record);
  return typeof rawContent === "string" ? rawContent : null;
}

/** @param {unknown} record @returns {string | null} */
function readRawHtml(record) {
  const { rawHtml } = readSourceNotes(record);
  return typeof rawHtml === "string" ? rawHtml : null;
}

/** @param {unknown} record @returns {string | null} */
function readReferencePrice(record) {
  if (!isPlainObject(record) || !isPlainObject(record.pricing)) return null;
  const { referencePrice } = record.pricing;
  return typeof referencePrice === "string" ? referencePrice : null;
}

/** @param {unknown} sourceImages @returns {string} */
function readMainImageFile(sourceImages) {
  if (isPlainObject(sourceImages) && isPlainObject(sourceImages.main) && isNonEmptyString(sourceImages.main.file)) {
    return sourceImages.main.file.trim();
  }
  return "main.webp";
}

/** @param {unknown} sourceImages @returns {string[]} */
function readExtraImageFiles(sourceImages) {
  if (!isPlainObject(sourceImages) || !Array.isArray(sourceImages.extras)) return [];
  return sourceImages.extras
    .filter((extra) => isPlainObject(extra) && isNonEmptyString(extra.file))
    .map((extra) => extra.file.trim());
}

/** @param {unknown} sourceImages @returns {Record<string, unknown>[]} */
function readVariantImageEntries(sourceImages) {
  if (!isPlainObject(sourceImages) || !Array.isArray(sourceImages.variants)) return [];
  return sourceImages.variants.filter(isPlainObject);
}

/**
 * PART C, the join the variant-image map cannot be built without.
 *
 * `sourceImages.variants[]` carries a `variantId` and a `value` but no attribute name, and the
 * Draft A image map is keyed `OptionName:Value`. The name is recovered by finding the variant the
 * image belongs to and taking the attribute whose value the image entry names. It is a real join,
 * not an assumption: it returns `null` when the variant is absent or when no pair on it carries
 * that value, and `validateSourceRecord` refuses the record rather than keying the map by
 * `undefined`.
 *
 * @param {unknown} record
 * @param {unknown} variantImage
 * @returns {string | null}
 */
export function resolveVariantImageAttribute(record, variantImage) {
  if (!isPlainObject(variantImage)) return null;
  const variant = readVariantEntries(record).find((entry) => entry.variantId === variantImage.variantId);
  if (variant === undefined) return null;
  const match = readVariantAttributePairs(variant).find((pair) => pair.value === variantImage.value);
  return match === undefined ? null : match.attribute;
}

/**
 * The working id the batch's image directory is named after. The export states it, and Stage 0
 * derives the same string from `sourceNotes.originalId`; the reconciliation confirmed the two are
 * identical in all 542 records. It is derived rather than read so a record with no `workingId` —
 * the shape ADR-054 was written against — still resolves to a directory.
 *
 * @param {string} originalId
 */
export function workingIdFor(originalId) {
  return `odoo-${originalId}`;
}

/**
 * PART A, decision I-4. The set of records the operator has decided to accept despite failing the
 * sub-50-character stub check.
 *
 * The export has no `knownStub` field — the key appears nowhere in the real file — so there is no
 * way for the exporter to say "this one is genuinely short, take it anyway". Until it grows one,
 * that statement is made on the command line and nowhere else. It is a deliberate manual
 * override: naming an id here is a person taking responsibility for a record extraction will have
 * nothing to quote from, and the record is still queued with a warning that says so.
 *
 * Ids may be given as working ids (`odoo-817`) or as bare originalIds (`817`); both forms are
 * accepted so the list can be pasted from either the export or the needs-attention report.
 *
 * @param {unknown} value
 * @returns {Set<string>}
 */
export function parseKnownStubIds(value) {
  const ids = new Set();
  if (!isNonEmptyString(value)) return ids;
  for (const token of value.split(/[\s,]+/)) {
    const id = token.trim();
    if (id.length > 0) ids.add(id);
  }
  return ids;
}

/**
 * Whether the operator named this record on `--known-stub-ids`, in either accepted form.
 *
 * @param {Set<string>} knownStubIds
 * @param {string | null} originalId
 */
function isKnownStubOverride(knownStubIds, originalId) {
  if (originalId === null) return false;
  return knownStubIds.has(originalId) || knownStubIds.has(workingIdFor(originalId));
}

/**
 * The path the batch's downloader is expected to have written the main photograph to. Relative
 * to the incoming root so a test can point the whole run at a temporary directory.
 *
 * @param {string} batchId
 * @param {string} originalId
 * @param {string} fileName
 */
export function sourceImagePath(batchId, originalId, fileName) {
  return join(batchId, `odoo-${originalId}`, "raw", fileName);
}

/**
 * PART A. Validates one source record and returns every fault it has rather than the first —
 * a record with a bad category and a missing image should be fixed once, not twice.
 *
 * `imageExists` is injected rather than called directly so the whole check is pure.
 *
 * @param {unknown} record
 * @param {{ batchId: string, index: number, imageExists: (relativePath: string) => boolean, knownStubIds?: Set<string> }} context
 * @returns {{ ok: boolean, originalId: string | null, line: number, failures: {field: string, reason: string}[], warnings: {field: string, reason: string}[] }}
 */
export function validateSourceRecord(record, context) {
  const line = context.index + 1;
  const knownStubIds = context.knownStubIds ?? new Set();
  /** @type {{field: string, reason: string}[]} */
  const failures = [];
  /** @type {{field: string, reason: string}[]} */
  const warnings = [];

  if (!isPlainObject(record)) {
    return {
      ok: false,
      originalId: null,
      line,
      failures: [{ field: "(record)", reason: "not a JSON object" }],
      warnings,
    };
  }

  const originalId = readOriginalId(readSourceNotes(record).originalId);
  if (originalId === null) {
    failures.push({
      field: "sourceNotes.originalId",
      reason: "missing — it orders the batch and names the image directory, so nothing can proceed without it",
    });
  }

  const { category } = record;
  if (category !== null && category !== undefined) {
    if (typeof category !== "string" || !MIGRATION_CATEGORY_SLUGS.includes(category)) {
      failures.push({
        field: "category",
        reason: `${JSON.stringify(category)} is not null and not one of the eleven fixed slugs: ${MIGRATION_CATEGORY_SLUGS.join(", ")}`,
      });
    }
  }

  const { subcategory } = record;
  if (subcategory !== null && subcategory !== undefined && !isNonEmptyString(subcategory)) {
    failures.push({
      field: "subcategory",
      reason: `${JSON.stringify(subcategory)} is present but is not a non-empty string — omit it or set it to null instead`,
    });
  }

  const rawContent = readRawContent(record);
  const rawContentLength = rawContent === null ? 0 : rawContent.trim().length;
  const isStub = rawContentLength < KNOWN_STUB_MAX_CONTENT_LENGTH;
  const acceptedAsKnownStub = record.knownStub === true || isKnownStubOverride(knownStubIds, originalId);
  if (isStub && !acceptedAsKnownStub) {
    failures.push({
      field: "sourceNotes.rawContent",
      reason:
        rawContentLength === 0
          ? "absent or empty, and the record is not named on --known-stub-ids"
          : `only ${rawContentLength} characters of source text, under the ${KNOWN_STUB_MAX_CONTENT_LENGTH}-character stub threshold, and the record is not named on --known-stub-ids`,
    });
  }
  if (isStub && acceptedAsKnownStub) {
    warnings.push({
      field: "sourceNotes.rawContent",
      reason: `accepted as a knownStub with ${rawContentLength} characters — extraction will have nothing to quote, so this one needs owner-supplied copy before Draft A`,
    });
  }

  const variantFailures = collectVariantShapeFailures(record);
  failures.push(...variantFailures);

  const imageFailures = collectImageShapeFailures(record, variantFailures.length === 0);
  failures.push(...imageFailures);
  if (imageFailures.length === 0 && originalId !== null) {
    for (const { field, file } of collectReferencedImageFiles(record)) {
      const relativePath = sourceImagePath(context.batchId, originalId, file);
      if (!context.imageExists(relativePath)) {
        failures.push({
          field,
          reason: `no file on disk at content-pipeline/incoming/${relativePath}`,
        });
      }
    }
  }

  const attributeFailure = validateAttributeShape(record.attributes);
  if (attributeFailure !== null) {
    failures.push(attributeFailure);
  } else if (Array.isArray(record.attributes) && record.attributes.length > 0) {
    warnings.push({
      field: "attributes",
      reason:
        "populated, and Stage 0 does not read it — variant options are taken from variants[].attributes[]. " +
        "It is empty in every record of the real export; a populated one means the export shape has changed",
    });
  }

  return { ok: failures.length === 0, originalId, line, failures, warnings };
}

/**
 * PART A. The `variants[]` shape, checked before anything tries to join against it. A malformed
 * pair here is what would otherwise surface as a variant-image key of `undefined:B`.
 *
 * @param {Record<string, unknown>} record
 * @returns {{field: string, reason: string}[]}
 */
function collectVariantShapeFailures(record) {
  if (record.variants === undefined || record.variants === null) return [];
  if (!Array.isArray(record.variants)) {
    return [{ field: "variants", reason: "present but not an array" }];
  }
  const failures = [];
  for (const [index, variant] of record.variants.entries()) {
    if (!isPlainObject(variant)) {
      failures.push({ field: `variants[${index}]`, reason: "not an object" });
      continue;
    }
    if (variant.attributes === undefined || variant.attributes === null) continue;
    if (!Array.isArray(variant.attributes)) {
      failures.push({ field: `variants[${index}].attributes`, reason: "present but not an array" });
      continue;
    }
    for (const [pairIndex, pair] of variant.attributes.entries()) {
      if (!isPlainObject(pair) || !isNonEmptyString(pair.attribute) || !isNonEmptyString(pair.value)) {
        failures.push({
          field: `variants[${index}].attributes[${pairIndex}]`,
          reason: "each entry needs a non-empty attribute and value",
        });
      }
    }
  }
  return failures;
}

/**
 * PART A. The `sourceImages` shape, including the one check that is not a shape check at all:
 * that every variant image can be joined back to an attribute name. The map Draft A reads is
 * keyed `OptionName:Value`, and a record whose join fails has no honest key to offer.
 *
 * The join is only attempted when `variants[]` itself validated — reporting an unjoinable image
 * on top of the malformed variant that caused it would name the same fault twice.
 *
 * @param {Record<string, unknown>} record
 * @param {boolean} variantsAreWellFormed
 * @returns {{field: string, reason: string}[]}
 */
function collectImageShapeFailures(record, variantsAreWellFormed) {
  const sourceImages = readSourceImages(record);
  if (sourceImages === null) {
    return [{ field: "sourceImages", reason: "missing or not an object" }];
  }

  const failures = [];
  if (!isPlainObject(sourceImages.main) || !isNonEmptyString(sourceImages.main.file)) {
    failures.push({
      field: "sourceImages.main",
      reason: "missing — it must be an object carrying a non-empty file name",
    });
  }

  if (sourceImages.extras !== undefined && !Array.isArray(sourceImages.extras)) {
    failures.push({ field: "sourceImages.extras", reason: "present but not an array" });
  } else {
    for (const [index, extra] of (sourceImages.extras ?? []).entries()) {
      if (!isPlainObject(extra) || !isNonEmptyString(extra.file)) {
        failures.push({
          field: `sourceImages.extras[${index}]`,
          reason: "each entry needs a non-empty file name",
        });
      }
    }
  }

  if (sourceImages.variants !== undefined && !Array.isArray(sourceImages.variants)) {
    failures.push({ field: "sourceImages.variants", reason: "present but not an array" });
    return failures;
  }
  for (const [index, variantImage] of (sourceImages.variants ?? []).entries()) {
    if (
      !isPlainObject(variantImage) ||
      !isNonEmptyString(variantImage.value) ||
      !isNonEmptyString(variantImage.file)
    ) {
      failures.push({
        field: `sourceImages.variants[${index}]`,
        reason: "each entry needs a non-empty value and file",
      });
      continue;
    }
    if (variantsAreWellFormed && resolveVariantImageAttribute(record, variantImage) === null) {
      failures.push({
        field: `sourceImages.variants[${index}].variantId`,
        reason:
          `${JSON.stringify(variantImage.variantId)} does not join to any variants[] entry carrying ` +
          `the value ${JSON.stringify(variantImage.value)}, so the option name behind this image cannot be recovered`,
      });
    }
  }
  return failures;
}

/**
 * PART A, finding I-5. Every image file the record actually names, so existence is checked against
 * the record's own values rather than against a literal.
 *
 * The old check probed the hardcoded string `"main.webp"` and looked at nothing else. It agreed
 * with the record only because every `sourceImages.main.file` in this batch happens to be
 * `main.webp`, and it left all 483 extras and all 50 variant images unchecked — a suggestion could
 * point at a file that was never downloaded and Stage 0 would queue it without a word.
 *
 * @param {Record<string, unknown>} record
 * @returns {{field: string, file: string}[]}
 */
function collectReferencedImageFiles(record) {
  const sourceImages = readSourceImages(record);
  const files = [{ field: "sourceImages.main", file: readMainImageFile(sourceImages) }];
  for (const [index, file] of readExtraImageFiles(sourceImages).entries()) {
    files.push({ field: `sourceImages.extras[${index}]`, file });
  }
  for (const [index, variantImage] of readVariantImageEntries(sourceImages).entries()) {
    if (isNonEmptyString(variantImage.file)) {
      files.push({ field: `sourceImages.variants[${index}]`, file: variantImage.file.trim() });
    }
  }
  return files;
}

/**
 * The top-level `attributes[]` of the schema ADR-054 was written against. The real export leaves it
 * an empty array in every record, which is a correctly-empty array rather than a missing variant
 * source — the options live in `variants[].attributes[]`. This still validates the old shape so a
 * malformed one is reported rather than ignored.
 *
 * @param {unknown} attributes
 */
function validateAttributeShape(attributes) {
  if (attributes === undefined || attributes === null) return null;
  if (!Array.isArray(attributes)) {
    return { field: "attributes", reason: "present but not an array" };
  }
  for (const [index, attribute] of attributes.entries()) {
    if (!isPlainObject(attribute) || !isNonEmptyString(attribute.name)) {
      return { field: `attributes[${index}].name`, reason: "missing or not a non-empty string" };
    }
    if (!Array.isArray(attribute.values) || !attribute.values.every(isNonEmptyString)) {
      return {
        field: `attributes[${index}].values`,
        reason: "must be an array of non-empty strings",
      };
    }
  }
  return null;
}

/**
 * PART B, decision 6. Orders validated records so that identical input produces identical id
 * assignments on every run. Numeric originalIds sort numerically — a plain string sort would put
 * `1042` before `205` — and anything non-numeric falls back to a locale-independent string
 * comparison so the order is still total and still stable.
 *
 * @template {{ originalId: string }} T
 * @param {T[]} records
 * @returns {T[]}
 */
export function orderRecordsForAssignment(records) {
  return [...records].sort((left, right) => {
    const leftNumber = Number(left.originalId);
    const rightNumber = Number(right.originalId);
    const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    if (bothNumeric && leftNumber !== rightNumber) return leftNumber - rightNumber;
    if (bothNumeric) return 0;
    return left.originalId < right.originalId ? -1 : left.originalId > right.originalId ? 1 : 0;
  });
}

/**
 * PART C. The Odoo variant list becomes this project's `variants` shape.
 *
 * The real export expresses options as a **per-variant combination list**: one `variants[]` entry
 * per sellable combination, each carrying the `{attribute, value}` pairs that define it. Draft A
 * wants the **deduplicated option list** — one entry per option name, holding its distinct values.
 * The two are the same information in different arrangements, and this is the arrangement.
 *
 * Option names keep first-appearance order and values keep first-appearance order within their
 * option. Values keep their source spelling: de-duplicating is a shape change the data invites,
 * title-casing would be a silent edit to text the owner still has to read.
 *
 * Top-level `attributes[]` is not consulted. It is an empty array in all 542 real records, and
 * reading it was what wrote `variants: []` into all 78 multi-variant products.
 *
 * @param {unknown} record
 * @returns {{ optionName: string, values: string[] }[]}
 */
export function toVariants(record) {
  /** @type {Map<string, string[]>} */
  const valuesByOptionName = new Map();
  for (const variant of readVariantEntries(record)) {
    for (const pair of readVariantAttributePairs(variant)) {
      const values = valuesByOptionName.get(pair.attribute) ?? [];
      if (!values.includes(pair.value)) values.push(pair.value);
      valuesByOptionName.set(pair.attribute, values);
    }
  }
  return [...valuesByOptionName].map(([optionName, values]) => ({ optionName, values }));
}

/** @param {string} value */
function slugifyImageSegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * PART C. Builds the suggested image entries — the path, its provenance, and the confirmation
 * flag that says nobody has approved it yet.
 *
 * The paths follow ADR-006's catalogue convention — `/products/P101.webp` for the main
 * photograph and `/products/P101-2.webp` onward for its siblings — because these strings are
 * copied verbatim into `media.images` later and a path invented here would be a path the site
 * cannot serve. The source file each one came from is recorded alongside, so a suggestion can be
 * traced back to the byte it describes.
 *
 * **The provenance rides inside the suggestion rather than beside it**, which reverses what
 * ADR-054 decision 5 chose. That choice was made to keep `images.variantImages` a plain
 * string-to-string map matching the Draft A schema exactly; ADR-056 changed the Draft A schema
 * to carry `confirmed` per image, so the reason no longer holds — and a parallel block was the
 * reason the `verifiedDistinct` evidence had no way across extraction. See ADR-056.
 *
 * Nothing here is confirmed. `verifiedDistinct` is the source system's own hash check carried
 * forward as evidence for the person doing the review; it is not a licence to auto-populate. It is
 * read camelCase, as the export spells it — read as `verified_distinct` it was `undefined === true`
 * for all 50 real variant images, and every one of them reached the reviewer inverted.
 *
 * @param {unknown} record
 * @param {string} productId
 * @param {string} batchId
 * @param {string} originalId
 */
export function buildImageSuggestions(record, productId, batchId, originalId) {
  const sourceImages = readSourceImages(record);
  const mainFile = readMainImageFile(sourceImages);
  const extraFiles = readExtraImageFiles(sourceImages);
  const variantImages = readVariantImageEntries(sourceImages)
    .map((variantImage) => ({
      attribute: resolveVariantImageAttribute(record, variantImage),
      value: typeof variantImage.value === "string" ? variantImage.value : "",
      file: typeof variantImage.file === "string" ? variantImage.file : "",
      verifiedDistinct: variantImage.verifiedDistinct === true,
    }))
    .filter((variantImage) => variantImage.attribute !== null);

  /** @type {{path: string, confirmed: boolean, sourceFile: string, role: string}[]} */
  const general = [
    {
      path: `/products/${productId}.webp`,
      confirmed: false,
      sourceFile: sourceImagePath(batchId, originalId, mainFile),
      role: "main",
    },
  ];
  for (const [index, file] of extraFiles.entries()) {
    general.push({
      path: `/products/${productId}-${index + 2}.webp`,
      confirmed: false,
      sourceFile: sourceImagePath(batchId, originalId, file),
      role: `extra-${index + 1}`,
    });
  }

  const valueSlugCounts = new Map();
  for (const variantImage of variantImages) {
    const slug = slugifyImageSegment(variantImage.value);
    valueSlugCounts.set(slug, (valueSlugCounts.get(slug) ?? 0) + 1);
  }

  /** @type {Record<string, {path: string, confirmed: boolean, sourceFile: string, verifiedDistinct: boolean}>} */
  const variantImagePaths = {};
  for (const variantImage of variantImages) {
    const valueSlug = slugifyImageSegment(variantImage.value);
    const needsAttributePrefix = (valueSlugCounts.get(valueSlug) ?? 0) > 1;
    const suffix = needsAttributePrefix
      ? `${slugifyImageSegment(variantImage.attribute)}-${valueSlug}`
      : valueSlug;
    variantImagePaths[`${variantImage.attribute}:${variantImage.value}`] = {
      path: `/products/${productId}-${suffix}.webp`,
      confirmed: false,
      sourceFile: sourceImagePath(batchId, originalId, variantImage.file),
      verifiedDistinct: variantImage.verifiedDistinct,
    };
  }

  return { images: { general, variantImages: variantImagePaths } };
}

/**
 * PART B and C. The raw block — the file whose existence reserves the id.
 *
 * It is deliberately NOT a Draft A object and must never be handed to
 * `scripts/validate-draft-a.mjs`: it carries no `attributes` candidates, no `flaggedContent` and
 * no `personalized` verdict, because every one of those is produced by extraction, which has not
 * run. `confirmationState` says so in the file itself, so a raw block cannot be mistaken for a
 * draft by anything that opens it.
 *
 * @param {object} record
 * @param {string} productId
 * @param {string} batchId
 * @param {string} originalId
 * @param {{ knownStub?: boolean }} [flags]
 */
export function buildRawBlock(record, productId, batchId, originalId, flags = {}) {
  const { images } = buildImageSuggestions(record, productId, batchId, originalId);
  const sourceNotes = readSourceNotes(record);
  return {
    productId,
    stage: QUEUED_STAGE,
    sourceType: "migrated",
    batchId,
    confirmationState: {
      draftAExtractionRun: false,
      imagesConfirmed: false,
      note: "Not a Draft A object. Extraction has not run; every value here is transcribed or suggested, never claimed.",
    },
    sourceNotes: {
      originalId,
      workingId: workingIdFor(originalId),
      originalSku: sourceNotes.originalSku ?? null,
      originalUrl: sourceNotes.originalUrl ?? null,
      referenceTitle: sourceNotes.referenceTitle ?? null,
      rawContent: readRawContent(record),
      rawHtml: readRawHtml(record),
      originalCategories: Array.isArray(sourceNotes.originalCategories)
        ? [...sourceNotes.originalCategories]
        : [],
      /**
       * ARCHIVAL ONLY — never read by extraction, never used to generate anything.
       *
       * This is the meta description the owner wrote on the old site. It is carried so the record
       * of what the source held is complete, and for no other purpose. Draft A must not quote it,
       * paraphrase it, seed a meta description from it, or treat it as evidence for a material,
       * plating or stone claim: it is marketing copy from a system whose claims this migration
       * exists to re-examine, not source text about the product. `sourceNotes.rawContent` is the
       * only field extraction reads for content. See ADR-054's addendum, decision I-2.
       */
      originalMetaDescription: sourceNotes.originalMetaDescription ?? null,
      /**
       * The export's own QA observations from the extraction session — "only one image available
       * from source", "duplicate title shared with template(s) …", "source description is only N
       * characters". They are the source system describing itself, so they belong beside the other
       * provenance rather than at the top level, where the Draft A schema's own `notes[]` lives and
       * where extraction would later write its own. Carried verbatim, for the person reviewing the
       * queued record to read.
       */
      exportNotes: Array.isArray(record.notes) ? [...record.notes] : [],
      knownStub: flags.knownStub === true || record.knownStub === true,
    },
    category: record.category ?? null,
    subcategory: record.subcategory ?? null,
    suggestedCollections: Array.isArray(record.suggestedCollections)
      ? [...record.suggestedCollections]
      : [],
    variants: toVariants(record),
    images,
    pricing: { referencePrice: readReferencePrice(record) },
  };
}

/**
 * PART A and B together, as one pure decision over already-parsed input. Returns the whole plan —
 * what to write, what to report, what to refuse — without touching the filesystem.
 *
 * @param {{ records: {value: unknown, line: number}[], parseErrors: {line: number, message: string}[], batchId: string, catalogue: unknown, imageExists: (relativePath: string) => boolean, startNumber?: number, knownStubIds?: Set<string> }} input
 */
export function planBatch(input) {
  const catalogue = assertCatalogueBelowOverrideFloor(input.catalogue);
  const startNumber = input.startNumber ?? MIGRATION_ID_START;
  const knownStubIds = input.knownStubIds ?? new Set();

  /** @type {{originalId: string | null, line: number, failures: {field: string, reason: string}[]}[]} */
  const rejected = input.parseErrors.map((parseError) => ({
    originalId: null,
    line: parseError.line,
    failures: [{ field: "(line)", reason: `not valid JSON — ${parseError.message}` }],
  }));
  /** @type {{record: object, originalId: string, line: number, knownStub: boolean, warnings: {field: string, reason: string}[]}[]} */
  const accepted = [];

  for (const { value, line } of input.records) {
    const result = validateSourceRecord(value, {
      batchId: input.batchId,
      index: line - 1,
      imageExists: input.imageExists,
      knownStubIds,
    });
    if (result.ok && result.originalId !== null) {
      accepted.push({
        record: /** @type {object} */ (value),
        originalId: result.originalId,
        line,
        knownStub: isKnownStubOverride(knownStubIds, result.originalId),
        warnings: result.warnings,
      });
    } else {
      rejected.push({ originalId: result.originalId, line, failures: result.failures });
    }
  }

  const duplicates = findDuplicateOriginalIds(accepted);
  const queueable = accepted.filter((entry) => !duplicates.has(entry.originalId));
  for (const entry of accepted) {
    if (duplicates.has(entry.originalId)) {
      rejected.push({
        originalId: entry.originalId,
        line: entry.line,
        failures: [
          {
            field: "originalId",
            reason: `appears on more than one line, so a stable id assignment is not defined for it`,
          },
        ],
      });
    }
  }

  const assigned = orderRecordsForAssignment(queueable).map((entry, index) => {
    const productId = formatProductId(startNumber + index);
    return {
      ...entry,
      productId,
      rawBlock: buildRawBlock(entry.record, productId, input.batchId, entry.originalId, {
        knownStub: entry.knownStub,
      }),
    };
  });

  return {
    catalogue,
    batchId: input.batchId,
    assigned,
    rejected: rejected.sort((left, right) => left.line - right.line),
    assignedRange:
      assigned.length === 0
        ? null
        : { first: assigned[0].productId, last: assigned[assigned.length - 1].productId },
  };
}

/** @param {{originalId: string}[]} accepted */
function findDuplicateOriginalIds(accepted) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of accepted) {
    if (seen.has(entry.originalId)) duplicates.add(entry.originalId);
    seen.add(entry.originalId);
  }
  return duplicates;
}

/**
 * PART D. The manifest — one entry per record read, passed or failed, so the count in this file
 * always matches the count of lines in the export.
 *
 * @param {ReturnType<typeof planBatch>} plan
 */
export function buildManifest(plan) {
  const entries = [
    ...plan.assigned.map((entry) => ({
      line: entry.line,
      originalId: entry.originalId,
      productId: entry.productId,
      category: entry.rawBlock.category,
      validationStatus: entry.warnings.length > 0 ? "queued-with-warnings" : "queued",
      rawBlockPath: `${entry.productId}/raw-block.json`,
      warnings: entry.warnings,
    })),
    ...plan.rejected.map((entry) => ({
      line: entry.line,
      originalId: entry.originalId,
      productId: null,
      category: null,
      validationStatus: "needs-attention",
      rawBlockPath: null,
      failures: entry.failures,
    })),
  ].sort((left, right) => left.line - right.line);

  return {
    batchId: plan.batchId,
    stage: QUEUED_STAGE,
    note: "Stage 0 preparation only. No Draft A extraction has run against any record in this batch.",
    catalogueMaxProductIdAtAssignment: plan.catalogue.maxProductId,
    assignedRange: plan.assignedRange,
    counts: {
      read: entries.length,
      queued: plan.assigned.length,
      needsAttention: plan.rejected.length,
    },
    entries,
  };
}

/**
 * PART A, the report. Every rejected record with its field and its reason.
 *
 * @param {ReturnType<typeof planBatch>} plan
 * @param {string} sourcePath
 */
export function renderNeedsAttention(plan, sourcePath) {
  const lines = [
    `# Needs attention — batch \`${plan.batchId}\``,
    "",
    `Records in \`${sourcePath}\` that Stage 0 refused. **None of them were assigned a product id**,`,
    "and none of them are in `manifest.json` as queued. Fix the record in the export and re-run the",
    "batch, or take the record out of the migration deliberately — but nothing here was skipped",
    "quietly and nothing here was carried through as if it had passed.",
    "",
  ];

  if (plan.rejected.length === 0) {
    lines.push("Every record in this batch passed validation. Nothing needs attention.", "");
    return lines.join("\n");
  }

  lines.push(
    `${plan.rejected.length} record(s) failed.`,
    "",
    "| JSONL line | originalId | Field | Reason |",
    "| --- | --- | --- | --- |",
  );
  for (const entry of plan.rejected) {
    for (const failure of entry.failures) {
      lines.push(
        `| ${entry.line} | ${entry.originalId === null ? "_(unreadable)_" : `\`${entry.originalId}\``} | \`${failure.field}\` | ${failure.reason} |`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * A literal `|` inside a register cell ends the cell early and shifts every cell after it —
 * sixteen titles in the real export carry one. The HTML entity renders as the same character in
 * the table while being unmistakable for a cell boundary, both to a Markdown renderer and to
 * `parseMarkdownTables`, which splits on the raw character. A backslash escape would satisfy a
 * renderer but not the parser, so the append guard would still refuse the write.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeRegisterCell(text) {
  return text.replaceAll("|", "&#124;");
}

/**
 * PART D. The register rows, at the new `queued` stage — not `extracted`, which would claim a
 * Draft A run that has not happened.
 *
 * @param {ReturnType<typeof planBatch>} plan
 * @param {string} isoDate
 */
export function renderDraftsInProgressRows(plan, isoDate) {
  return plan.assigned.map((entry) => {
    const title = escapeRegisterCell(
      entry.rawBlock.sourceNotes.referenceTitle ?? "_(no title in export)_",
    );
    const category = entry.rawBlock.category === null ? "_(none)_" : `\`${entry.rawBlock.category}\``;
    const notes = escapeRegisterCell(
      [
        `batch \`${plan.batchId}\`, Odoo id \`${entry.originalId}\``,
        ...entry.warnings.map((warning) => `**${warning.field}:** ${warning.reason}`),
      ].join(". "),
    );
    return `| ${entry.productId} | ${title} | ${category} | \`${QUEUED_STAGE}\` | ${isoDate} | ${notes} |`;
  });
}

/**
 * Parses a JSONL file into records and per-line parse errors. A malformed line is data to report,
 * not a reason to abandon the other 400 records.
 *
 * @param {string} contents
 */
export function parseJsonl(contents) {
  /** @type {{value: unknown, line: number}[]} */
  const records = [];
  /** @type {{line: number, message: string}[]} */
  const parseErrors = [];
  const lines = contents.split("\n");
  for (const [index, rawLine] of lines.entries()) {
    if (rawLine.trim().length === 0) continue;
    try {
      records.push({ value: JSON.parse(rawLine), line: index + 1 });
    } catch (error) {
      parseErrors.push({ line: index + 1, message: /** @type {Error} */ (error).message });
    }
  }
  return { records, parseErrors };
}

export const DRAFTS_IN_PROGRESS_PATH = join(REPO_ROOT, "docs/pipeline-prep/drafts-in-progress.md");

/** The heading above the register table. A row belongs inside that table and nowhere else. */
const REGISTER_HEADING = "## Register";

/**
 * A line that is part of a Markdown table: a pipe, possibly indented. Nothing else in a section
 * begins with one, which is what makes "the last such line" a usable anchor.
 *
 * @param {string} line
 */
function isTableLine(line) {
  return line.trimStart().startsWith("|");
}

/**
 * Splits a Markdown document into its tables, so a caller can assert that what was written is a
 * table rather than looking at it and deciding it resembles one.
 *
 * A table is a run of consecutive pipe-leading lines whose second line is a delimiter row. The
 * checks are the ones a Markdown renderer actually applies: every row carries the same number of
 * cells as the header, and a run with no delimiter row is not a table at all — which is precisely
 * what a row appended into the middle of a paragraph produces.
 *
 * @param {string} markdown
 * @returns {{ tables: {startLine: number, columnCount: number, headerCells: string[], rows: string[][]}[], problems: string[] }}
 */
export function parseMarkdownTables(markdown) {
  const lines = markdown.split("\n");
  const tables = [];
  const problems = [];

  let index = 0;
  while (index < lines.length) {
    if (!isTableLine(lines[index])) {
      index += 1;
      continue;
    }

    const startLine = index;
    const block = [];
    while (index < lines.length && isTableLine(lines[index])) {
      block.push(lines[index]);
      index += 1;
    }

    const cellsOf = (line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

    if (block.length < 2) {
      problems.push(`line ${startLine + 1}: a single pipe line is not a table — it has no delimiter row`);
      continue;
    }

    const headerCells = cellsOf(block[0]);
    const delimiterCells = cellsOf(block[1]);
    const delimiterIsValid =
      delimiterCells.length === headerCells.length &&
      delimiterCells.every((cell) => /^:?-{3,}:?$/.test(cell));

    if (!delimiterIsValid) {
      problems.push(
        `line ${startLine + 2}: expected a delimiter row of ${headerCells.length} column(s), found ${JSON.stringify(block[1])}`,
      );
      continue;
    }

    const rows = block.slice(2).map(cellsOf);
    rows.forEach((row, rowIndex) => {
      if (row.length !== headerCells.length) {
        problems.push(
          `line ${startLine + 3 + rowIndex}: row has ${row.length} cell(s), header has ${headerCells.length}`,
        );
      }
    });

    tables.push({ startLine, columnCount: headerCells.length, headerCells, rows });
  }

  return { tables, problems };
}

/**
 * The line a new register row goes **after**: the last row of the table under `## Register`.
 *
 * This is a function of its own, and it is the fix for the whole bug. The previous version
 * inserted above the `## Rejected ids` heading, which is not the end of the table — between the
 * two sits the "*The example row is not a reservation*" paragraph. Rows landed after that
 * paragraph with no blank line, so Markdown read them as lazy continuation of it and rendered
 * 542 table rows as one run-on sentence, silently, exit 0.
 *
 * Anchoring to the table's own last row rather than to whatever heading follows it means the
 * paragraph can move, grow or disappear without moving the insertion point again.
 *
 * @param {string[]} lines
 * @returns {number}
 */
export function findRegisterTableEnd(lines) {
  const headingIndex = lines.findIndex((line) => line.trim() === REGISTER_HEADING);
  if (headingIndex === -1) {
    throw new Error(`register has no "${REGISTER_HEADING}" heading to insert under`);
  }

  let sectionEnd = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      sectionEnd = index;
      break;
    }
  }

  let lastTableLine = -1;
  for (let index = headingIndex + 1; index < sectionEnd; index += 1) {
    if (isTableLine(lines[index])) lastTableLine = index;
  }

  if (lastTableLine === -1) {
    throw new Error(
      `register has a "${REGISTER_HEADING}" heading but no table under it — there is no row to append to`,
    );
  }

  return lastTableLine;
}

/**
 * Appends the queued rows to the manual register, **inside the register table**. It refuses if any
 * id it is about to add is already named in the file — that is the second half of the double-run
 * guard, and the first half is the raw block whose existence reserves the id.
 *
 * The write is verified before it is kept: the resulting document is re-parsed, and if the
 * register table does not come back holding every appended row at the right column count, nothing
 * is written and the error says so. A register is the index that survives if `content-pipeline/`
 * is lost, and corrupting it quietly is worse than failing loudly.
 *
 * `registerPath` is a parameter rather than a constant so a synthetic batch can be demonstrated
 * end to end against a scratch copy without writing fabricated products into the real register.
 *
 * @param {string[]} rows
 * @param {string[]} productIds
 * @param {string} registerPath
 */
export function appendRegisterRows(rows, productIds, registerPath = DRAFTS_IN_PROGRESS_PATH) {
  const existing = readFileSync(registerPath, "utf8");
  const reserved = registerReservedIds(existing);
  const alreadyPresent = productIds.filter((productId) => reserved.has(productId));
  if (alreadyPresent.length > 0) {
    throw new Error(
      `REFUSING TO WRITE — ${registerPath} already names ${alreadyPresent.join(", ")}. ` +
        "An id is reserved permanently, so a second row for one is a double run, not an update.",
    );
  }

  const updated = insertRegisterRows(existing, rows);
  const verification = verifyRegisterRows(updated, rows);
  if (verification !== null) {
    throw new Error(
      `REFUSING TO WRITE — appending to ${registerPath} would not produce a valid register table: ${verification}`,
    );
  }

  writeFileSync(registerPath, updated, "utf8");
}

/**
 * Every product id the register has actually reserved: the **first cell of every row of every
 * table in it**, across both the Register and the Rejected ids sections, with the strikethrough
 * of a retired row stripped off.
 *
 * Read from the tables rather than from the whole document, and that distinction is the second
 * fault this function had. The guard used to test `\bP101\b` against the file's entire text, and
 * the register's own prose says *"ADR-054 retired P050–P100 permanently and starts the Odoo
 * migration at P101"*. So the very first real batch — which begins at P101 by design — would have
 * been refused as a double run, by a sentence describing the plan rather than by any reservation.
 * Nothing in the fixture had prose mentioning an id, so nothing caught it.
 *
 * An id is reserved by a row, which is what the file itself says one paragraph further down: *"an
 * id is reserved by the first file named after it, never by appearing in a table"* — and a table
 * row is the register's record of that file. A sentence about a range is not a row.
 *
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function registerReservedIds(markdown) {
  const reserved = new Set();
  for (const table of parseMarkdownTables(markdown).tables) {
    for (const row of table.rows) {
      const match = /P\d{3,}/.exec(row[0] ?? "");
      if (match !== null) reserved.add(match[0]);
    }
  }
  return reserved;
}

/**
 * The pure half of the append, so the result can be checked before it reaches a file.
 *
 * @param {string} existing
 * @param {string[]} rows
 * @returns {string}
 */
export function insertRegisterRows(existing, rows) {
  if (rows.length === 0) return existing;

  const lines = existing.split("\n");
  const tableEnd = findRegisterTableEnd(lines);
  lines.splice(tableEnd + 1, 0, ...rows);
  return lines.join("\n");
}

/**
 * Re-reads the document the way a renderer would and answers one question: did every appended row
 * land in the register table. Returns `null` when it did, and the reason when it did not.
 *
 * @param {string} updated
 * @param {string[]} rows
 * @returns {string | null}
 */
function verifyRegisterRows(updated, rows) {
  const { tables, problems } = parseMarkdownTables(updated);
  if (problems.length > 0) return problems.join("; ");

  const registerTable = tables.find((table) =>
    table.headerCells[0] === "Product ID" && table.headerCells.includes("Stage"),
  );
  if (registerTable === undefined) return "the register table is not in the parsed output";

  const rendered = registerTable.rows.map((row) => row.join(" | "));
  for (const row of rows) {
    const expected = row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
      .join(" | ");
    if (!rendered.includes(expected)) {
      return `a row did not land in the register table: ${row.slice(0, 60)}…`;
    }
  }

  return null;
}

/**
 * Resolves `--known-stub-ids` into the set the validator consults. The value is either the ids
 * themselves, comma- or space-separated, or the path to a file holding them — a JSON array, or one
 * id per line. Which it is is decided by asking the filesystem rather than by a prefix or an
 * extension: 11 ids fit on a command line, 200 would not, and the operator should not have to
 * remember a sigil to switch between the two.
 *
 * @param {string | undefined} value
 * @returns {Set<string>}
 */
export function resolveKnownStubIds(value) {
  if (value === undefined || value === "true") return new Set();
  if (!existsSync(value)) return parseKnownStubIds(value);

  const contents = readFileSync(value, "utf8");
  const trimmed = contents.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error(`${value} holds JSON, but not an array of ids`);
    }
    return parseKnownStubIds(parsed.join(","));
  }
  return parseKnownStubIds(
    contents
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .join(","),
  );
}

/** @param {string} message */
function fail(message) {
  console.error(message);
  return 1;
}

/**
 * @param {string[]} argv
 * @returns {number}
 */
export function runCli(argv) {
  const positional = argv.filter((argument) => !argument.startsWith("--"));
  const flags = new Map(
    argv
      .filter((argument) => argument.startsWith("--"))
      .map((argument) => {
        const [name, ...rest] = argument.slice(2).split("=");
        return [name, rest.join("=") || "true"];
      }),
  );

  const [sourcePath, batchId] = positional;
  if (!sourcePath || !batchId) {
    console.error(
      "Usage: node scripts/prepare-migration-batch.mjs <export.jsonl> <batch-id> " +
        "[--incoming-root=DIR] [--register=FILE] [--date=YYYY-MM-DD] [--dry-run] " +
        "[--known-stub-ids=ID,ID,… | --known-stub-ids=FILE]",
    );
    return 2;
  }

  const incomingRoot = flags.get("incoming-root") ?? join(REPO_ROOT, "content-pipeline/incoming");
  const registerPath = flags.get("register") ?? DRAFTS_IN_PROGRESS_PATH;
  const isDryRun = flags.get("dry-run") === "true";
  let knownStubIds;
  try {
    knownStubIds = resolveKnownStubIds(flags.get("known-stub-ids"));
  } catch (error) {
    return fail(`Could not read --known-stub-ids: ${/** @type {Error} */ (error).message}`);
  }
  const isoDate = flags.get("date") ?? new Date().toISOString().slice(0, 10);
  const batchRoot = join(incomingRoot, batchId);

  if (!existsSync(sourcePath)) return fail(`No such JSONL export: ${sourcePath}`);

  const { records, parseErrors } = parseJsonl(readFileSync(sourcePath, "utf8"));
  const catalogue = JSON.parse(readFileSync(join(REPO_ROOT, "data/products.json"), "utf8"));

  let plan;
  try {
    plan = planBatch({
      records,
      parseErrors,
      batchId,
      catalogue,
      imageExists: (relativePath) => existsSync(join(incomingRoot, relativePath)),
      knownStubIds,
    });
  } catch (error) {
    return fail(`\n${/** @type {Error} */ (error).message}\n`);
  }

  console.log(`Stage 0 batch preparation — ${batchId}`);
  console.log("No Draft A extraction runs here. This step validates, assigns ids and queues.\n");
  console.log(`  source            ${sourcePath}`);
  console.log(`  records read      ${records.length + parseErrors.length}`);
  console.log(`  queued            ${plan.assigned.length}`);
  console.log(`  needs attention   ${plan.rejected.length}`);
  console.log(`  catalogue max id  ${plan.catalogue.maxProductId}`);
  console.log(
    `  ids assigned      ${plan.assignedRange === null ? "none" : `${plan.assignedRange.first}–${plan.assignedRange.last}`}`,
  );
  if (knownStubIds.size > 0) {
    console.log(`  known stub ids    ${knownStubIds.size} accepted by manual override`);
  }

  const collidingIds = plan.assigned
    .map((entry) => join(batchRoot, entry.productId, "raw-block.json"))
    .filter((path) => existsSync(path));
  if (collidingIds.length > 0) {
    return fail(
      `\nREFUSING TO WRITE — ${collidingIds.length} raw block(s) already exist under ${batchRoot}.\n` +
        "A raw block IS the id reservation, so overwriting one would hand an assigned number to a\n" +
        "second product. Move the existing batch aside or use a new batch id.\n",
    );
  }

  if (isDryRun) {
    console.log("\nDRY RUN — nothing written.");
    return plan.rejected.length > 0 ? 1 : 0;
  }

  mkdirSync(batchRoot, { recursive: true });
  for (const entry of plan.assigned) {
    const rawBlockPath = join(batchRoot, entry.productId, "raw-block.json");
    mkdirSync(dirname(rawBlockPath), { recursive: true });
    writeFileSync(rawBlockPath, `${JSON.stringify(entry.rawBlock, null, 2)}\n`, "utf8");
  }
  writeFileSync(
    join(batchRoot, "manifest.json"),
    `${JSON.stringify(buildManifest(plan), null, 2)}\n`,
    "utf8",
  );
  writeFileSync(join(batchRoot, "needs-attention.md"), renderNeedsAttention(plan, sourcePath), "utf8");

  const rows = renderDraftsInProgressRows(plan, isoDate);
  if (rows.length > 0) {
    try {
      appendRegisterRows(
        rows,
        plan.assigned.map((entry) => entry.productId),
        registerPath,
      );
    } catch (error) {
      return fail(`\n${/** @type {Error} */ (error).message}\n`);
    }
  }

  console.log(`\n  written to        ${batchRoot}`);
  console.log(`  register rows     ${rows.length} appended to ${registerPath}`);

  if (plan.rejected.length > 0) {
    console.error(
      `\nATTENTION — ${plan.rejected.length} record(s) were refused. Read ${join(batchRoot, "needs-attention.md")}.`,
    );
    return 1;
  }
  console.log("\nPASS — every record queued. Draft A extraction is the next, separate step.");
  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(runCli(process.argv.slice(2)));
}
