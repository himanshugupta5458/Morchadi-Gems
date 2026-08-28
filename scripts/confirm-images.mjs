/**
 * confirm-images — set `confirmed: true` on the image entries of Draft A objects whose
 * attributes are already fully confirmed.
 *
 * PURPOSE
 *   The publish-readiness gate requires every image on a draft to be confirmed. Once the owner
 *   has been through a product's attributes and its photographs, this records the image half of
 *   that. It replaces `auto-confirm-single-images.mjs`, `auto-confirm-main-only.mjs`,
 *   `confirm-all-gallery-images.mjs` and `confirm-variant-images.mjs`.
 *
 * USAGE
 *   node scripts/confirm-images.mjs --scope main                    # dry run over every eligible draft
 *   node scripts/confirm-images.mjs --scope gallery --ids P408,P587 # dry run, bounded
 *   node scripts/confirm-images.mjs --scope all --apply             # writes
 *
 *   --scope main     `images.general[0]` only, the photograph every listing renders
 *   --scope gallery  every entry in `images.general`
 *   --scope variant  every entry in `images.variantImages`
 *   --scope all      gallery and variant together
 *   --ids            comma or space separated product ids; without it, every eligible draft
 *   --apply          write. Without it nothing on disk is touched
 *
 * SAFETY MODEL
 *   Dry run by default: without --apply this reads, reports and exits 0 having written nothing.
 *
 *   The precondition is restored here and is not optional: a draft is eligible only when it has
 *   at least one attribute and every one of them is already `confirmed: true`. Two of the four
 *   scripts this replaces had dropped that check and would confirm photographs on a draft whose
 *   materials nobody had read yet, which is the wrong order — the picture is reviewed against
 *   what the record claims, so the claims are settled first. An ineligible draft named
 *   explicitly in --ids is reported rather than silently passed over.
 *
 *   Only `content-pipeline/drafts/` is touched. A record in `content-pipeline/completed/` has
 *   been published and is not a draft any more; this tool will not open one.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DRAFTS_DIR = join("content-pipeline", "drafts");
const PRODUCT_ID = /^P\d{3}$/;
const SCOPES = ["main", "gallery", "variant", "all"];

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
  console.error(`Usage: node scripts/confirm-images.mjs --scope ${SCOPES.join("|")} [--ids P101,P102] [--apply]`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const scope = readFlag(argv, "--scope");
const idsFlag = readFlag(argv, "--ids");

if (scope === null) usage("--scope is required.");
if (!SCOPES.includes(scope)) usage(`--scope must be one of ${SCOPES.join(", ")}`);

const explicitIds =
  idsFlag === null
    ? null
    : idsFlag
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);

if (explicitIds !== null) {
  if (explicitIds.length === 0) usage("--ids was given but is empty.");
  const malformed = explicitIds.filter((id) => !PRODUCT_ID.test(id));
  if (malformed.length > 0) usage(`Not product ids: ${malformed.join(", ")}`);
}

function draftIdsOnDisk() {
  return readdirSync(DRAFTS_DIR)
    .filter((file) => file.endsWith(".json") && !file.includes("-similarity"))
    .map((file) => file.replace(/\.json$/, ""))
    .filter((id) => PRODUCT_ID.test(id))
    .sort();
}

function everyAttributeConfirmed(draft) {
  const attributes = draft.attributes ?? [];
  return attributes.length > 0 && attributes.every((attribute) => attribute.confirmed === true);
}

function targetsIn(draft) {
  const general = draft.images?.general ?? [];
  const variantImages = draft.images?.variantImages ?? {};
  const gallery = scope === "main" ? general.slice(0, 1) : general;

  return [
    ...(scope === "variant" ? [] : gallery),
    ...(scope === "gallery" || scope === "main" ? [] : Object.values(variantImages)),
  ];
}

const ids = explicitIds ?? draftIdsOnDisk();
const changed = [];
const alreadyDone = [];
const ineligible = [];
const missing = [];

for (const id of ids) {
  const path = join(DRAFTS_DIR, `${id}.json`);
  if (!existsSync(path)) {
    if (explicitIds !== null) missing.push(`${id}: no draft at ${path}`);
    continue;
  }

  const draft = JSON.parse(readFileSync(path, "utf8"));

  if (!everyAttributeConfirmed(draft)) {
    if (explicitIds !== null) {
      ineligible.push(`${id}: attributes are not all confirmed — review those first`);
    }
    continue;
  }

  const targets = targetsIn(draft);
  if (targets.length === 0) {
    if (explicitIds !== null) ineligible.push(`${id}: no images in scope "${scope}"`);
    continue;
  }

  const unconfirmed = targets.filter((image) => image.confirmed !== true);
  if (unconfirmed.length === 0) {
    alreadyDone.push(id);
    continue;
  }

  changed.push({ id, count: unconfirmed.length, total: targets.length });
  if (apply) {
    for (const image of unconfirmed) image.confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(apply ? "APPLIED\n" : "DRY RUN — nothing written. Re-run with --apply.\n");
console.log(`scope "${scope}", over ${explicitIds === null ? "every eligible draft" : `${ids.length} named draft(s)`}`);
console.log(`  ${apply ? "confirmed  " : "to confirm "}       ${changed.length} product(s)`);
console.log(`  already fully done  ${alreadyDone.length} product(s)`);
for (const entry of changed) {
  console.log(`    ${entry.id}: ${entry.count} of ${entry.total} image(s) in scope`);
}
if (ineligible.length > 0) {
  console.log(`\n  not eligible (${ineligible.length}):`);
  for (const reason of ineligible) console.log(`    - ${reason}`);
}
if (missing.length > 0) {
  console.log(`\n  not found (${missing.length}):`);
  for (const reason of missing) console.log(`    - ${reason}`);
}

process.exit(missing.length > 0 ? 1 : 0);
