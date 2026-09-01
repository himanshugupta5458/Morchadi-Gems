import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  collectStagingPlan,
  pipelineRecordPath,
  resolveStagedSource,
  stageProductImages,
} from "@/scripts/stage-images.mjs";

/**
 * The step that did not exist, tested the only way it can be: against a synthetic repository
 * under the OS temp directory. The real one holds 206 products whose published image is a
 * generated graphic standing over a real photograph, and a test with a `--force` case in it
 * must never be able to reach them.
 *
 * The bytes here are short strings rather than images on purpose. This script copies and
 * compares bytes and decodes nothing, and a test that needed a real WebP to prove a copy
 * happened would be testing `sharp`.
 */
let root = "";

const STAGED_PHOTO = "staged-photograph-bytes";
const PLACEHOLDER = "flat-generated-graphic";

function draftWithImages(
  productId: string,
  general: Record<string, unknown>[],
  variantImages: Record<string, unknown> = {},
): Record<string, unknown> {
  return { productId, images: { general, variantImages } };
}

function confirmedImage(path: string, sourceFile: string | null): Record<string, unknown> {
  return { path, confirmed: true, sourceFile, role: "main" };
}

function writeDraft(productId: string, draft: unknown): void {
  const directory = join(root, "content-pipeline", "drafts");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${productId}.json`), `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

function writeStagedFile(relativePath: string, contents = STAGED_PHOTO): void {
  const absolute = join(root, "content-pipeline", "incoming", relativePath);
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, contents, "utf8");
}

function writePublished(fileName: string, contents: string): void {
  const directory = join(root, "public", "products");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, fileName), contents, "utf8");
}

function publishedFile(fileName: string): string {
  return join(root, "public", "products", fileName);
}

function stage(productId: string, options: Record<string, unknown> = {}) {
  return stageProductImages(productId, { repoRoot: root, ...options });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "morchadi-stage-images-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolveStagedSource", () => {
  it("finds a source still queued under incoming/", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");

    expect(resolveStagedSource("batch-01/P900/raw/main.webp", "P900", root)).toBe(
      join(root, "content-pipeline", "incoming", "batch-01/P900/raw/main.webp"),
    );
  });

  /**
   * Publishing renames the staging directory from its working id to the product id, so the
   * path recorded at review time stops resolving. The file's own name is what survives.
   */
  it("finds a source the publish step already filed under completed/, by file name", () => {
    const filed = join(root, "content-pipeline", "completed", "P900", "raw");
    mkdirSync(filed, { recursive: true });
    writeFileSync(join(filed, "main.webp"), STAGED_PHOTO, "utf8");

    expect(resolveStagedSource("batch-01/odoo-124/raw/main.webp", "P900", root)).toBe(
      join(filed, "main.webp"),
    );
  });

  it("returns null for a source that is nowhere, and for a record that stages none", () => {
    expect(resolveStagedSource("batch-01/P900/raw/main.webp", "P900", root)).toBeNull();
    expect(resolveStagedSource(null, "P900", root)).toBeNull();
    expect(resolveStagedSource("", "P900", root)).toBeNull();
  });
});

describe("pipelineRecordPath", () => {
  it("prefers the draft under review, then the filed one", () => {
    expect(pipelineRecordPath("P900", root)).toBeNull();

    const completed = join(root, "content-pipeline", "completed");
    mkdirSync(completed, { recursive: true });
    writeFileSync(join(completed, "P900.json"), "{}", "utf8");
    expect(pipelineRecordPath("P900", root)).toBe(join(completed, "P900.json"));

    writeDraft("P900", {});
    expect(pipelineRecordPath("P900", root)).toBe(
      join(root, "content-pipeline", "drafts", "P900.json"),
    );
  });
});

describe("stageProductImages", () => {
  it("copies a confirmed photograph to the path the record claims", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp")]));

    const result = stage("P900");

    expect(result.copied).toHaveLength(1);
    expect(result.unresolved).toEqual([]);
    expect(readFileSync(publishedFile("P900.webp"), "utf8")).toBe(STAGED_PHOTO);
  });

  /**
   * The destination is read from the record, never rebuilt from the option value. Re-deriving
   * `wine-red` from `Wine Red` here would be a second implementation of a convention that
   * already has one in the draft, and the two would agree only until one of them changed.
   */
  it("carries extras and variant images to the exact paths the record spells", () => {
    writeStagedFile("batch-01/P900/raw/main.webp", "main");
    writeStagedFile("batch-01/P900/raw/extra-1.webp", "extra");
    writeStagedFile("batch-01/P900/raw/variant-wine-red.webp", "variant");
    writeDraft(
      "P900",
      draftWithImages(
        "P900",
        [
          confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp"),
          confirmedImage("/products/P900-2.webp", "batch-01/P900/raw/extra-1.webp"),
        ],
        {
          "Colour:Wine Red": confirmedImage(
            "/products/P900-wine-red.webp",
            "batch-01/P900/raw/variant-wine-red.webp",
          ),
        },
      ),
    );

    const result = stage("P900");

    expect(result.copied).toHaveLength(3);
    expect(readFileSync(publishedFile("P900.webp"), "utf8")).toBe("main");
    expect(readFileSync(publishedFile("P900-2.webp"), "utf8")).toBe("extra");
    expect(readFileSync(publishedFile("P900-wine-red.webp"), "utf8")).toBe("variant");
  });

  it("skips a destination that already holds the same bytes, and re-running changes nothing", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp")]));

    stage("P900");
    const second = stage("P900");

    expect(second.copied).toEqual([]);
    expect(second.identical).toHaveLength(1);
    expect(readFileSync(publishedFile("P900.webp"), "utf8")).toBe(STAGED_PHOTO);
  });

  /**
   * The whole defect in one case: a placeholder is sitting where the photograph belongs. The
   * script reports it and leaves it, because the file it would replace may be the only copy of
   * something.
   */
  it("refuses to overwrite a different file, reporting it rather than passing over it", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writePublished("P900.webp", PLACEHOLDER);
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp")]));

    const result = stage("P900");

    expect(result.copied).toEqual([]);
    expect(result.blocked).toHaveLength(1);
    expect(readFileSync(publishedFile("P900.webp"), "utf8")).toBe(PLACEHOLDER);
  });

  it("overwrites under force, and says what size it replaced", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writePublished("P900.webp", PLACEHOLDER);
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp")]));

    const result = stage("P900", { force: true });

    expect(result.overwritten).toHaveLength(1);
    expect(result.overwritten[0].replacedBytes).toBe(PLACEHOLDER.length);
    expect(result.overwritten[0].bytes).toBe(STAGED_PHOTO.length);
    expect(readFileSync(publishedFile("P900.webp"), "utf8")).toBe(STAGED_PHOTO);
  });

  it("writes nothing under dryRun, while reporting what it would do", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp")]));

    const result = stage("P900", { dryRun: true });

    expect(result.copied).toHaveLength(1);
    expect(existsSync(publishedFile("P900.webp"))).toBe(false);
  });

  it("reports a confirmed photograph whose staged file is missing, and copies nothing", () => {
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", "batch-01/P900/raw/main.webp")]));

    const result = stage("P900");

    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].sourceFile).toBe("batch-01/P900/raw/main.webp");
    expect(existsSync(publishedFile("P900.webp"))).toBe(false);
  });

  /**
   * A hand-made product carries no staged file and never did. That is not the same failure as a
   * record naming a file the repository cannot produce, and it is not a failure at all.
   */
  it("separates a photograph nobody staged from one that is staged and missing", () => {
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P900.webp", null)]));

    const result = stage("P900");

    expect(result.noSource).toHaveLength(1);
    expect(result.unresolved).toEqual([]);
  });

  it("leaves an unconfirmed suggestion alone", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writeDraft("P900", {
      productId: "P900",
      images: {
        general: [
          { path: "/products/P900.webp", confirmed: false, sourceFile: "batch-01/P900/raw/main.webp" },
        ],
        variantImages: {},
      },
    });

    const result = stage("P900");

    expect(result.copied).toEqual([]);
    expect(existsSync(publishedFile("P900.webp"))).toBe(false);
  });

  it("refuses a destination filed under another product's id", () => {
    writeStagedFile("batch-01/P900/raw/main.webp");
    writeDraft("P900", draftWithImages("P900", [confirmedImage("/products/P901.webp", "batch-01/P900/raw/main.webp")]));

    const result = stage("P900");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("another product's id");
    expect(existsSync(publishedFile("P901.webp"))).toBe(false);
  });

  it("does nothing at all for a product with no pipeline record", () => {
    const plan = collectStagingPlan("P900", { repoRoot: root });

    expect(plan.recordPath).toBeNull();
    expect(plan.entries).toEqual([]);
    expect(plan.errors).toEqual([]);
  });
});
