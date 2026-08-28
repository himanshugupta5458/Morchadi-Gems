/**
 * review-groups — print the source evidence behind the confirmation groups in
 * `docs/pipeline-prep/batch-01-confirmation-groups.md`, so the owner can decide a group by
 * reading what the products actually said rather than by trusting that a repeated string means
 * a repeated fact.
 *
 * PURPOSE
 *   One read-only reporter in place of four: `get-group-ids.mjs`, `inspect-group.mjs`,
 *   `audit-all-groups.mjs` and `audit-remaining-groups.mjs`.
 *
 * USAGE
 *   node scripts/review-groups.mjs --section grouped-commons
 *   node scripts/review-groups.mjs --section singles --sample-size all
 *   node scripts/review-groups.mjs --ids P112,P113 --label Plating --value "rose gold"
 *
 *   --section      grouped-commons | singles | unverified-stones | personalized-null
 *   --sample-size  how many products to quote per group. Default 3; "all" for every one
 *   --ids          quote these product ids instead of a section's own list
 *   --label        with --ids, the attribute label to quote. Defaults to every attribute
 *   --value        with --ids and --label, narrows to that exact value
 *
 * SAFETY MODEL
 *   Read-only. There is no --apply because there is nothing to apply: this opens draft files,
 *   prints from them, and never writes. Confirming what it shows is a separate, explicit step —
 *   `scripts/confirm-attributes.mjs`, with the ids typed out.
 *
 *   Drafts are read from `content-pipeline/drafts/`, falling back to
 *   `content-pipeline/completed/` for a product that has since been published, so a group that
 *   is half-published still reports in full. Each line says which of the two it came from.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GROUPS_DOC = join("docs", "pipeline-prep", "batch-01-confirmation-groups.md");
const DRAFTS_DIR = join("content-pipeline", "drafts");
const COMPLETED_DIR = join("content-pipeline", "completed");
const PRODUCT_ID = /^P\d{3}$/;
const DEFAULT_SAMPLE_SIZE = 3;
const RAW_CONTENT_EXCERPT = 300;

/**
 * The four sections, with the shape of each one's table. They do not share a column order:
 * the two grouped sections list a `(label, value)` pair and the ids that carry it, while the
 * stone and personalized sections list one product per row.
 */
const SECTIONS = {
  "grouped-commons": { heading: "## Grouped commons", shape: "grouped" },
  singles: { heading: "## Fully unique / ungroupable singles", shape: "grouped" },
  "unverified-stones": {
    heading: "## Unverified-guess stone candidates",
    shape: "per-product-attribute",
  },
  "personalized-null": { heading: "## personalized: null cases", shape: "per-product-note" },
};

function readFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`${name} needs a value`);
    process.exit(2);
  }
  return value;
}

function usage(message) {
  console.error(`${message}\n`);
  console.error(`Usage: node scripts/review-groups.mjs --section ${Object.keys(SECTIONS).join("|")}`);
  console.error('       [--sample-size <n>|all] [--ids P101,P102] [--label "<label>"] [--value "<value>"]');
  process.exit(2);
}

const argv = process.argv.slice(2);
const section = readFlag(argv, "--section");
const sampleSizeFlag = readFlag(argv, "--sample-size");
const idsFlag = readFlag(argv, "--ids");
const label = readFlag(argv, "--label");
const value = readFlag(argv, "--value");

if (section === null && idsFlag === null) usage("One of --section or --ids is required.");
if (section !== null && !(section in SECTIONS)) {
  usage(`--section must be one of ${Object.keys(SECTIONS).join(", ")}`);
}

const sampleSize =
  sampleSizeFlag === null
    ? DEFAULT_SAMPLE_SIZE
    : sampleSizeFlag === "all"
      ? Number.POSITIVE_INFINITY
      : Number.parseInt(sampleSizeFlag, 10);

if (!(sampleSize > 0)) usage('--sample-size must be a positive integer or "all".');

function loadDraft(id) {
  for (const [directory, origin] of [
    [DRAFTS_DIR, "draft"],
    [COMPLETED_DIR, "completed"],
  ]) {
    const path = join(directory, `${id}.json`);
    if (existsSync(path)) return { draft: JSON.parse(readFileSync(path, "utf8")), origin };
  }
  return null;
}

function sampleOf(ids) {
  if (ids.length <= sampleSize) return ids;
  if (sampleSize === 1) return [ids[0]];
  if (sampleSize === 2) return [ids[0], ids[ids.length - 1]];
  const step = (ids.length - 1) / (sampleSize - 1);
  return Array.from({ length: sampleSize }, (_unused, index) => ids[Math.round(index * step)]);
}

function tableRowsUnder(heading, productIdColumn) {
  const lines = readFileSync(GROUPS_DOC, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    console.error(`Could not find "${heading}" in ${GROUPS_DOC}.`);
    process.exit(1);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end))
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => /^P\d/.test(cells[productIdColumn] ?? ""));
}

function idsIn(cell) {
  return cell
    .split(",")
    .map((token) => token.trim())
    .filter((token) => PRODUCT_ID.test(token));
}

function printAttribute(id, origin, attribute) {
  const quote = attribute.source?.quotedPhrase ?? "(no quoted phrase)";
  const stone = attribute.stoneSource ? ` [${attribute.stoneSource}]` : "";
  const confirmed = attribute.confirmed === true ? " [CONFIRMED]" : "";
  console.log(`  ${id} (${origin})  ${attribute.label} = ${attribute.value}${stone}${confirmed}`);
  console.log(`      quoted: "${quote}"`);
}

function reportGroup(groupLabel, groupValue, ids, count) {
  console.log(`\n### ${groupLabel} = ${groupValue} (${count ?? ids.length} product(s))`);
  const shown = sampleOf(ids);

  for (const id of shown) {
    const loaded = loadDraft(id);
    if (loaded === null) {
      console.log(`  ${id}  NOT FOUND in drafts/ or completed/`);
      continue;
    }
    const match = (loaded.draft.attributes ?? []).find(
      (attribute) => attribute.label === groupLabel && attribute.value === groupValue,
    );
    if (match === undefined) {
      console.log(`  ${id} (${loaded.origin})  NO MATCHING ATTRIBUTE — the group row and the draft disagree`);
      continue;
    }
    printAttribute(id, loaded.origin, match);
    const raw = loaded.draft.sourceNotes?.rawContent;
    if (raw) {
      console.log(
        `      source: ${raw.slice(0, RAW_CONTENT_EXCERPT).replace(/\n/g, " ")}${raw.length > RAW_CONTENT_EXCERPT ? "..." : ""}`,
      );
    }
  }

  if (ids.length > shown.length) {
    console.log(`  (${ids.length - shown.length} more id(s) in this group not shown — pass --sample-size all)`);
  }
}

if (idsFlag !== null) {
  const ids = idsIn(idsFlag);
  if (ids.length === 0) usage("--ids held no product ids.");

  for (const id of ids) {
    const loaded = loadDraft(id);
    console.log(`\n=== ${id} ===`);
    if (loaded === null) {
      console.log("  NOT FOUND in drafts/ or completed/");
      continue;
    }
    const attributes = (loaded.draft.attributes ?? []).filter(
      (attribute) =>
        (label === null || attribute.label === label) &&
        (value === null || attribute.value === value),
    );
    if (attributes.length === 0) {
      console.log(`  (${loaded.origin}) no attribute matches the filter`);
      continue;
    }
    for (const attribute of attributes) printAttribute(id, loaded.origin, attribute);
    const raw = loaded.draft.sourceNotes?.rawContent;
    if (raw) {
      console.log(
        `      source: ${raw.slice(0, RAW_CONTENT_EXCERPT).replace(/\n/g, " ")}${raw.length > RAW_CONTENT_EXCERPT ? "..." : ""}`,
      );
    }
  }
  process.exit(0);
}

const { heading, shape } = SECTIONS[section];

if (shape === "per-product-note") {
  const rows = tableRowsUnder(heading, 1);
  console.log(`${heading} — ${rows.length} product(s)\n`);
  for (const [, id, referenceTitle, note] of rows) {
    const loaded = loadDraft(id);
    console.log(`### ${id} (${loaded === null ? "not found" : loaded.origin})  ${referenceTitle}`);
    console.log(`  personalized: ${loaded === null ? "?" : JSON.stringify(loaded.draft.personalized)}`);
    console.log(`  note: ${note}\n`);
  }
  process.exit(0);
}

if (shape === "per-product-attribute") {
  const rows = tableRowsUnder(heading, 1);
  const shown = sampleOf(rows);
  console.log(
    `${heading} — ${rows.length} candidate(s), showing ${shown.length}\n`,
  );
  for (const [, id, rowLabel, displayTerm, proposedValue] of shown) {
    const loaded = loadDraft(id);
    console.log(`### ${id} (${loaded === null ? "not found" : loaded.origin})  ${rowLabel} = ${proposedValue}`);
    console.log(`  source term: ${displayTerm}`);
    if (loaded === null) continue;
    const match = (loaded.draft.attributes ?? []).find(
      (attribute) => attribute.label === rowLabel && attribute.value === proposedValue,
    );
    if (match === undefined) {
      console.log("  NO MATCHING ATTRIBUTE — the row and the draft disagree");
      continue;
    }
    console.log(`  quoted: "${match.source?.quotedPhrase ?? "(no quoted phrase)"}"`);
    console.log(`  stoneSource: ${match.stoneSource ?? "(none)"}${match.confirmed === true ? "   [CONFIRMED]" : ""}`);
  }
  if (rows.length > shown.length) {
    console.log(`\n(${rows.length - shown.length} more not shown — pass --sample-size all)`);
  }
  process.exit(0);
}

const rows = tableRowsUnder(heading, 4);
console.log(`${heading} — ${rows.length} group(s), sample size ${sampleSize === Number.POSITIVE_INFINITY ? "all" : sampleSize}`);

for (const [, groupLabel, groupValue, count, idsCell] of rows) {
  reportGroup(groupLabel, groupValue, idsIn(idsCell), count);
}
