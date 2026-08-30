import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildKeywordMap, serialiseKeywordMap } from "./backfill-keyword-map.mjs";
import { formatFinding, validatePublishReadiness } from "./validate-draft-a.mjs";
import { BRAND_NAME } from "../config/site-facts.mjs";

const DEFAULT_REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The one-way step. A product record already sits in `data/products.json` carrying
 * `status: "draft"` — written there by the Phase 2 orchestration skill
 * ([ADR-053](../docs/decisions/ADR-053-draft-a-to-product-orchestration.md)) — and this script
 * turns it on.
 *
 * Four things happen together and none of them makes sense without the others:
 *
 * 1. `status` flips `draft` → `active`, which is the whole of what publishing means (ADR-052).
 * 2. `data/keyword-map.json` is regenerated, because the map indexes published products only.
 *    A record becoming active adds its keywords to the map, and a map that has not caught up is
 *    a **hard gate failure** in `validate-products.mjs`. Regenerating here is not a convenience;
 *    without it the next `npm run validate:products` fails on a change this script made.
 * 3. The draft moves from `content-pipeline/drafts/` to `content-pipeline/completed/`, so the
 *    provenance trail behind a live product survives rather than being deleted.
 * 4. The product's staging directory — `content-pipeline/incoming/{batch}/PNNN/`, holding the
 *    raw block and the source images co-located with it (ADR-057) — moves to
 *    `content-pipeline/completed/PNNN/`. Staging then empties as products ship, and `completed/`
 *    holds the full provenance bundle behind each live product. A product with no staging
 *    directory (the fresh, hand-made path) publishes exactly as before.
 *
 * What it deliberately does not do is touch the two tracking registers under
 * `docs/pipeline-prep/`. Those are hand-maintained human indexes over an untracked directory
 * and say so in their own headers; a script editing them would make them a derived artefact
 * that nothing derives. The CLI prints the reminder instead.
 */

export function catalogueFilePath(repoRoot = DEFAULT_REPO_ROOT) {
  return join(repoRoot, "data", "products.json");
}

export function keywordMapPath(repoRoot = DEFAULT_REPO_ROOT) {
  return join(repoRoot, "data", "keyword-map.json");
}

export function draftPath(productId, repoRoot = DEFAULT_REPO_ROOT) {
  return join(repoRoot, "content-pipeline", "drafts", `${productId}.json`);
}

export function completedPath(productId, repoRoot = DEFAULT_REPO_ROOT) {
  return join(repoRoot, "content-pipeline", "completed", `${productId}.json`);
}

export function similarityReportPath(productId, repoRoot = DEFAULT_REPO_ROOT) {
  return join(repoRoot, "content-pipeline", "drafts", `${productId}-similarity.json`);
}

/**
 * Finds the product's staging directory by scanning every batch under
 * `content-pipeline/incoming/` for a `PNNN/` directory carrying a `raw-block.json`, so the
 * publish step stays batch-agnostic. Returns null when the product has no staging directory,
 * which is the normal case for the fresh, hand-made intake path.
 */
export function stagingDirPath(productId, repoRoot = DEFAULT_REPO_ROOT) {
  const incomingRoot = join(repoRoot, "content-pipeline", "incoming");
  if (!existsSync(incomingRoot)) return null;

  for (const entry of readdirSync(incomingRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(incomingRoot, entry.name, productId);
    if (existsSync(join(candidate, "raw-block.json"))) return candidate;
  }
  return null;
}

export function completedStagingPath(productId, repoRoot = DEFAULT_REPO_ROOT) {
  return join(repoRoot, "content-pipeline", "completed", productId);
}

/** Byte-identical to how `data/products.json` is already written, so a publish is a one-line diff. */
export function serialiseCatalogue(catalogue) {
  return `${JSON.stringify(catalogue, null, 2)}\n`;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * The status flip as a pure function over the parsed catalogue. Returns a new array; the input
 * is not mutated, so a caller that decides not to write has not already changed anything.
 *
 * Refusing an already-active product matters more than it looks: it is the difference between
 * "this publish did nothing" and "this publish re-published something", and the second is how a
 * completed draft gets moved a second time and a register row gets written twice.
 */
export function activateProduct(catalogue, productId) {
  if (!Array.isArray(catalogue)) {
    return { catalogue: null, error: "data/products.json did not parse to an array" };
  }

  const index = catalogue.findIndex((product) => product?.id === productId);
  if (index === -1) {
    return {
      catalogue: null,
      error: `${productId} is not in data/products.json. The orchestration skill writes the record; this script only turns it on`,
    };
  }

  const product = catalogue[index];
  if (product.status === "active") {
    return { catalogue: null, error: `${productId} is already active — nothing to publish` };
  }
  if (product.status !== "draft") {
    return {
      catalogue: null,
      error: `${productId} has status ${JSON.stringify(product.status)}, which is neither draft nor active`,
    };
  }

  const updated = [...catalogue];
  updated[index] = { ...product, status: "active" };
  return { catalogue: updated, error: null, product: updated[index] };
}

/**
 * Re-runs the post-review check over the draft file. It passed once, before the record was
 * built; it is run again here because publish is the irreversible step and the draft file is
 * hand-edited between the two. A draft that has lost its price or had an attribute unconfirmed
 * since Phase 2 stops here.
 */
export function checkDraftStillReady(productId, repoRoot = DEFAULT_REPO_ROOT) {
  const path = draftPath(productId, repoRoot);
  if (!existsSync(path)) {
    return {
      ready: false,
      errors: [
        `content-pipeline/drafts/${productId}.json does not exist. A published product keeps its draft as its provenance trail; publishing without one would leave the record unsourced`,
      ],
    };
  }

  let draft = null;
  try {
    draft = readJson(path);
  } catch (cause) {
    return { ready: false, errors: [`content-pipeline/drafts/${productId}.json is not valid JSON: ${cause.message}`] };
  }

  const result = validatePublishReadiness(draft, { label: `content-pipeline/drafts/${productId}.json` });
  return {
    ready: result.errors.length === 0,
    errors: result.errors.map((finding) => formatFinding(finding, "error", result.productId)),
  };
}

/**
 * Everything, in the order that leaves the least behind if a step throws: every check runs
 * before any write, the catalogue and the keyword map are written together, and the file move
 * is last because it is the only step that cannot be re-run.
 */
export function publishProduct(productId, options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const catalogueFile = catalogueFilePath(repoRoot);

  if (typeof productId !== "string" || productId.trim().length === 0) {
    return { published: false, errors: ["a productId is required"], warnings: [] };
  }

  const readiness = checkDraftStillReady(productId, repoRoot);
  if (!readiness.ready) {
    return { published: false, errors: readiness.errors, warnings: [] };
  }

  let catalogue = null;
  try {
    catalogue = readJson(catalogueFile);
  } catch (cause) {
    return { published: false, errors: [`data/products.json is not readable: ${cause.message}`], warnings: [] };
  }

  const activation = activateProduct(catalogue, productId);
  if (activation.error !== null) {
    return { published: false, errors: [activation.error], warnings: [] };
  }

  const stagingDir = stagingDirPath(productId, repoRoot);
  const stagingDestination = completedStagingPath(productId, repoRoot);
  if (stagingDir !== null && existsSync(stagingDestination)) {
    return {
      published: false,
      errors: [
        `content-pipeline/completed/${productId}/ already exists, but ${productId}'s staging directory is still in incoming/. Resolve the duplicate before publishing`,
      ],
      warnings: [],
    };
  }

  const keywordMap = buildKeywordMap(activation.catalogue);
  const duplicatePrimary = Object.entries(keywordMap.primary).filter(([, ids]) => ids.length > 1);
  if (duplicatePrimary.length > 0) {
    return {
      published: false,
      errors: duplicatePrimary.map(
        ([keyword, ids]) =>
          `publishing ${productId} would give "${keyword}" two owners: ${ids.join(", ")}. Two published products cannot target one primary keyword`,
      ),
      warnings: [],
    };
  }

  writeFileSync(catalogueFile, serialiseCatalogue(activation.catalogue), "utf8");
  writeFileSync(keywordMapPath(repoRoot), serialiseKeywordMap(keywordMap), "utf8");

  const destination = completedPath(productId, repoRoot);
  mkdirSync(dirname(destination), { recursive: true });
  renameSync(draftPath(productId, repoRoot), destination);

  let stagingMovedTo = null;
  if (stagingDir !== null) {
    renameSync(stagingDir, stagingDestination);
    stagingMovedTo = `content-pipeline/completed/${productId}/`;
  }

  const warnings = [];
  const similarityReport = similarityReportPath(productId, repoRoot);
  if (existsSync(similarityReport)) {
    warnings.push(
      `content-pipeline/drafts/${productId}-similarity.json was left in place. It is the advisory record of the similarity gate and is not part of the draft`,
    );
  }

  return {
    published: true,
    errors: [],
    warnings,
    productId,
    name: activation.product.name,
    category: activation.product.category,
    publishedProductCount: keywordMap.productCount,
    movedTo: `content-pipeline/completed/${productId}.json`,
    stagingMovedTo,
  };
}

function printOwnerReminder(result) {
  console.log("\nTwo files are yours to update by hand. Nothing generates them and nothing reads them:");
  console.log("  docs/pipeline-prep/drafts-in-progress.md");
  console.log(`    Delete the ${result.productId} row.`);
  console.log("  docs/pipeline-prep/products-completed.md");
  console.log(
    `    Add: | ${result.productId} | ${result.name} | ${result.category} | <the date this commit lands> |`,
  );
  console.log(
    "\nThe published date is the date the commit lands, not today — a product becomes real in a commit (ADR-001).",
  );
}

function runCli(argv) {
  const productId = argv[0];
  if (!productId) {
    console.error("Usage: node scripts/publish-product.mjs <productId>");
    console.error("  Flips a draft product to active, regenerates the keyword map, and files its draft.");
    return 2;
  }

  console.log(`${BRAND_NAME} — publishing ${productId}\n`);
  const result = publishProduct(productId);

  if (!result.published) {
    console.error(`REFUSED — ${productId} was not published:`);
    for (const message of result.errors) console.error(`  - ${message}`);
    return 1;
  }

  console.log(`  status            draft -> active`);
  console.log(`  name              ${result.name}`);
  console.log(`  keyword map       rewritten, ${result.publishedProductCount} published product(s)`);
  console.log(`  draft filed       ${result.movedTo}`);
  if (result.stagingMovedTo !== null) {
    console.log(`  staging filed     ${result.stagingMovedTo}`);
  }

  for (const warning of result.warnings) console.log(`\nNOTE — ${warning}`);

  printOwnerReminder(result);
  console.log("\nPUBLISHED. Run the full gate before committing.");
  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(runCli(process.argv.slice(2)));
}
