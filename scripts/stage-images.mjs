import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BRAND_NAME } from "../config/site-facts.mjs";

/**
 * stage-images — copy a product's **confirmed** staged photographs to the paths its record
 * claims under `public/products/`.
 *
 * This is the step that did not exist. Between Draft A review and a live product there was one
 * move nothing performed: the photograph the reviewer confirmed sat in the pipeline's `raw/`
 * directory, the record named `/products/PNNN.webp`, and the only thing joining the two was a
 * hand-typed `cp`. `docs/pipeline-prep/README.md` step 7 said so outright — "no script performs
 * the copy" — and the 2026-08-24 audit (finding D4) asked for this script by name. When the
 * copy was skipped the catalogue gate failed on a missing file, and the nearest documented
 * remedy was `npm run generate:placeholders`, which writes a generated graphic at exactly that
 * path and never overwrites it again. 206 products shipped a placeholder over a real photograph
 * that way.
 *
 * **The destination is read, never derived.** A confirmed image entry already carries both
 * halves: `sourceFile` names the staged file and `path` names where the record says it belongs,
 * and `mapImagesToMedia` copies that same `path` into `media` verbatim. Deriving a second
 * opinion here — re-slugging a variant value, re-numbering an extra view — would be a second
 * implementation of a convention that already has one, and the two would agree only until one
 * of them changed. So this script carries `sourceFile` to `path` and asserts that `path` belongs
 * to the product it came from.
 *
 * **It never overwrites without being told to.** A file already at the destination is left
 * alone, and `--force` reports what it replaced rather than replacing it quietly — the thing at
 * risk is photography that may exist nowhere else, which is the same reason
 * `generate-placeholders.mjs` has no force flag at all. This script does not read, call or know
 * about that one; a placeholder standing where a photograph belongs is a fact about
 * `public/products/`, not about the generator.
 *
 * Usage:
 *   node scripts/stage-images.mjs P566                 one product
 *   node scripts/stage-images.mjs P566 P567 P568       several
 *   node scripts/stage-images.mjs P566 --dry-run       resolve and report, write nothing
 *   node scripts/stage-images.mjs P566 --force         replace what is already there
 */

/**
 * @typedef {object} StagedImage
 * @property {string} label which entry of the record this came from
 * @property {string} publicPath the path the record claims, e.g. `/products/P900-wine-red.webp`
 * @property {string} destination that path resolved against this repository
 * @property {string | null} sourceFile the staged file the record names, batch-relative
 * @property {string | null} source that file resolved on disk, or null if it is not there
 * @property {"copy" | "identical" | "differs" | "no-source" | "unresolved"} status
 * @property {number} [bytes] the staged file's size, once copied
 * @property {number | null} [replacedBytes] the size of what an overwrite replaced
 *
 * @typedef {object} StagingPlan
 * @property {string} productId
 * @property {string | null} recordPath
 * @property {StagedImage[]} entries
 * @property {string[]} errors
 *
 * @typedef {object} StagingResult
 * @property {string} productId
 * @property {StagedImage[]} copied
 * @property {StagedImage[]} overwritten
 * @property {StagedImage[]} identical
 * @property {StagedImage[]} blocked
 * @property {StagedImage[]} unresolved
 * @property {StagedImage[]} noSource
 * @property {string[]} errors
 */

const DEFAULT_REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT_ID_PATTERN = /^P\d{3,}$/;
const PRODUCT_IMAGE_PREFIX = "/products/";
const IMAGE_EXTENSION = ".webp";

/**
 * The record behind a product, wherever it currently lives. A draft under review is in
 * `drafts/`; publishing moves it to `completed/`. Publish itself passes its own path rather
 * than relying on this, because it runs mid-move.
 */
export function pipelineRecordPath(productId, repoRoot = DEFAULT_REPO_ROOT) {
  const inReview = join(repoRoot, "content-pipeline", "drafts", `${productId}.json`);
  if (existsSync(inReview)) return inReview;

  const filed = join(repoRoot, "content-pipeline", "completed", `${productId}.json`);
  if (existsSync(filed)) return filed;

  return null;
}

/**
 * A `sourceFile` is written batch-relative — `2026-08-23-batch-01/P426/raw/main.webp` — and the
 * directory it names moves when the product publishes. Both locations are tried, and the filed
 * one is matched on the file's own name because the staging directory is renamed from its
 * working id to the product id on the way (`odoo-124/raw/main.webp` becomes `P106/raw/main.webp`).
 */
export function resolveStagedSource(sourceFile, productId, repoRoot = DEFAULT_REPO_ROOT) {
  if (typeof sourceFile !== "string" || sourceFile.trim().length === 0) return null;

  const relative = sourceFile.trim().replace(/^\/+/, "");
  const queued = join(repoRoot, "content-pipeline", "incoming", relative);
  if (existsSync(queued)) return queued;

  const filed = join(repoRoot, "content-pipeline", "completed", productId, "raw", basename(relative));
  if (existsSync(filed)) return filed;

  return null;
}

function confirmedImagesOf(record) {
  const general = Array.isArray(record?.images?.general) ? record.images.general : [];
  const variantImages =
    record?.images?.variantImages !== null && typeof record?.images?.variantImages === "object"
      ? record.images.variantImages
      : {};

  return [
    ...general.map((image, index) => ({ image, label: `images.general[${index}]` })),
    ...Object.entries(variantImages).map(([key, image]) => ({
      image,
      label: `images.variantImages["${key}"]`,
    })),
  ].filter(({ image }) => image?.confirmed === true);
}

function destinationProblem(publicPath, productId) {
  if (typeof publicPath !== "string" || publicPath.trim().length === 0) {
    return "carries no path";
  }
  if (!publicPath.startsWith(PRODUCT_IMAGE_PREFIX) || !publicPath.endsWith(IMAGE_EXTENSION)) {
    return `names ${publicPath}, which is not a ${PRODUCT_IMAGE_PREFIX}…${IMAGE_EXTENSION} path`;
  }

  const fileName = publicPath.slice(PRODUCT_IMAGE_PREFIX.length);
  const belongsToProduct =
    fileName === `${productId}${IMAGE_EXTENSION}` || fileName.startsWith(`${productId}-`);

  if (!belongsToProduct) {
    return `names ${publicPath}, which is filed under another product's id`;
  }
  return null;
}

function sameBytes(left, right) {
  if (statSync(left).size !== statSync(right).size) return false;
  return readFileSync(left).equals(readFileSync(right));
}

/**
 * Everything the copy would do, decided before anything is written, so a caller can refuse the
 * whole product on one unresolvable source rather than discovering it half way through.
 *
 * A confirmed entry whose `sourceFile` is null is not an error: it is a product photographed by
 * hand rather than migrated, and there is nothing staged to carry. A `sourceFile` that names a
 * file which is not there is a different thing entirely — the record claims a photograph the
 * repository cannot produce — and that is `unresolved`.
 *
 * @param {string} productId
 * @param {{repoRoot?: string, recordPath?: string | null}} [options]
 * @returns {StagingPlan}
 */
export function collectStagingPlan(productId, options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const recordPath = options.recordPath ?? pipelineRecordPath(productId, repoRoot);

  if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) {
    return { productId, recordPath: null, entries: [], errors: [`${productId} is not a product id`] };
  }
  if (recordPath === null || !existsSync(recordPath)) {
    return { productId, recordPath: null, entries: [], errors: [] };
  }

  let record = null;
  try {
    record = JSON.parse(readFileSync(recordPath, "utf8"));
  } catch (cause) {
    return {
      productId,
      recordPath,
      entries: [],
      errors: [`${recordPath} is not valid JSON: ${cause.message}`],
    };
  }

  const entries = [];
  const errors = [];

  for (const { image, label } of confirmedImagesOf(record)) {
    const problem = destinationProblem(image?.path, productId);
    if (problem !== null) {
      errors.push(`${productId} ${label} ${problem}`);
      continue;
    }

    const destination = join(repoRoot, "public", image.path.replace(/^\//, ""));
    const source = resolveStagedSource(image.sourceFile, productId, repoRoot);
    const entry = {
      label,
      publicPath: image.path,
      destination,
      sourceFile: image.sourceFile ?? null,
      source,
    };

    if (typeof image.sourceFile !== "string" || image.sourceFile.trim().length === 0) {
      entries.push({ ...entry, status: "no-source" });
      continue;
    }
    if (source === null) {
      entries.push({ ...entry, status: "unresolved" });
      continue;
    }
    if (!existsSync(destination)) {
      entries.push({ ...entry, status: "copy" });
      continue;
    }

    entries.push({ ...entry, status: sameBytes(source, destination) ? "identical" : "differs" });
  }

  return { productId, recordPath, entries, errors };
}

/**
 * Performs the plan. `differs` is only acted on under `force`, and the sizes either side of an
 * overwrite are captured here rather than by the caller, because after the copy the file that
 * was replaced is gone.
 *
 * @param {StagingPlan} plan
 * @param {{force?: boolean, dryRun?: boolean}} [options]
 * @returns {StagingResult}
 */
export function applyStagingPlan(plan, options = {}) {
  const force = options.force === true;
  const dryRun = options.dryRun === true;

  const result = {
    productId: plan.productId,
    copied: [],
    overwritten: [],
    identical: [],
    blocked: [],
    unresolved: [],
    noSource: [],
    errors: [...plan.errors],
  };

  for (const entry of plan.entries) {
    if (entry.status === "no-source") {
      result.noSource.push(entry);
      continue;
    }
    if (entry.status === "unresolved") {
      result.unresolved.push(entry);
      continue;
    }
    if (entry.status === "identical") {
      result.identical.push(entry);
      continue;
    }
    if (entry.status === "differs" && !force) {
      result.blocked.push(entry);
      continue;
    }

    const replacedBytes = entry.status === "differs" ? statSync(entry.destination).size : null;
    if (!dryRun) {
      mkdirSync(dirname(entry.destination), { recursive: true });
      copyFileSync(entry.source, entry.destination);
    }

    const record = { ...entry, replacedBytes, bytes: statSync(entry.source).size };
    if (entry.status === "differs") result.overwritten.push(record);
    else result.copied.push(record);
  }

  return result;
}

/**
 * The whole step for one product. Publish calls this; so does the CLI. Deliberately synchronous
 * and image-library-free — it moves bytes and compares bytes, and nothing here needs to decode a
 * photograph. The CLI adds dimensions to an overwrite report on its own.
 *
 * @param {string} productId
 * @param {{repoRoot?: string, recordPath?: string | null, force?: boolean, dryRun?: boolean}} [options]
 * @returns {StagingResult}
 */
export function stageProductImages(productId, options = {}) {
  return applyStagingPlan(collectStagingPlan(productId, options), options);
}

export function describeUnresolved(entry, productId) {
  return `${productId} ${entry.label} is confirmed and names ${entry.sourceFile}, but no such file is staged under content-pipeline/incoming/ or content-pipeline/completed/${productId}/raw/`;
}

async function readDimensions(path) {
  try {
    const { default: sharp } = await import("sharp");
    const { width, height } = await sharp(path).metadata();
    return `${width}x${height}`;
  } catch {
    return "unreadable";
  }
}

function parseArgs(argv) {
  const ids = argv.filter((token) => !token.startsWith("--"));
  const flags = argv.filter((token) => token.startsWith("--"));
  const unknown = flags.filter((flag) => !["--force", "--dry-run"].includes(flag));

  return {
    ids,
    force: flags.includes("--force"),
    dryRun: flags.includes("--dry-run"),
    unknown,
  };
}

async function runCli(argv) {
  const { ids, force, dryRun, unknown } = parseArgs(argv);

  if (unknown.length > 0) {
    console.error(`Unknown flag(s): ${unknown.join(", ")}`);
    return 2;
  }
  if (ids.length === 0) {
    console.error("Usage: node scripts/stage-images.mjs <productId...> [--force] [--dry-run]");
    console.error("  Copies every confirmed staged photograph to the path the record claims.");
    console.error("  --force    replace a file already at the destination, reporting what it was");
    console.error("  --dry-run  resolve and report, writing nothing");
    return 2;
  }

  const malformed = ids.filter((id) => !PRODUCT_ID_PATTERN.test(id));
  if (malformed.length > 0) {
    console.error(`Not product ids: ${malformed.join(", ")}`);
    return 2;
  }

  console.log(`${BRAND_NAME} — staging confirmed photographs for ${ids.length} product(s)\n`);
  if (dryRun) console.log("DRY RUN — nothing will be written.\n");

  const tally = { copied: 0, overwritten: 0, identical: 0, blocked: 0, unresolved: 0, noSource: 0 };
  const problems = [];

  for (const id of ids) {
    const plan = collectStagingPlan(id, { force, dryRun });

    const beforeOverwrite = new Map();
    for (const entry of plan.entries) {
      if (entry.status === "differs" && force) {
        beforeOverwrite.set(entry.destination, await readDimensions(entry.destination));
      }
    }

    const result = applyStagingPlan(plan, { force, dryRun });

    if (plan.recordPath === null) {
      console.log(`  ${id}  no pipeline record — nothing staged for this product`);
      continue;
    }

    for (const entry of result.copied) {
      const verb = dryRun ? "would copy " : "copied     ";
      console.log(`  ${id}  ${verb} ${entry.publicPath}  (${entry.bytes} B, from ${entry.sourceFile})`);
    }
    for (const entry of result.overwritten) {
      const after = dryRun ? await readDimensions(entry.source) : await readDimensions(entry.destination);
      console.log(`  ${id}  OVERWROTE   ${entry.publicPath}`);
      console.log(`        before  ${entry.replacedBytes} B, ${beforeOverwrite.get(entry.destination)}`);
      console.log(`        after   ${entry.bytes} B, ${after}  (from ${entry.sourceFile})`);
    }
    for (const entry of result.identical) {
      console.log(`  ${id}  skipped     ${entry.publicPath}  (already the staged photograph)`);
    }
    for (const entry of result.blocked) {
      console.log(`  ${id}  skipped     ${entry.publicPath}  (a different file is there — pass --force to replace it)`);
    }
    for (const entry of result.noSource) {
      console.log(`  ${id}  no source   ${entry.publicPath}  (confirmed, but the record stages no file for it)`);
    }
    for (const entry of result.unresolved) {
      problems.push(describeUnresolved(entry, id));
    }
    problems.push(...result.errors);

    tally.copied += result.copied.length;
    tally.overwritten += result.overwritten.length;
    tally.identical += result.identical.length;
    tally.blocked += result.blocked.length;
    tally.unresolved += result.unresolved.length;
    tally.noSource += result.noSource.length;
  }

  const label = (text) => text.padEnd(20);
  console.log(`\n${label(dryRun ? "Would copy" : "Copied")}${tally.copied}`);
  console.log(`${label(dryRun ? "Would overwrite" : "Overwritten")}${tally.overwritten}`);
  console.log(`${label("Skipped, identical")}${tally.identical}`);
  console.log(`${label("Skipped, differs")}${tally.blocked}`);
  console.log(`${label("Confirmed, unstaged")}${tally.noSource}`);
  console.log(`${label("UNRESOLVED")}${tally.unresolved}`);

  if (problems.length > 0) {
    console.error(`\nFAIL — ${problems.length} confirmed image(s) could not be resolved:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }

  console.log("\nOK.");
  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exit(await runCli(process.argv.slice(2)));
}
