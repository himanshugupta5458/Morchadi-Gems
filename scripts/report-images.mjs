import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Read-only report over the pipeline's image state — the reviewer's map of where every
 * photograph stands, proposed by the post-pilot audit (finding D4, ADR-057). It writes nothing
 * and gates nothing. Four sections:
 *
 * 1. Per-product confirmation status: confirmed vs total image suggestions, from every queued
 *    raw block and every draft in review.
 * 2. Duplicate-hash groups: byte-identical files across ALL staged and published-bundle images,
 *    grouped so a reviewer sees the whole cluster at once — including clusters that span
 *    already-published products and still-queued ones. This is the check that would have
 *    surfaced, before publish, that 10 of the 11 pilot products shared a main photo with a
 *    queued twin.
 * 3. Confirmed image paths with no file under `public/` — pre-empting `validate:products`.
 * 4. Orphaned staging directories: anything under `incoming/{batch}/` that is not a product
 *    directory carrying a raw block, and not a known batch-level artefact.
 *
 * Usage: `npm run report:images` (all batches) or `npm run report:images -- <batch-id>`.
 */

const BATCH_LEVEL_FILES = new Set([
  "manifest.json",
  "needs-attention.md",
  "draft-a-input.jsonl",
  "download-report.csv",
  "watch-pair-check.csv",
  "variant-image-check.csv",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listEntries(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true });
}

function isProductId(name) {
  return /^P\d{3,}$/.test(name);
}

function sha256Of(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function imageEntriesOf(block) {
  return [
    ...(block.images?.general ?? []).map((entry) => ({ ...entry, kind: "general" })),
    ...Object.entries(block.images?.variantImages ?? {}).map(([key, entry]) => ({
      ...entry,
      kind: `variant ${key}`,
    })),
  ];
}

export function collectImageReport(options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const onlyBatch = options.batchId ?? null;
  const incomingRoot = join(repoRoot, "content-pipeline", "incoming");
  const draftsRoot = join(repoRoot, "content-pipeline", "drafts");
  const completedRoot = join(repoRoot, "content-pipeline", "completed");
  const publicRoot = join(repoRoot, "public");

  const products = [];
  const stagedFiles = [];
  const orphans = [];

  const batchNames = listEntries(incomingRoot)
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => onlyBatch === null || name === onlyBatch);

  for (const batchId of batchNames) {
    const batchRoot = join(incomingRoot, batchId);
    for (const entry of listEntries(batchRoot)) {
      const entryPath = join(batchRoot, entry.name);
      if (!entry.isDirectory()) {
        if (!BATCH_LEVEL_FILES.has(entry.name)) orphans.push(`${batchId}/${entry.name} (unexpected file)`);
        continue;
      }
      if (!isProductId(entry.name)) {
        orphans.push(`${batchId}/${entry.name}/ (not a product directory)`);
        continue;
      }
      const rawBlockPath = join(entryPath, "raw-block.json");
      if (!existsSync(rawBlockPath)) {
        orphans.push(`${batchId}/${entry.name}/ (no raw-block.json)`);
        continue;
      }

      const rawBlock = readJson(rawBlockPath);
      const draftPath = join(draftsRoot, `${entry.name}.json`);
      const activeBlock = existsSync(draftPath) ? readJson(draftPath) : rawBlock;
      const stage = existsSync(draftPath) ? "in drafts/" : (rawBlock.stage ?? "queued");
      const entries = imageEntriesOf(activeBlock);

      products.push({
        productId: entry.name,
        batchId,
        stage,
        total: entries.length,
        confirmed: entries.filter((image) => image.confirmed === true).length,
        confirmedMissingUnderPublic: entries
          .filter((image) => image.confirmed === true && typeof image.path === "string")
          .filter((image) => !existsSync(join(publicRoot, image.path.replace(/^\//, ""))))
          .map((image) => image.path),
      });

      for (const file of listEntries(join(entryPath, "raw")).filter((rawEntry) => rawEntry.isFile())) {
        stagedFiles.push({
          productId: entry.name,
          status: "queued",
          file: file.name,
          hash: sha256Of(join(entryPath, "raw", file.name)),
        });
      }
    }
  }

  for (const entry of listEntries(completedRoot).filter((candidate) => candidate.isDirectory())) {
    if (!isProductId(entry.name)) continue;
    const rawDir = join(completedRoot, entry.name, "raw");
    for (const file of listEntries(rawDir).filter((rawEntry) => rawEntry.isFile())) {
      stagedFiles.push({
        productId: entry.name,
        status: "published",
        file: file.name,
        hash: sha256Of(join(rawDir, file.name)),
      });
    }
  }

  const byHash = new Map();
  for (const staged of stagedFiles) {
    const group = byHash.get(staged.hash) ?? [];
    group.push(staged);
    byHash.set(staged.hash, group);
  }
  const duplicateGroups = [...byHash.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([hash, members]) => ({
      hash,
      members,
      involvesMainImage: members.some((member) => member.file === "main.webp"),
      spansPublished: members.some((member) => member.status === "published"),
      productIds: [...new Set(members.map((member) => member.productId))],
    }))
    .filter((group) => group.productIds.length > 1)
    .sort((a, b) => Number(b.involvesMainImage) - Number(a.involvesMainImage) || Number(b.spansPublished) - Number(a.spansPublished));

  return { products, stagedFiles, duplicateGroups, orphans };
}

function runCli(argv) {
  const batchId = argv.find((argument) => !argument.startsWith("--")) ?? null;
  const verbose = argv.includes("--all-products");
  const report = collectImageReport({ batchId });

  console.log("Morchadi Gems — image pipeline report (read-only)\n");

  const untouched = report.products.filter((product) => product.confirmed === 0);
  const inProgress = report.products.filter(
    (product) => product.confirmed > 0 && product.confirmed < product.total,
  );
  const fullyConfirmed = report.products.filter(
    (product) => product.total > 0 && product.confirmed === product.total,
  );

  console.log("== Confirmation status ==");
  console.log(`  products in staging       ${report.products.length}`);
  console.log(`  fully unconfirmed         ${untouched.length}`);
  console.log(`  partially confirmed       ${inProgress.length}`);
  console.log(`  fully confirmed           ${fullyConfirmed.length}`);
  const listed = verbose ? report.products : [...inProgress, ...fullyConfirmed];
  for (const product of listed) {
    console.log(`    ${product.productId}  ${product.confirmed}/${product.total} confirmed  (${product.stage})`);
  }

  console.log("\n== Duplicate-hash groups (byte-identical images across products) ==");
  console.log(`  staged files hashed       ${report.stagedFiles.length}`);
  console.log(`  cross-product groups      ${report.duplicateGroups.length}`);
  console.log(`  involving a main image    ${report.duplicateGroups.filter((group) => group.involvesMainImage).length}`);
  console.log(`  spanning a published one  ${report.duplicateGroups.filter((group) => group.spansPublished).length}`);
  for (const group of report.duplicateGroups) {
    const labels = [group.involvesMainImage ? "MAIN" : null, group.spansPublished ? "SPANS-PUBLISHED" : null]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${group.hash.slice(0, 12)}…${labels ? `  [${labels}]` : ""}`);
    for (const member of group.members) {
      console.log(`    ${member.productId}  ${member.file}  (${member.status})`);
    }
  }

  const missing = report.products.filter((product) => product.confirmedMissingUnderPublic.length > 0);
  console.log("\n== Confirmed paths with no file under public/ ==");
  if (missing.length === 0) console.log("  none");
  for (const product of missing) {
    for (const path of product.confirmedMissingUnderPublic) {
      console.log(`  ${product.productId}  ${path}`);
    }
  }

  console.log("\n== Orphaned staging entries ==");
  if (report.orphans.length === 0) console.log("  none");
  for (const orphan of report.orphans) console.log(`  ${orphan}`);

  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(runCli(process.argv.slice(2)));
}
