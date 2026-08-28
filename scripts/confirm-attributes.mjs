/**
 * confirm-attributes — set `confirmed: true` on one named attribute across an explicit list of
 * Draft A objects.
 *
 * PURPOSE
 *   Owner review decides that a `(label, value)` candidate is correct for a known set of
 *   products. This writes that decision into `content-pipeline/drafts/{id}.json` and does
 *   nothing else. It replaces `confirm-group.mjs` and `confirm-from-audit.mjs`.
 *
 * USAGE
 *   node scripts/confirm-attributes.mjs --label "Plating" --value "gold-plated" \
 *     --ids P154,P155,P158                       # dry run, prints what would change
 *   node scripts/confirm-attributes.mjs --label "Plating" --value "gold-plated" \
 *     --ids-file review/gold-plated.txt --apply  # writes
 *
 *   --label      exact attribute label, as it appears in the draft
 *   --value      exact attribute value, as it appears in the draft
 *   --ids        comma or space separated product ids
 *   --ids-file   a file of product ids, separated by commas, spaces or newlines
 *   --apply      write. Without it nothing on disk is touched
 *
 * SAFETY MODEL
 *   Dry run by default: without --apply this reads, reports and exits 0 having written nothing.
 *
 *   The target list is always explicit and bounded. There is no "confirm everything that looks
 *   like this" mode and no mode that discovers its own targets, because the tool this replaces
 *   had one: `confirm-from-audit.mjs` re-read captured terminal output and confirmed whatever
 *   ids it found in it, so a stale capture confirmed the wrong products with no way to tell
 *   from the output that it had. Deciding which products a confirmation covers is review work,
 *   and it happens before this runs.
 *
 *   Matching is exact on both label and value. An id whose draft carries no such attribute is
 *   reported and skipped, never coerced. An attribute already confirmed is left alone.
 *
 *   Only `content-pipeline/drafts/` is touched. A record in `content-pipeline/completed/` has
 *   been published and is not a draft any more; this tool will not open one.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DRAFTS_DIR = join("content-pipeline", "drafts");
const PRODUCT_ID = /^P\d{3}$/;

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

function splitIds(text) {
  return text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function usage(message) {
  console.error(`${message}\n`);
  console.error('Usage: node scripts/confirm-attributes.mjs --label "<label>" --value "<value>"');
  console.error("       (--ids P101,P102,... | --ids-file <path>) [--apply]");
  process.exit(2);
}

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const label = readFlag(argv, "--label");
const value = readFlag(argv, "--value");
const idsFlag = readFlag(argv, "--ids");
const idsFile = readFlag(argv, "--ids-file");

if (label === null) usage("--label is required.");
if (value === null) usage("--value is required.");
if (idsFlag === null && idsFile === null) {
  usage("One of --ids or --ids-file is required. This tool never picks its own targets.");
}
if (idsFlag !== null && idsFile !== null) {
  usage("Pass either --ids or --ids-file, not both.");
}

if (idsFile !== null && !existsSync(idsFile)) usage(`No file at ${idsFile}`);

const ids = splitIds(idsFlag ?? readFileSync(idsFile, "utf8"));
if (ids.length === 0) usage("The target list is empty.");

const malformed = ids.filter((id) => !PRODUCT_ID.test(id));
if (malformed.length > 0) usage(`Not product ids: ${malformed.join(", ")}`);

const wouldConfirm = [];
const alreadyConfirmed = [];
const skipped = [];

for (const id of ids) {
  const path = join(DRAFTS_DIR, `${id}.json`);
  if (!existsSync(path)) {
    skipped.push(`${id}: no draft at ${path}`);
    continue;
  }

  const draft = JSON.parse(readFileSync(path, "utf8"));
  const match = (draft.attributes ?? []).find(
    (attribute) => attribute.label === label && attribute.value === value,
  );

  if (match === undefined) {
    skipped.push(`${id}: no attribute with label="${label}" value="${value}"`);
    continue;
  }

  if (match.confirmed === true) {
    alreadyConfirmed.push(id);
    continue;
  }

  wouldConfirm.push(id);
  if (apply) {
    match.confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(apply ? "APPLIED\n" : "DRY RUN — nothing written. Re-run with --apply.\n");
console.log(`"${label}: ${value}"`);
console.log(`  targets given      ${ids.length}`);
console.log(`  ${apply ? "confirmed        " : "would confirm    "}  ${wouldConfirm.length}${wouldConfirm.length > 0 ? `  (${wouldConfirm.join(", ")})` : ""}`);
console.log(`  already confirmed  ${alreadyConfirmed.length}${alreadyConfirmed.length > 0 ? `  (${alreadyConfirmed.join(", ")})` : ""}`);
console.log(`  skipped            ${skipped.length}`);
for (const reason of skipped) console.log(`    - ${reason}`);

process.exit(skipped.length > 0 ? 1 : 0);
