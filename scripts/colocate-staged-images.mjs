import { existsSync, readdirSync, readFileSync, renameSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One-off restructure (2026-08-24, post-pilot audit finding D1): merge each batch's
 * `odoo-{originalId}/` downloader directory into its product's `PNNN/` directory, so that
 * everything belonging to one product lives in one place:
 *
 *     {batch}/PNNN/raw-block.json          (already there)
 *     {batch}/PNNN/images.json             (moved from odoo-{id}/images.json)
 *     {batch}/PNNN/raw/*.webp              (moved from odoo-{id}/raw/)
 *
 * The inert `_complete` marker is dropped, and every `images.*[].sourceFile` string in the raw
 * block (and in any extracted draft) is rewritten to the new location. Safe because no code
 * reads `sourceFile` after Stage 0 writes it — it is human-facing provenance, re-verified
 * against the codebase before this script was run. `sourceNotes.workingId` and
 * `sourceNotes.originalId` stay in the raw block, so the Odoo identity is not lost.
 *
 * Idempotent: a product whose images already sit beside its raw block is left alone.
 */

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listDirectories(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function countFilesRecursively(path) {
  if (!existsSync(path)) return 0;
  let count = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFilesRecursively(join(path, entry.name));
    else count += 1;
  }
  return count;
}

function rewriteSourceFiles(images, fromPrefix, toPrefix) {
  let rewritten = 0;
  const rewriteEntry = (entry) => {
    if (typeof entry?.sourceFile === "string" && entry.sourceFile.startsWith(fromPrefix)) {
      entry.sourceFile = `${toPrefix}${entry.sourceFile.slice(fromPrefix.length)}`;
      rewritten += 1;
    }
  };
  for (const entry of images?.general ?? []) rewriteEntry(entry);
  for (const entry of Object.values(images?.variantImages ?? {})) rewriteEntry(entry);
  return rewritten;
}

export function colocateBatch(batchId, options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const dryRun = options.dryRun ?? false;
  const batchRoot = join(repoRoot, "content-pipeline", "incoming", batchId);
  const draftsRoot = join(repoRoot, "content-pipeline", "drafts");

  const result = {
    batchId,
    productsSeen: 0,
    directoriesMerged: 0,
    alreadyColocated: 0,
    sourceFilesRewritten: 0,
    draftsRewritten: 0,
    markersDropped: 0,
    errors: [],
  };

  const productDirs = listDirectories(batchRoot)
    .filter((name) => /^P\d{3,}$/.test(name))
    .sort();

  for (const productId of productDirs) {
    const productDir = join(batchRoot, productId);
    const rawBlockPath = join(productDir, "raw-block.json");
    if (!existsSync(rawBlockPath)) {
      result.errors.push(`${batchId}/${productId} has no raw-block.json`);
      continue;
    }
    result.productsSeen += 1;

    const rawBlock = readJson(rawBlockPath);
    const workingId = rawBlock?.sourceNotes?.workingId;
    if (typeof workingId !== "string" || workingId.length === 0) {
      result.errors.push(`${batchId}/${productId} raw block carries no sourceNotes.workingId`);
      continue;
    }

    const odooDir = join(batchRoot, workingId);
    const targetRawDir = join(productDir, "raw");

    if (existsSync(odooDir)) {
      if (existsSync(targetRawDir)) {
        result.errors.push(`${batchId}/${productId} already has raw/ but ${workingId}/ still exists`);
        continue;
      }
      if (!dryRun) {
        renameSync(join(odooDir, "raw"), targetRawDir);
        if (existsSync(join(odooDir, "images.json"))) {
          renameSync(join(odooDir, "images.json"), join(productDir, "images.json"));
        }
        if (existsSync(join(odooDir, "_complete"))) {
          rmSync(join(odooDir, "_complete"));
          result.markersDropped += 1;
        }
        const leftovers = readdirSync(odooDir);
        if (leftovers.length > 0) {
          result.errors.push(`${batchId}/${workingId} still holds after the move: ${leftovers.join(", ")}`);
          continue;
        }
        rmdirSync(odooDir);
      }
      result.directoriesMerged += 1;
    } else if (existsSync(targetRawDir)) {
      result.alreadyColocated += 1;
    } else {
      result.errors.push(`${batchId}/${productId}: neither ${workingId}/ nor an already-moved raw/ exists`);
      continue;
    }

    const fromPrefix = `${batchId}/${workingId}/raw/`;
    const toPrefix = `${batchId}/${productId}/raw/`;
    const rewritten = rewriteSourceFiles(rawBlock.images, fromPrefix, toPrefix);
    if (rewritten > 0 && !dryRun) writeJson(rawBlockPath, rawBlock);
    result.sourceFilesRewritten += rewritten;

    const draftFile = join(draftsRoot, `${productId}.json`);
    if (existsSync(draftFile)) {
      const draft = readJson(draftFile);
      const draftRewritten = rewriteSourceFiles(draft.images, fromPrefix, toPrefix);
      if (draftRewritten > 0 && !dryRun) writeJson(draftFile, draft);
      result.sourceFilesRewritten += draftRewritten;
      if (draftRewritten > 0) result.draftsRewritten += 1;
    }
  }

  return result;
}

export function verifyBatchSourceFiles(batchId, repoRoot = DEFAULT_REPO_ROOT) {
  const incomingRoot = join(repoRoot, "content-pipeline", "incoming");
  const batchRoot = join(incomingRoot, batchId);
  const missing = [];
  let checked = 0;

  for (const productId of listDirectories(batchRoot).filter((name) => /^P\d{3,}$/.test(name))) {
    const rawBlockPath = join(batchRoot, productId, "raw-block.json");
    if (!existsSync(rawBlockPath)) continue;
    const rawBlock = readJson(rawBlockPath);
    const entries = [
      ...(rawBlock.images?.general ?? []),
      ...Object.values(rawBlock.images?.variantImages ?? {}),
    ];
    for (const entry of entries) {
      if (typeof entry?.sourceFile !== "string") continue;
      checked += 1;
      if (!existsSync(join(incomingRoot, entry.sourceFile))) {
        missing.push(`${productId}: ${entry.sourceFile}`);
      }
    }
  }

  return { checked, missing };
}

function runCli(argv) {
  const dryRun = argv.includes("--dry-run");
  const batchIds = argv.filter((argument) => !argument.startsWith("--"));
  const incomingRoot = join(DEFAULT_REPO_ROOT, "content-pipeline", "incoming");
  const targets = batchIds.length > 0 ? batchIds : listDirectories(incomingRoot);

  if (targets.length === 0) {
    console.error("No batch directories found under content-pipeline/incoming/");
    return 2;
  }

  let failed = false;
  for (const batchId of targets) {
    const before = countFilesRecursively(join(incomingRoot, batchId));
    const result = colocateBatch(batchId, { dryRun });
    const after = countFilesRecursively(join(incomingRoot, batchId));

    console.log(`${dryRun ? "[dry-run] " : ""}${batchId}:`);
    console.log(`  products seen          ${result.productsSeen}`);
    console.log(`  directories merged     ${result.directoriesMerged}`);
    console.log(`  already co-located     ${result.alreadyColocated}`);
    console.log(`  sourceFile rewrites    ${result.sourceFilesRewritten}`);
    console.log(`  drafts rewritten       ${result.draftsRewritten}`);
    console.log(`  _complete dropped      ${result.markersDropped}`);
    console.log(`  files before/after     ${before} -> ${after} (expected loss = markers dropped)`);

    for (const error of result.errors) console.error(`  ERROR ${error}`);
    if (result.errors.length > 0) failed = true;

    if (!dryRun) {
      const verification = verifyBatchSourceFiles(batchId);
      console.log(`  sourceFile checks      ${verification.checked} checked, ${verification.missing.length} missing`);
      for (const miss of verification.missing) console.error(`  MISSING ${miss}`);
      if (verification.missing.length > 0) failed = true;
    }
  }

  return failed ? 1 : 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(runCli(process.argv.slice(2)));
}
