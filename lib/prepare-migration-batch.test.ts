import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CATALOGUE_MAX_ID_CEILING,
  MIGRATION_CATEGORY_SLUGS,
  MIGRATION_ID_START,
  QUEUED_STAGE,
  appendRegisterRows,
  assertCatalogueBelowOverrideFloor,
  buildImageSuggestions,
  buildManifest,
  buildRawBlock,
  formatProductId,
  orderRecordsForAssignment,
  parseJsonl,
  parseKnownStubIds,
  parseMarkdownTables,
  planBatch,
  readMaxCatalogueProductId,
  renderDraftsInProgressRows,
  renderNeedsAttention,
  resolveKnownStubIds,
  resolveVariantImageAttribute,
  runCli,
  toVariants,
  validateSourceRecord,
  workingIdFor,
} from "@/scripts/prepare-migration-batch.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const VALID_FIXTURE = join(REPO_ROOT, "scripts/fixtures/synthetic-odoo-batch.jsonl");
const INVALID_FIXTURE = join(REPO_ROOT, "scripts/fixtures/synthetic-odoo-batch-invalid.jsonl");

const BATCH_ID = "synthetic-2026-08";

/** The real catalogue's state at the moment this override was written: P001 through P049. */
const CATALOGUE_AT_P049 = Array.from({ length: 49 }, (_unused, index) => ({
  id: formatProductId(index + 1),
}));

type SourceRecord = Record<string, unknown>;

function readFixture(path: string): { value: unknown; line: number }[] {
  return parseJsonl(readFileSync(path, "utf8")).records;
}

type SourceImages = {
  main?: { file?: string };
  extras?: { file?: string }[];
  variants?: { file?: string }[];
};

/**
 * Every file a record names, read the way the script now reads them: `sourceImages.main.file`
 * rather than the literal `"main.webp"`, and the extras and variant images the existence check
 * used to ignore entirely.
 */
function referencedFilesOf(record: SourceRecord): string[] {
  const sourceImages = record.sourceImages as SourceImages | undefined;
  return [
    sourceImages?.main?.file ?? "main.webp",
    ...(sourceImages?.extras ?? []).map((extra) => extra.file ?? ""),
    ...(sourceImages?.variants ?? []).map((variantImage) => variantImage.file ?? ""),
  ].filter((file) => file.length > 0);
}

function originalIdOf(record: SourceRecord): string {
  return String((record.sourceNotes as { originalId?: unknown } | undefined)?.originalId);
}

/**
 * Stages the empty `.webp` placeholders the validator looks for. The check is that a path
 * resolves, not that a file decodes, so zero-byte files are the honest fixture here.
 */
function stageImages(incomingRoot: string, records: { value: unknown }[]): void {
  for (const { value } of records) {
    const record = value as SourceRecord;
    for (const file of referencedFilesOf(record)) {
      const path = join(incomingRoot, BATCH_ID, workingIdFor(originalIdOf(record)), "raw", file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "");
    }
  }
}

let incomingRoot: string;
let everyImageExists: (relativePath: string) => boolean;

beforeAll(() => {
  incomingRoot = mkdtempSync(join(tmpdir(), "morchadi-stage0-"));
  stageImages(incomingRoot, readFixture(VALID_FIXTURE));
  everyImageExists = () => true;
});

afterAll(() => {
  rmSync(incomingRoot, { recursive: true, force: true });
});

function planValidFixture(): ReturnType<typeof planBatch> {
  return planBatch({
    records: readFixture(VALID_FIXTURE),
    parseErrors: [],
    batchId: BATCH_ID,
    catalogue: CATALOGUE_AT_P049,
    imageExists: everyImageExists,
  });
}

function validateOne(
  record: SourceRecord,
  imageExists = everyImageExists,
  knownStubIds = new Set<string>(),
) {
  return validateSourceRecord(record, { batchId: BATCH_ID, index: 0, imageExists, knownStubIds });
}

/**
 * A record in the shape the REAL export has — provenance under `sourceNotes`, images under
 * `sourceImages` with `main` and `extras[]` as objects, and variant options as a per-variant
 * combination list under `variants[].attributes[]`.
 *
 * The shape this helper had before was the one ADR-054 predicted and the export does not use. It
 * is the reason every mismatch the reconciliation found could pass a full test suite: the fixture
 * and the script agreed with each other and neither agreed with the data.
 */
function cleanRecord(overrides: SourceRecord = {}): SourceRecord {
  return {
    workingId: "odoo-1002",
    sourceType: "migrated",
    category: "rings",
    subcategory: "adjustable-rings",
    variants: [],
    attributes: [],
    sourceImages: {
      main: { file: "main.webp", bytes: 31002, converted: false, source: "https://example/main" },
      extras: [],
      variants: [],
    },
    pricing: {
      price: null,
      mrp: null,
      cost: null,
      referencePrice: "₹499 sale price (morchadijewels.example, reference only)",
    },
    personalized: null,
    suggestedCollections: [],
    sourceNotes: {
      originalId: 1002,
      referenceTitle: "SYNTHETIC FIXTURE — a record that passes",
      originalSku: "SYN-RG-1002",
      originalUrl: "https://morchadijewels.example/shop/syn",
      originalCategories: ["Rings"],
      originalMetaDescription: null,
      rawContent:
        "A description comfortably longer than the fifty-character stub threshold, so nothing here is a stub.",
      rawHtml: "<p>A description.</p>",
    },
    flaggedContent: [],
    notes: [],
    status: "draft",
    generatedBy: null,
    ...overrides,
  };
}

/** `cleanRecord` with one `sourceNotes` field replaced, since the nesting makes that verbose. */
function withSourceNotes(overrides: SourceRecord): SourceRecord {
  const base = cleanRecord();
  return { ...base, sourceNotes: { ...(base.sourceNotes as SourceRecord), ...overrides } };
}

/** `cleanRecord` with a different `sourceImages` block. */
function withSourceImages(sourceImages: SourceRecord): SourceRecord {
  return { ...cleanRecord(), sourceImages };
}

describe("the fixture itself", () => {
  it("is ten synthetic records, every one of them marked as fabricated", () => {
    const records = readFixture(VALID_FIXTURE);

    expect(records).toHaveLength(10);
    for (const { value } of records) {
      const sourceNotes = (value as SourceRecord).sourceNotes as { referenceTitle?: unknown };
      expect(String(sourceNotes.referenceTitle)).toContain("SYNTHETIC FIXTURE");
    }
  });

  /**
   * The guard that makes every other test in this file mean something. The fixture used to carry
   * the shape ADR-054 predicted — `originalId` at the top level, `images.main` a string, options in
   * a deduplicated top-level `attributes[]` — and the script read exactly that shape, so the suite
   * was green while 0 of 542 real records could pass. These assertions pin the fixture to the
   * export's real nesting, so a script that regresses to the old reads fails here first.
   */
  it("carries the real export's nesting, not the shape ADR-054 predicted", () => {
    for (const { value } of [...readFixture(VALID_FIXTURE), ...readFixture(INVALID_FIXTURE)]) {
      const record = value as SourceRecord;

      expect(record).not.toHaveProperty("originalId");
      expect(record).not.toHaveProperty("rawContent");
      expect(record).not.toHaveProperty("referencePrice");
      expect(record).not.toHaveProperty("images");
      expect(record).not.toHaveProperty("knownStub");
      expect(record.sourceNotes).toMatchObject({ originalId: expect.any(Number) });
      expect(record.sourceImages).toMatchObject({ main: { file: expect.any(String) } });
      expect(record.pricing).toMatchObject({ referencePrice: expect.any(String) });
      expect(record.attributes).toEqual([]);
    }
  });

  it("expresses variant options as a per-variant combination list", () => {
    const withVariants = readFixture(VALID_FIXTURE)
      .map(({ value }) => value as SourceRecord)
      .filter((record) => (record.variants as unknown[]).length > 0);

    expect(withVariants.length).toBeGreaterThan(0);
    for (const record of withVariants) {
      for (const variant of record.variants as { attributes: unknown[] }[]) {
        for (const pair of variant.attributes) {
          expect(Object.keys(pair as object).sort()).toEqual(["attribute", "value"]);
        }
      }
    }
  });
});

describe("category validation — null or one of the eleven", () => {
  it("accepts every one of the eleven fixed slugs", () => {
    for (const category of MIGRATION_CATEGORY_SLUGS) {
      expect(validateOne(cleanRecord({ category })).ok).toBe(true);
    }
  });

  it("accepts null, because Phase B may not have decided one", () => {
    expect(validateOne(cleanRecord({ category: null })).ok).toBe(true);
  });

  it("rejects a category outside the eleven and names the field", () => {
    const result = validateOne(cleanRecord({ category: "toe-rings" }));

    expect(result.ok).toBe(false);
    expect(result.failures).toContainEqual({
      field: "category",
      reason: expect.stringContaining("toe-rings"),
    });
  });

  it("rejects a category that is not a string at all", () => {
    expect(validateOne(cleanRecord({ category: 7 })).ok).toBe(false);
  });

  it("queues gift-hampers with no warning — ADR-055 made the slug valid downstream too", () => {
    const result = validateOne(cleanRecord({ category: "gift-hampers" }));

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

describe("subcategory validation — free text, but not empty text", () => {
  it("accepts any non-empty string, since no enum is fixed yet", () => {
    expect(validateOne(cleanRecord({ subcategory: "anything-at-all" })).ok).toBe(true);
  });

  it("accepts null and an absent field", () => {
    expect(validateOne(cleanRecord({ subcategory: null })).ok).toBe(true);
    const withoutSubcategory = cleanRecord();
    delete withoutSubcategory.subcategory;
    expect(validateOne(withoutSubcategory).ok).toBe(true);
  });

  it.each([["", "empty string"], ["   ", "whitespace only"]])(
    "rejects %j — present but not a value (%s)",
    (subcategory) => {
      const result = validateOne(cleanRecord({ subcategory }));

      expect(result.ok).toBe(false);
      expect(result.failures.map((failure) => failure.field)).toContain("subcategory");
    },
  );
});

describe("rawContent validation — the sub-50-character stub rule", () => {
  it("accepts content over the threshold", () => {
    expect(validateOne(cleanRecord()).ok).toBe(true);
  });

  it("reads rawContent from sourceNotes, where the export puts it", () => {
    const topLevelOnly = withSourceNotes({ rawContent: null });
    topLevelOnly.rawContent = "A description far longer than the fifty-character stub threshold requires.";

    const result = validateOne(topLevelOnly);

    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.field)).toContain("sourceNotes.rawContent");
  });

  it("rejects missing rawContent when the record is not named on --known-stub-ids", () => {
    const result = validateOne(withSourceNotes({ rawContent: null }));

    expect(result.ok).toBe(false);
    expect(result.failures).toContainEqual({
      field: "sourceNotes.rawContent",
      reason: expect.stringContaining("not named on --known-stub-ids"),
    });
  });

  it("rejects short-but-present content when the record is not named on --known-stub-ids", () => {
    const result = validateOne(withSourceNotes({ rawContent: "Nice ring." }));

    expect(result.ok).toBe(false);
    expect(result.failures[0].reason).toContain("10 characters");
  });

  it("accepts a stub named on --known-stub-ids, and warns that it has nothing to quote", () => {
    const result = validateOne(
      withSourceNotes({ rawContent: "Nice ring." }),
      everyImageExists,
      new Set(["odoo-1002"]),
    );

    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual({
      field: "sourceNotes.rawContent",
      reason: expect.stringContaining("knownStub"),
    });
  });

  it("accepts the bare originalId on --known-stub-ids as well as the working id", () => {
    expect(
      validateOne(withSourceNotes({ rawContent: "Nice ring." }), everyImageExists, new Set(["1002"]))
        .ok,
    ).toBe(true);
  });

  it("does not accept a stub because some other record was named", () => {
    const result = validateOne(
      withSourceNotes({ rawContent: "Nice ring." }),
      everyImageExists,
      new Set(["odoo-9999"]),
    );

    expect(result.ok).toBe(false);
  });

  it("still honours knownStub: true if the export ever grows the field", () => {
    expect(validateOne({ ...withSourceNotes({ rawContent: "Short." }), knownStub: true }).ok).toBe(true);
  });
});

/**
 * I-4. The export has no `knownStub` field — the key appears nowhere in the real file — so the
 * only way to accept a genuinely short record is for a person to name it on the command line.
 */
describe("--known-stub-ids — the deliberate manual override", () => {
  it("reads a comma-separated list", () => {
    expect([...parseKnownStubIds("odoo-817,odoo-828,odoo-829")]).toEqual([
      "odoo-817",
      "odoo-828",
      "odoo-829",
    ]);
  });

  it("tolerates spaces and repeated separators", () => {
    expect([...parseKnownStubIds("odoo-817, odoo-828   odoo-829,")]).toEqual([
      "odoo-817",
      "odoo-828",
      "odoo-829",
    ]);
  });

  it("is empty when the flag is absent, so nothing is accepted by default", () => {
    expect(resolveKnownStubIds(undefined).size).toBe(0);
    expect(parseKnownStubIds("").size).toBe(0);
  });

  it("reads a JSON array from a file when the value names one", () => {
    const listPath = join(incomingRoot, "known-stubs.json");
    writeFileSync(listPath, JSON.stringify(["odoo-817", "odoo-828"]));

    expect([...resolveKnownStubIds(listPath)]).toEqual(["odoo-817", "odoo-828"]);
  });

  it("reads one id per line from a plain text file, ignoring comments", () => {
    const listPath = join(incomingRoot, "known-stubs.txt");
    writeFileSync(listPath, "# the eleven genuine stubs\nodoo-817\nodoo-828\n\nodoo-829\n");

    expect([...resolveKnownStubIds(listPath)]).toEqual(["odoo-817", "odoo-828", "odoo-829"]);
  });

  it("treats a value that is not a path as the ids themselves", () => {
    expect([...resolveKnownStubIds("odoo-817,odoo-828")]).toEqual(["odoo-817", "odoo-828"]);
  });

  it("records the override in the raw block, so the queue says the record was let through", () => {
    const plan = planBatch({
      records: [{ value: withSourceNotes({ rawContent: "Short." }), line: 1 }],
      parseErrors: [],
      batchId: BATCH_ID,
      catalogue: CATALOGUE_AT_P049,
      imageExists: everyImageExists,
      knownStubIds: new Set(["odoo-1002"]),
    });

    expect(plan.assigned).toHaveLength(1);
    expect(plan.assigned[0].rawBlock.sourceNotes.knownStub).toBe(true);
  });

  it("leaves knownStub false for a record that never needed the override", () => {
    expect(planValidFixture().assigned[0].rawBlock.sourceNotes.knownStub).toBe(false);
  });
});

describe("image shape validation", () => {
  it("rejects a record with no sourceImages block", () => {
    const withoutImages = cleanRecord();
    delete withoutImages.sourceImages;

    expect(validateOne(withoutImages).failures).toContainEqual({
      field: "sourceImages",
      reason: "missing or not an object",
    });
  });

  it("rejects a main entry that is a bare string rather than an object", () => {
    const result = validateOne(withSourceImages({ main: "main.webp", extras: [], variants: [] }));

    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.field)).toContain("sourceImages.main");
  });

  it("rejects an extras entry with no file name", () => {
    const result = validateOne(
      withSourceImages({ main: { file: "main.webp" }, extras: [{ bytes: 10 }], variants: [] }),
    );

    expect(result.failures.map((failure) => failure.field)).toContain("sourceImages.extras[0]");
  });

  it("rejects a malformed variant image entry before it can reach the transformer", () => {
    const result = validateOne(
      withSourceImages({
        main: { file: "main.webp" },
        extras: [],
        variants: [{ variantId: 1, value: "", file: "v.webp" }],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.field)).toContain("sourceImages.variants[0]");
  });

  /**
   * B-6. The export's variant images carry no attribute name, so the map key is recovered by
   * joining `variantId` back into `variants[].attributes[]`. A record where that join fails has no
   * honest key to offer, and keying it `undefined:B` is what the old code did silently.
   */
  it("refuses a variant image whose variantId joins to nothing", () => {
    const result = validateOne({
      ...cleanRecord(),
      variants: [{ variantId: 7, attributes: [{ attribute: "Colour", value: "Golden" }] }],
      sourceImages: {
        main: { file: "main.webp" },
        extras: [],
        variants: [{ variantId: 99, value: "Golden", file: "variant-golden.webp" }],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.field)).toContain(
      "sourceImages.variants[0].variantId",
    );
  });

  it("refuses a variant image whose value no pair on its variant carries", () => {
    const result = validateOne({
      ...cleanRecord(),
      variants: [{ variantId: 7, attributes: [{ attribute: "Colour", value: "Golden" }] }],
      sourceImages: {
        main: { file: "main.webp" },
        extras: [],
        variants: [{ variantId: 7, value: "Rose Gold", file: "variant-rose.webp" }],
      },
    });

    expect(result.failures.map((failure) => failure.field)).toContain(
      "sourceImages.variants[0].variantId",
    );
  });

  it("accepts the join when the variant carries several attributes and one matches the value", () => {
    const result = validateOne({
      ...cleanRecord(),
      variants: [
        {
          variantId: 7,
          attributes: [
            { attribute: "Letter", value: "A" },
            { attribute: "Colour", value: "Golden" },
          ],
        },
      ],
      sourceImages: {
        main: { file: "main.webp" },
        extras: [],
        variants: [{ variantId: 7, value: "Golden", file: "variant-golden.webp" }],
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a variants[] entry whose attribute pair is malformed", () => {
    const result = validateOne({
      ...cleanRecord(),
      variants: [{ variantId: 7, attributes: [{ attribute: "Colour" }] }],
    });

    expect(result.failures.map((failure) => failure.field)).toContain("variants[0].attributes[0]");
  });

  it("warns rather than fails when top-level attributes is populated, since Stage 0 never reads it", () => {
    const result = validateOne(cleanRecord({ attributes: [{ name: "Colour", values: ["Golden"] }] }));

    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual({
      field: "attributes",
      reason: expect.stringContaining("variants[].attributes[]"),
    });
  });
});

/**
 * I-5. The old check probed the literal `"main.webp"` and looked at nothing else. It agreed with
 * the record only by coincidence, and 483 extras and 50 variant images were never checked at all.
 */
describe("image existence validation", () => {
  it("rejects a record whose main photograph is not on disk, quoting the path it looked for", () => {
    const result = validateOne(cleanRecord(), () => false);

    expect(result.ok).toBe(false);
    expect(result.failures).toContainEqual({
      field: "sourceImages.main",
      reason: `no file on disk at content-pipeline/incoming/${join(BATCH_ID, "odoo-1002", "raw", "main.webp")}`,
    });
  });

  it("probes the record's own main file name, not the literal main.webp", () => {
    const looked: string[] = [];
    validateOne(withSourceImages({ main: { file: "primary.webp" }, extras: [], variants: [] }), (path) => {
      looked.push(path);
      return true;
    });

    expect(looked).toEqual([join(BATCH_ID, "odoo-1002", "raw", "primary.webp")]);
  });

  it("looks for the main photograph under the record's own originalId", () => {
    const looked: string[] = [];
    validateOne(withSourceNotes({ originalId: 4242 }), (path) => {
      looked.push(path);
      return true;
    });

    expect(looked).toEqual([join(BATCH_ID, "odoo-4242", "raw", "main.webp")]);
  });

  it("checks every extra and every variant image too, not only the main one", () => {
    const looked: string[] = [];
    validateOne(
      {
        ...cleanRecord(),
        variants: [{ variantId: 7, attributes: [{ attribute: "Colour", value: "Golden" }] }],
        sourceImages: {
          main: { file: "main.webp" },
          extras: [{ file: "extra-1.webp" }, { file: "extra-2.webp" }],
          variants: [{ variantId: 7, value: "Golden", file: "variant-golden.webp" }],
        },
      },
      (path) => {
        looked.push(path);
        return true;
      },
    );

    expect(looked).toEqual([
      join(BATCH_ID, "odoo-1002", "raw", "main.webp"),
      join(BATCH_ID, "odoo-1002", "raw", "extra-1.webp"),
      join(BATCH_ID, "odoo-1002", "raw", "extra-2.webp"),
      join(BATCH_ID, "odoo-1002", "raw", "variant-golden.webp"),
    ]);
  });

  it("names the missing extra, not the main photograph, when only the extra is absent", () => {
    const result = validateOne(
      withSourceImages({
        main: { file: "main.webp" },
        extras: [{ file: "extra-1.webp" }],
        variants: [],
      }),
      (path) => !path.includes("extra-1"),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      {
        field: "sourceImages.extras[0]",
        reason: `no file on disk at content-pipeline/incoming/${join(BATCH_ID, "odoo-1002", "raw", "extra-1.webp")}`,
      },
    ]);
  });

  it("names the missing variant image", () => {
    const result = validateOne(
      {
        ...cleanRecord(),
        variants: [{ variantId: 7, attributes: [{ attribute: "Colour", value: "Golden" }] }],
        sourceImages: {
          main: { file: "main.webp" },
          extras: [],
          variants: [{ variantId: 7, value: "Golden", file: "variant-golden.webp" }],
        },
      },
      (path) => !path.includes("variant-golden"),
    );

    expect(result.failures.map((failure) => failure.field)).toEqual(["sourceImages.variants[0]"]);
  });
});

describe("collecting every fault rather than the first", () => {
  it("reports the category and the missing image together", () => {
    const result = validateOne(cleanRecord({ category: "toe-rings" }), () => false);

    expect(result.failures.map((failure) => failure.field).sort()).toEqual([
      "category",
      "sourceImages.main",
    ]);
  });
});

describe("the P101 override safety assertion", () => {
  it("passes against the catalogue as it stands, at P049", () => {
    expect(assertCatalogueBelowOverrideFloor(CATALOGUE_AT_P049)).toEqual({
      maxId: 49,
      maxProductId: "P049",
    });
  });

  /**
   * Until 2026-08-24 this test asserted the opposite: that the real catalogue's maximum id sat
   * at or below the ceiling, so the one-time override could still run. Phase 2 then landed the
   * pilot batch (P106–P122) in `data/products.json`, which is exactly the state the assertion
   * exists to detect — the id sequence is no longer the one the override was written against,
   * and a second run would hand out numbers that are already spoken for. The override is spent,
   * by its own design, and this test now proves it stays that way. The 2026-08-23-batch-01 raw
   * blocks were all queued before the seam closed, so the rest of that batch needs no second
   * Stage 0 run; a future export needs a new decision, not a loosened assertion.
   */
  it("refuses against the real data/products.json, because Phase 2 has landed and the one-time override is spent", () => {
    const realCatalogue: unknown = JSON.parse(
      readFileSync(join(REPO_ROOT, "data/products.json"), "utf8"),
    );

    expect(readMaxCatalogueProductId(realCatalogue)).toBeGreaterThan(CATALOGUE_MAX_ID_CEILING);
    expect(() => assertCatalogueBelowOverrideFloor(realCatalogue)).toThrow(/REFUSING TO RUN/);
  });

  it("fails loudly at P050, the first id above the ceiling", () => {
    const catalogue = [...CATALOGUE_AT_P049, { id: "P050" }];

    expect(() => assertCatalogueBelowOverrideFloor(catalogue)).toThrow(/REFUSING TO RUN/);
    expect(() => assertCatalogueBelowOverrideFloor(catalogue)).toThrow(/P050/);
  });

  it("fails loudly when the catalogue already holds the ids this batch would assign", () => {
    const catalogue = [...CATALOGUE_AT_P049, { id: "P110" }];

    expect(() => assertCatalogueBelowOverrideFloor(catalogue)).toThrow(/REFUSING TO RUN/);
  });

  it("refuses a catalogue whose ids are not PNNN strings rather than treating them as zero", () => {
    expect(() => readMaxCatalogueProductId([{ id: "nk-001" }])).toThrow(/not a PNNN product id/);
  });

  it("stops planBatch dead — nothing is assigned when the assertion fires", () => {
    expect(() =>
      planBatch({
        records: readFixture(VALID_FIXTURE),
        parseErrors: [],
        batchId: BATCH_ID,
        catalogue: [{ id: "P050" }],
        imageExists: everyImageExists,
      }),
    ).toThrow(/REFUSING TO RUN/);
  });
});

describe("sequential id assignment from P101", () => {
  it("assigns P101 through P110 to the ten-record synthetic batch", () => {
    const plan = planValidFixture();

    expect(plan.assigned).toHaveLength(10);
    expect(plan.assigned.map((entry) => entry.productId)).toEqual([
      "P101",
      "P102",
      "P103",
      "P104",
      "P105",
      "P106",
      "P107",
      "P108",
      "P109",
      "P110",
    ]);
    expect(plan.assignedRange).toEqual({ first: "P101", last: "P110" });
  });

  it("starts at MIGRATION_ID_START, and that constant is 101", () => {
    expect(MIGRATION_ID_START).toBe(101);
    expect(planValidFixture().assigned[0].productId).toBe(formatProductId(MIGRATION_ID_START));
  });

  it("is deterministic — two runs over identical input produce identical assignments", () => {
    const first = planValidFixture();
    const second = planValidFixture();

    expect(second.assigned.map((entry) => [entry.originalId, entry.productId])).toEqual(
      first.assigned.map((entry) => [entry.originalId, entry.productId]),
    );
    expect(JSON.stringify(second.assigned.map((entry) => entry.rawBlock))).toEqual(
      JSON.stringify(first.assigned.map((entry) => entry.rawBlock)),
    );
  });

  it("is deterministic under a shuffled export — order comes from originalId, not from the file", () => {
    const records = readFixture(VALID_FIXTURE);
    const shuffled = [...records].reverse().map((record, index) => ({ ...record, line: index + 1 }));

    const inOrder = planValidFixture();
    const outOfOrder = planBatch({
      records: shuffled,
      parseErrors: [],
      batchId: BATCH_ID,
      catalogue: CATALOGUE_AT_P049,
      imageExists: everyImageExists,
    });

    const pairing = (plan: ReturnType<typeof planBatch>) =>
      Object.fromEntries(plan.assigned.map((entry) => [entry.originalId, entry.productId]));

    expect(pairing(outOfOrder)).toEqual(pairing(inOrder));
  });

  it("sorts originalId numerically, so 205 comes before 1042", () => {
    const ordered = orderRecordsForAssignment([
      { originalId: "1042" },
      { originalId: "205" },
      { originalId: "99" },
    ]);

    expect(ordered.map((entry) => entry.originalId)).toEqual(["99", "205", "1042"]);
  });

  it("falls back to a string comparison for non-numeric ids without losing totality", () => {
    const ordered = orderRecordsForAssignment([
      { originalId: "odoo-b" },
      { originalId: "12" },
      { originalId: "odoo-a" },
    ]);

    expect(ordered.map((entry) => entry.originalId)).toEqual(["12", "odoo-a", "odoo-b"]);
  });

  it("refuses to assign an id to either side of a duplicated originalId", () => {
    const duplicated = [
      { value: withSourceNotes({ originalId: 1002 }), line: 1 },
      { value: withSourceNotes({ originalId: 1002 }), line: 2 },
      { value: withSourceNotes({ originalId: 1003 }), line: 3 },
    ];

    const plan = planBatch({
      records: duplicated,
      parseErrors: [],
      batchId: BATCH_ID,
      catalogue: CATALOGUE_AT_P049,
      imageExists: everyImageExists,
    });

    expect(plan.assigned.map((entry) => entry.originalId)).toEqual(["1003"]);
    expect(plan.rejected).toHaveLength(2);
    expect(plan.rejected[0].failures[0].reason).toContain("more than one line");
  });

  it("assigns no id to any record that failed validation", () => {
    const plan = planBatch({
      records: readFixture(INVALID_FIXTURE),
      parseErrors: [],
      batchId: BATCH_ID,
      catalogue: CATALOGUE_AT_P049,
      imageExists: (path: string) => !path.includes("odoo-2003"),
    });

    expect(plan.assigned).toHaveLength(0);
    expect(plan.rejected).toHaveLength(4);
    expect(plan.assignedRange).toBeNull();
  });
});

describe("Part C — the variant transformation", () => {
  /**
   * B-5. The real export expresses options as a per-variant combination list; Draft A wants the
   * deduplicated option list. Reading top-level `attributes[]` — empty in all 542 records — wrote
   * `variants: []` into all 78 multi-variant products and passed validation while doing it.
   */
  it("derives the deduplicated option list from variants[].attributes[]", () => {
    expect(
      toVariants({
        variants: [
          { variantId: 1, attributes: [{ attribute: "Colour", value: "Golden" }] },
          { variantId: 2, attributes: [{ attribute: "Colour", value: "Silver" }] },
          { variantId: 3, attributes: [{ attribute: "Colour", value: "Golden" }] },
        ],
      }),
    ).toEqual([{ optionName: "Colour", values: ["Golden", "Silver"] }]);
  });

  it("keeps each option separate when a variant combines several", () => {
    expect(
      toVariants({
        variants: [
          {
            variantId: 1,
            attributes: [
              { attribute: "Letter", value: "A" },
              { attribute: "Colour", value: "Golden" },
            ],
          },
          {
            variantId: 2,
            attributes: [
              { attribute: "Letter", value: "B" },
              { attribute: "Colour", value: "Silver" },
            ],
          },
        ],
      }),
    ).toEqual([
      { optionName: "Letter", values: ["A", "B"] },
      { optionName: "Colour", values: ["Golden", "Silver"] },
    ]);
  });

  it("ignores top-level attributes entirely, even when it is populated", () => {
    expect(
      toVariants({
        attributes: [{ name: "Colour", values: ["Golden", "Silver"] }],
        variants: [{ variantId: 1, attributes: [{ attribute: "Size", value: "Medium" }] }],
      }),
    ).toEqual([{ optionName: "Size", values: ["Medium"] }]);
  });

  it("produces an empty array for a record with no variants", () => {
    expect(toVariants({})).toEqual([]);
    expect(toVariants({ variants: [], attributes: [] })).toEqual([]);
  });

  it("does not alias the source arrays", () => {
    const source = {
      variants: [{ variantId: 1, attributes: [{ attribute: "Colour", value: "Golden" }] }],
    };
    toVariants(source)[0].values.push("Silver");

    expect(source.variants[0].attributes).toEqual([{ attribute: "Colour", value: "Golden" }]);
  });

  it("keeps source spelling and first-appearance order untouched", () => {
    expect(
      toVariants({
        variants: [
          { variantId: 1, attributes: [{ attribute: "Strap Colour", value: "Gold" }] },
          { variantId: 2, attributes: [{ attribute: "Strap Colour", value: "black" }] },
        ],
      }),
    ).toEqual([{ optionName: "Strap Colour", values: ["Gold", "black"] }]);
  });

  it("gives the real fixture's multi-option product both of its options", () => {
    const plan = planValidFixture();
    const pendant = plan.assigned.find((entry) => entry.originalId === "1090");

    expect(pendant?.rawBlock.variants).toEqual([
      { optionName: "Letter", values: ["A", "B", "C", "D"] },
      { optionName: "Colour", values: ["Golden", "Silver"] },
    ]);
  });
});

describe("Part C — the variant-image attribute join", () => {
  const record = {
    variants: [
      { variantId: 21002, attributes: [{ attribute: "Colour", value: "Golden" }] },
      {
        variantId: 21003,
        attributes: [
          { attribute: "Letter", value: "B" },
          { attribute: "Colour", value: "Silver" },
        ],
      },
    ],
  };

  it("recovers the attribute name by joining variantId back into variants[]", () => {
    expect(resolveVariantImageAttribute(record, { variantId: 21002, value: "Golden" })).toBe("Colour");
  });

  it("picks the pair whose value the image entry names, not merely the first pair", () => {
    expect(resolveVariantImageAttribute(record, { variantId: 21003, value: "Silver" })).toBe("Colour");
    expect(resolveVariantImageAttribute(record, { variantId: 21003, value: "B" })).toBe("Letter");
  });

  it("returns null rather than guessing when the variantId matches nothing", () => {
    expect(resolveVariantImageAttribute(record, { variantId: 99, value: "Golden" })).toBeNull();
  });

  it("returns null rather than guessing when no pair carries the value", () => {
    expect(resolveVariantImageAttribute(record, { variantId: 21002, value: "Rose Gold" })).toBeNull();
  });
});

describe("Part C — the image transformation", () => {
  const record = {
    variants: [
      { variantId: 1, attributes: [{ attribute: "Colour", value: "Golden" }] },
      { variantId: 2, attributes: [{ attribute: "Colour", value: "Rose Gold" }] },
    ],
    sourceImages: {
      main: { file: "main.webp", bytes: 1, converted: false, source: "https://example/main" },
      extras: [
        { file: "extra-1.webp", bytes: 2, sequence: "11" },
        { file: "extra-2.webp", bytes: 3, sequence: "12" },
      ],
      variants: [
        { file: "variant-golden.webp", variantId: 1, value: "Golden", verifiedDistinct: true },
        { file: "variant-rose.webp", variantId: 2, value: "Rose Gold", verifiedDistinct: false },
      ],
    },
  };

  it("puts the main photograph first and numbers its siblings from 2, per ADR-006", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(images.general.map((entry) => entry.path)).toEqual([
      "/products/P101.webp",
      "/products/P101-2.webp",
      "/products/P101-3.webp",
    ]);
  });

  /** B-3. `extras[]` entries are objects, and the key is `extras`, not `extra`. */
  it("reads the extras' file names out of their objects", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(images.general.map((entry) => entry.sourceFile)).toEqual([
      join(BATCH_ID, "odoo-1002", "raw", "main.webp"),
      join(BATCH_ID, "odoo-1002", "raw", "extra-1.webp"),
      join(BATCH_ID, "odoo-1002", "raw", "extra-2.webp"),
    ]);
  });

  it("reads the main file name out of its object rather than assuming main.webp", () => {
    const { images } = buildImageSuggestions(
      { sourceImages: { main: { file: "primary.webp" } } },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(images.general[0].sourceFile).toBe(join(BATCH_ID, "odoo-1002", "raw", "primary.webp"));
  });

  it("keys variant images as OptionName:Value, with the name recovered by the join", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(
      Object.fromEntries(
        Object.entries(images.variantImages).map(([key, entry]) => [key, entry.path]),
      ),
    ).toEqual({
      "Colour:Golden": "/products/P101-golden.webp",
      "Colour:Rose Gold": "/products/P101-rose-gold.webp",
    });
  });

  it("never keys a variant image by undefined, which is what the missing join produced", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    for (const key of Object.keys(images.variantImages)) {
      expect(key).not.toContain("undefined");
    }
  });

  it("writes every suggestion as confirmed: false — nothing here has been approved", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    for (const entry of images.general) expect(entry.confirmed).toBe(false);
    for (const entry of Object.values(images.variantImages)) expect(entry.confirmed).toBe(false);
  });

  /** B-7. The export spells it camelCase. Read as `verified_distinct` it was false for all 50. */
  it("carries verifiedDistinct forward inside the suggestion, so it survives extraction", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(images.variantImages).toEqual({
      "Colour:Golden": {
        path: "/products/P101-golden.webp",
        confirmed: false,
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "variant-golden.webp"),
        verifiedDistinct: true,
      },
      "Colour:Rose Gold": {
        path: "/products/P101-rose-gold.webp",
        confirmed: false,
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "variant-rose.webp"),
        verifiedDistinct: false,
      },
    });
  });

  it("does not read the snake_case spelling, which the export does not use", () => {
    const { images } = buildImageSuggestions(
      {
        variants: [{ variantId: 1, attributes: [{ attribute: "Colour", value: "Golden" }] }],
        sourceImages: {
          main: { file: "main.webp" },
          variants: [
            { file: "v.webp", variantId: 1, value: "Golden", verified_distinct: true },
          ],
        },
      },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(images.variantImages["Colour:Golden"].verifiedDistinct).toBe(false);
  });

  it("treats a missing verifiedDistinct as not verified rather than as verified", () => {
    const { images } = buildImageSuggestions(
      {
        variants: [{ variantId: 1, attributes: [{ attribute: "Colour", value: "Golden" }] }],
        sourceImages: {
          main: { file: "main.webp" },
          variants: [{ file: "v.webp", variantId: 1, value: "Golden" }],
        },
      },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(images.variantImages["Colour:Golden"].verifiedDistinct).toBe(false);
  });

  it("records the source file behind every general suggestion", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(images.general).toEqual([
      {
        path: "/products/P101.webp",
        confirmed: false,
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "main.webp"),
        role: "main",
      },
      {
        path: "/products/P101-2.webp",
        confirmed: false,
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "extra-1.webp"),
        role: "extra-1",
      },
      {
        path: "/products/P101-3.webp",
        confirmed: false,
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "extra-2.webp"),
        role: "extra-2",
      },
    ]);
  });

  it("disambiguates two option names that slug to the same value", () => {
    const { images } = buildImageSuggestions(
      {
        variants: [
          { variantId: 1, attributes: [{ attribute: "Colour", value: "Gold" }] },
          { variantId: 2, attributes: [{ attribute: "Strap", value: "Gold" }] },
        ],
        sourceImages: {
          main: { file: "main.webp" },
          variants: [
            { file: "a.webp", variantId: 1, value: "Gold", verifiedDistinct: true },
            { file: "b.webp", variantId: 2, value: "Gold", verifiedDistinct: true },
          ],
        },
      },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(
      Object.fromEntries(
        Object.entries(images.variantImages).map(([key, entry]) => [key, entry.path]),
      ),
    ).toEqual({
      "Colour:Gold": "/products/P101-colour-gold.webp",
      "Strap:Gold": "/products/P101-strap-gold.webp",
    });
  });

  it("gives a record with no photographs beyond the main one a single general entry", () => {
    const { images } = buildImageSuggestions({ sourceImages: { main: { file: "main.webp" } } }, "P101", BATCH_ID, "1002");

    expect(images).toEqual({
      general: [
        {
          path: "/products/P101.webp",
          confirmed: false,
          sourceFile: join(BATCH_ID, "odoo-1002", "raw", "main.webp"),
          role: "main",
        },
      ],
      variantImages: {},
    });
  });
});

describe("the raw block — shaped for Draft A, and not claiming to be one", () => {
  const plan = () => planValidFixture();

  it("carries the assigned id and the queued stage", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.productId).toBe("P101");
    expect(block.stage).toBe(QUEUED_STAGE);
    expect(block.sourceType).toBe("migrated");
  });

  it("says in the file itself that Draft A extraction has not run", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.confirmationState.draftAExtractionRun).toBe(false);
    expect(block.confirmationState.imagesConfirmed).toBe(false);
  });

  it("carries every sourceNotes field the task names", () => {
    const block = plan().assigned[0].rawBlock;

    expect(Object.keys(block.sourceNotes).sort()).toEqual([
      "exportNotes",
      "knownStub",
      "originalCategories",
      "originalId",
      "originalMetaDescription",
      "originalSku",
      "originalUrl",
      "rawContent",
      "rawHtml",
      "referenceTitle",
      "workingId",
    ]);
    expect(block.sourceNotes.originalId).toBe("1002");
    expect(block.sourceNotes.workingId).toBe("odoo-1002");
    expect(block.sourceNotes.originalSku).toBe("SYN-RG-1002");
  });

  /** I-1. All four of these were read from the top level and arrived null in all 542 records. */
  it("reads the four provenance fields out of sourceNotes, where the export puts them", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.sourceNotes.referenceTitle).toBe("SYNTHETIC FIXTURE — Adjustable Wave Band Ring");
    expect(block.sourceNotes.originalUrl).toContain("morchadijewels.example");
    expect(block.sourceNotes.originalCategories).toEqual(["Rings", "Gold Plated"]);
    expect(block.sourceNotes.rawHtml).toContain("<p>");
  });

  it("transcribes rawContent byte for byte", () => {
    const source = readFixture(VALID_FIXTURE)[0].value as SourceRecord;
    const block = plan().assigned[0].rawBlock;

    expect(block.sourceNotes.rawContent).toBe(
      (source.sourceNotes as { rawContent: string }).rawContent,
    );
  });

  /**
   * I-2. Carried for the archive and for nothing else. The restriction is stated in the script at
   * the point it is carried through; this is the assertion that it arrives at all.
   */
  it("carries originalMetaDescription through as archival provenance", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.sourceNotes.originalMetaDescription).toContain("archive");
  });

  it("writes originalMetaDescription as null when the export has none", () => {
    const block = buildRawBlock(
      withSourceNotes({ originalMetaDescription: null }),
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(block.sourceNotes.originalMetaDescription).toBeNull();
  });

  /** I-3. 563 QA observations that used to be dropped without a word. */
  it("carries the export's own notes[] through as exportNotes", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.sourceNotes.exportNotes).toEqual(["only one image available from source"]);
  });

  it("keeps exportNotes beside the provenance rather than at the top level, where Draft A's notes live", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block).not.toHaveProperty("notes");
  });

  it("gives a record with no notes an empty array rather than omitting it", () => {
    expect(buildRawBlock(cleanRecord(), "P101", BATCH_ID, "1002").sourceNotes.exportNotes).toEqual([]);
  });

  it("carries the Phase B category, subcategory and suggestedCollections through unchanged", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.category).toBe("rings");
    expect(block.subcategory).toBe("adjustable-rings");
    expect(block.suggestedCollections).toEqual(["anti-tarnish"]);
  });

  /** B-4. Read from the top level it was null in all 542 raw blocks, for products that all had one. */
  it("quarantines the source price to pricing.referencePrice, reading it from pricing", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.pricing).toEqual({
      referencePrice: "₹499 sale price (morchadijewels.example, reference only)",
    });
    expect(block.pricing).not.toHaveProperty("price");
    expect(block.pricing).not.toHaveProperty("mrp");
  });

  it("writes null rather than inventing a price when pricing carries none", () => {
    const block = buildRawBlock(
      { ...cleanRecord(), pricing: { price: null, mrp: null, cost: null, referencePrice: null } },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(block.pricing.referencePrice).toBeNull();
  });

  it("copies the reference price verbatim, sentence and all, rather than parsing it", () => {
    const block = buildRawBlock(
      {
        ...cleanRecord(),
        pricing: { referencePrice: "₹450 sale price, ₹300 cost (morchadijewels.com, reference only)" },
      },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(block.pricing.referencePrice).toBe(
      "₹450 sale price, ₹300 cost (morchadijewels.com, reference only)",
    );
  });

  it("matches draft-a-skills.md's variants and images shapes exactly", () => {
    const block = plan().assigned[0].rawBlock;

    for (const variant of block.variants) {
      expect(Object.keys(variant).sort()).toEqual(["optionName", "values"]);
      expect(typeof variant.optionName).toBe("string");
      expect(Array.isArray(variant.values)).toBe(true);
    }
    expect(Object.keys(block.images).sort()).toEqual(["general", "variantImages"]);
    expect(Array.isArray(block.images.general)).toBe(true);
    for (const entry of block.images.general) {
      expect(entry.path).toMatch(/^\/products\/P\d{3}[a-z0-9-]*\.webp$/);
      expect(entry.confirmed).toBe(false);
    }
    for (const [key, entry] of Object.entries(block.images.variantImages)) {
      expect(key).toMatch(/^.+:.+$/);
      expect(entry.path).toMatch(/^\/products\/P\d{3}[a-z0-9-]*\.webp$/);
      expect(entry.confirmed).toBe(false);
    }
  });

  it("carries none of the fields extraction owns", () => {
    const block = plan().assigned[0].rawBlock;

    for (const field of ["attributes", "flaggedContent", "personalized", "notes", "generatedBy"]) {
      expect(block).not.toHaveProperty(field);
    }
  });

  it("gives a record with no variants an empty variants array rather than omitting it", () => {
    const withoutVariants = plan().assigned.find((entry) => entry.originalId === "1008");

    expect(withoutVariants?.rawBlock.variants).toEqual([]);
  });

  /**
   * The whole point of the reconciliation, in one assertion. Every one of these four was silent:
   * it wrote a wrong value and exited 0, behind three loud rejections that hid it.
   */
  it("gets all four of the previously-silent values right on a multi-variant record", () => {
    const watch = plan().assigned.find((entry) => entry.originalId === "1073");

    expect(watch?.rawBlock.variants).toEqual([
      { optionName: "Strap Colour", values: ["Gold", "Silver", "Black"] },
    ]);
    expect(Object.keys(watch?.rawBlock.images.variantImages ?? {})).toEqual([
      "Strap Colour:Gold",
      "Strap Colour:Black",
    ]);
    expect(watch?.rawBlock.images.variantImages["Strap Colour:Gold"].verifiedDistinct).toBe(true);
    expect(watch?.rawBlock.images.variantImages["Strap Colour:Black"].verifiedDistinct).toBe(false);
    expect(watch?.rawBlock.pricing.referencePrice).toContain("₹1,299");
  });
});

describe("Part D — the manifest", () => {
  it("holds one entry per record read, queued and refused alike", () => {
    const records = [...readFixture(VALID_FIXTURE), ...readFixture(INVALID_FIXTURE)];
    const manifest = buildManifest(
      planBatch({
        records: records.map((record, index) => ({ ...record, line: index + 1 })),
        parseErrors: [{ line: 99, message: "Unexpected end of JSON input" }],
        batchId: BATCH_ID,
        catalogue: CATALOGUE_AT_P049,
        imageExists: (path: string) => !path.includes("odoo-2003"),
      }),
    );

    expect(manifest.entries).toHaveLength(15);
    expect(manifest.counts).toEqual({ read: 15, queued: 10, needsAttention: 5 });
  });

  it("names the id, the category, the status and the raw block path for a queued record", () => {
    const manifest = buildManifest(planValidFixture());

    expect(manifest.entries[0]).toMatchObject({
      originalId: "1002",
      productId: "P101",
      category: "rings",
      validationStatus: "queued",
      rawBlockPath: "P101/raw-block.json",
    });
  });

  it("gives a refused record a null productId and no raw block path", () => {
    const manifest = buildManifest(
      planBatch({
        records: readFixture(INVALID_FIXTURE),
        parseErrors: [],
        batchId: BATCH_ID,
        catalogue: CATALOGUE_AT_P049,
        imageExists: () => true,
      }),
    );

    const refused = manifest.entries.filter((entry) => entry.validationStatus === "needs-attention");

    expect(refused).toHaveLength(3);
    for (const entry of refused) {
      expect(entry.productId).toBeNull();
      expect(entry.rawBlockPath).toBeNull();
    }
  });

  it("records the catalogue maximum the assignment was made against", () => {
    expect(buildManifest(planValidFixture()).catalogueMaxProductIdAtAssignment).toBe("P049");
  });

  it("marks a queued record that carries a warning distinctly from a clean one", () => {
    const manifest = buildManifest(
      planBatch({
        records: [
          { value: withSourceNotes({ rawContent: "Short." }), line: 1 },
          { value: withSourceNotes({ originalId: 1003 }), line: 2 },
        ],
        parseErrors: [],
        batchId: BATCH_ID,
        catalogue: CATALOGUE_AT_P049,
        imageExists: everyImageExists,
        knownStubIds: new Set(["odoo-1002"]),
      }),
    );

    expect(manifest.entries[0].validationStatus).toBe("queued-with-warnings");
    expect(manifest.entries[1].validationStatus).toBe("queued");
  });
});

describe("Part A — the needs-attention report", () => {
  const report = () =>
    renderNeedsAttention(
      planBatch({
        records: readFixture(INVALID_FIXTURE),
        parseErrors: [{ line: 9, message: "Unexpected token }" }],
        batchId: BATCH_ID,
        catalogue: CATALOGUE_AT_P049,
        imageExists: (path: string) => !path.includes("odoo-2003"),
      }),
      "scripts/fixtures/synthetic-odoo-batch-invalid.jsonl",
    );

  it("lists every refused record with its field and its reason", () => {
    const rendered = report();

    expect(rendered).toContain("`category`");
    expect(rendered).toContain("toe-rings");
    expect(rendered).toContain("`sourceNotes.rawContent`");
    expect(rendered).toContain("`sourceImages.main`");
    expect(rendered).toContain("`subcategory`");
  });

  it("reports an unparseable line rather than dropping it", () => {
    expect(report()).toContain("not valid JSON");
  });

  it("says plainly when nothing was refused", () => {
    expect(renderNeedsAttention(planValidFixture(), VALID_FIXTURE)).toContain(
      "Every record in this batch passed validation",
    );
  });
});

/**
 * The register's real structure, reproduced: the `## Register` heading, the table with its example
 * row, **the paragraph that sits between the table and the next heading**, then `## Rejected ids`
 * with a table of its own.
 *
 * That paragraph is the whole reason this fixture exists in this form. The old one ran the table
 * straight into the next heading, so an insertion above that heading looked correct — and against
 * the real file the same insertion put rows after the paragraph with no blank line, where Markdown
 * reads them as lazy continuation and renders them as prose. `the register fixture matches the real
 * file` below is what keeps this honest if the real file is ever reshaped.
 */
const EXAMPLE_ROW_PARAGRAPH = "**The example row is not a reservation, and P050 is no longer next.**";

const REGISTER_FIXTURE_EXAMPLE_ROW =
  "| ~~P050~~ | ~~Gold Plated AD Studs~~ | ~~`earrings`~~ | ~~`in-review`~~ | ~~2026-08-23~~ | **EXAMPLE ROW — not a real draft.** |";

function realShapedRegister(extraRows: string[] = [], rejectedRows: string[] = []): string {
  return [
    "# Drafts in progress",
    "",
    "## Register",
    "",
    "| Product ID | Reference Title (old site) | Category | Stage | Last Updated | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    REGISTER_FIXTURE_EXAMPLE_ROW,
    ...extraRows,
    "",
    EXAMPLE_ROW_PARAGRAPH + " An id is reserved by the",
    "first file named after it, never by appearing in a table. ADR-054 retired **P050–P100**",
    "permanently and starts the Odoo migration at **P101**.",
    "",
    "## Rejected ids",
    "",
    "| Product ID | Rejected | Why |",
    "| --- | --- | --- |",
    ...(rejectedRows.length > 0 ? rejectedRows : ["| _(none yet)_ | | |"]),
    "",
  ].join("\n");
}

function queuedRow(productId: string): string {
  return `| ${productId} | Synthetic Title ${productId} | \`rings\` | \`queued\` | 2026-08-23 | batch \`test\` |`;
}

function registerTableOf(markdown: string) {
  const table = parseMarkdownTables(markdown).tables.find(
    (candidate) =>
      candidate.headerCells[0] === "Product ID" && candidate.headerCells.includes("Stage"),
  );
  if (table === undefined) throw new Error("no register table in the parsed output");
  return table;
}

describe("the register fixture matches the real file", () => {
  const realRegister = readFileSync(join(REPO_ROOT, "docs/pipeline-prep/drafts-in-progress.md"), "utf8");

  it("both put a paragraph between the register table and the next heading", () => {
    for (const [label, markdown] of [
      ["the real file", realRegister],
      ["the fixture", realShapedRegister()],
    ] as const) {
      const tableEnd = markdown.lastIndexOf("|", markdown.indexOf(EXAMPLE_ROW_PARAGRAPH));
      const nextHeading = markdown.indexOf("## Rejected ids");

      expect(markdown, label).toContain(EXAMPLE_ROW_PARAGRAPH);
      expect(tableEnd, label).toBeLessThan(markdown.indexOf(EXAMPLE_ROW_PARAGRAPH));
      expect(markdown.indexOf(EXAMPLE_ROW_PARAGRAPH), label).toBeLessThan(nextHeading);
    }
  });

  it("the real file parses cleanly today, and its register table has six columns", () => {
    expect(parseMarkdownTables(realRegister).problems).toEqual([]);
    expect(registerTableOf(realRegister).columnCount).toBe(6);
  });

  /**
   * Before Stage 0 ran for real, the table held only the struck-through example row while the
   * prose already said the migration "starts at P101" — proving a prose mention is not a
   * reservation. Since the 2026-08-24 run, P101–P642 are reserved by rows of their own; the
   * prose sentence is still there, and the prose-is-not-a-reservation guard now lives in the
   * synthetic test below. The eleven pilot products published on 2026-08-24 moved to
   * `products-completed.md`, per the register convention that the two files never hold the
   * same id at the same time — their reservation now lives in `data/products.json` itself,
   * where the ids are active records.
   */
  it("the real file reserves the example row plus the still-queued migration batch, nothing else", () => {
    const reserved = registerTableOf(realRegister).rows.map((row) => row[0]);
    const publishedPilot = new Set([
      "P106", "P108", "P109", "P110", "P115", "P117", "P118", "P119", "P120", "P121", "P122",
    ]);
    const queuedBatch = Array.from({ length: 542 }, (_unused, index) => `P${101 + index}`)
      .filter((id) => !publishedPilot.has(id));

    expect(reserved).toEqual(["~~P050~~", ...queuedBatch]);
    expect(realRegister).toContain("**P101**");
  });
});

describe("Part D — the drafts-in-progress rows", () => {
  it("writes the new queued stage, never extracted", () => {
    const rows = renderDraftsInProgressRows(planValidFixture(), "2026-08-23");

    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row).toContain("`queued`");
      expect(row).not.toContain("extracted");
    }
  });

  it("renders one pipe-delimited row per queued product, id first", () => {
    const [firstRow] = renderDraftsInProgressRows(planValidFixture(), "2026-08-23");

    expect(firstRow.split("|").map((cell) => cell.trim())).toEqual([
      "",
      "P101",
      "SYNTHETIC FIXTURE — Adjustable Wave Band Ring",
      "`rings`",
      "`queued`",
      "2026-08-23",
      expect.stringContaining("Odoo id `1002`"),
      "",
    ]);
  });

  /**
   * The real export carries sixteen titles with a literal `|` in them — "DC Jewelry … Rosegold
   * Polish | Adjustable AD Fashion Ring". Unescaped, each one splits its cell in two, the row
   * parses at seven cells against a six-cell header, and the append guard refuses the whole
   * batch. The entity `&#124;` renders as the same character without being a cell boundary.
   */
  it("escapes a literal | in the reference title so the row still parses at six cells", () => {
    const record = cleanRecord();
    (record.sourceNotes as SourceRecord).referenceTitle =
      "DC Jewelry Baguette Sparkle Ring – Rosegold Polish | Adjustable AD Fashion Ring";
    const plan = planBatch({
      records: [{ value: record, line: 1 }],
      parseErrors: [],
      batchId: BATCH_ID,
      catalogue: CATALOGUE_AT_P049,
      imageExists: everyImageExists,
    });

    const [row] = renderDraftsInProgressRows(plan, "2026-08-24");
    expect(row).toContain("Rosegold Polish &#124; Adjustable AD Fashion Ring");

    const registerPath = join(incomingRoot, "register-pipe-title.md");
    writeFileSync(registerPath, realShapedRegister());
    appendRegisterRows([row], ["P101"], registerPath);

    const written = readFileSync(registerPath, "utf8");
    expect(parseMarkdownTables(written).problems).toEqual([]);
    const appended = registerTableOf(written).rows.find((cells) => cells[0] === "P101");
    expect(appended).toHaveLength(6);
    expect(appended?.[1]).toBe(
      "DC Jewelry Baguette Sparkle Ring – Rosegold Polish &#124; Adjustable AD Fashion Ring",
    );
  });

  it("refuses to append an id the register already reserves with a row", () => {
    const registerPath = join(incomingRoot, "register-collision.md");
    writeFileSync(registerPath, realShapedRegister(["| P101 | already here | `rings` | `queued` | 2026-08-23 | |"]));

    expect(() => appendRegisterRows([queuedRow("P101")], ["P101"], registerPath)).toThrow(
      /already names P101/,
    );
  });

  /**
   * The second fault the real file exposed and the fixture could not. The guard used to test
   * `\bP101\b` against the whole document, and the register's own prose says the migration
   * "starts at P101" — so the first real batch would have been refused by a sentence describing
   * the plan. An id is reserved by a row, never by being mentioned.
   */
  it("does not treat an id mentioned in prose as a reservation", () => {
    const registerPath = join(incomingRoot, "register-prose.md");
    writeFileSync(registerPath, realShapedRegister());

    expect(readFileSync(registerPath, "utf8")).toContain("starts the Odoo migration at **P101**");
    expect(() => appendRegisterRows([queuedRow("P101")], ["P101"], registerPath)).not.toThrow();
    expect(registerTableOf(readFileSync(registerPath, "utf8")).rows.some((row) => row[0] === "P101")).toBe(
      true,
    );
  });

  it("still refuses an id that only a Rejected ids row names", () => {
    const registerPath = join(incomingRoot, "register-rejected.md");
    writeFileSync(registerPath, realShapedRegister([], ["| P111 | 2026-08-23 | rejected in review |"]));

    expect(() => appendRegisterRows([queuedRow("P111")], ["P111"], registerPath)).toThrow(
      /already names P111/,
    );
  });
});

/**
 * Part D, against the register's REAL shape rather than a simplified one.
 *
 * The fixture these cases replace was `"## Register\n\n| a | b |\n\n## Rejected ids\n"` — a table
 * sitting flush against the next heading. The real file has a paragraph between the two, and that
 * paragraph is what made the old insertion silently catastrophic: rows landed after it with no
 * blank line, so Markdown read them as lazy continuation and rendered 542 of them as one run-on
 * sentence. The old fixture could not see it because it had nothing there to land after.
 *
 * Every assertion below reads the written file back through `parseMarkdownTables` rather than
 * looking for a substring, because "the id appears somewhere before the next heading" is exactly
 * the check that passed while the file was being destroyed.
 */
describe("Part D — the register append, against the real file's shape", () => {
  function registerPathFor(name: string): string {
    return join(incomingRoot, `${name}.md`);
  }

  it("puts a new row inside the table, above the paragraph that follows it", () => {
    const registerPath = registerPathFor("shape-basic");
    writeFileSync(registerPath, realShapedRegister());

    appendRegisterRows([queuedRow("P101")], ["P101"], registerPath);
    const written = readFileSync(registerPath, "utf8");

    expect(written.indexOf("| P101 |")).toBeLessThan(written.indexOf(EXAMPLE_ROW_PARAGRAPH));
    expect(written.indexOf("| P101 |")).toBeLessThan(written.indexOf("## Rejected ids"));
  });

  it("produces output that parses as a table, which is the check the old test lacked", () => {
    const registerPath = registerPathFor("shape-parses");
    writeFileSync(registerPath, realShapedRegister());

    appendRegisterRows([queuedRow("P101"), queuedRow("P102")], ["P101", "P102"], registerPath);
    const written = readFileSync(registerPath, "utf8");
    const { tables, problems } = parseMarkdownTables(written);

    expect(problems).toEqual([]);
    const register = registerTableOf(written);
    expect(register.columnCount).toBe(6);
    expect(register.rows.map((row) => row[0])).toEqual(["~~P050~~", "P101", "P102"]);
    expect(tables.some((table) => table.headerCells.join(",") === "Product ID,Rejected,Why")).toBe(
      true,
    );
  });

  it("leaves the paragraph and the Rejected ids section exactly as they were", () => {
    const registerPath = registerPathFor("shape-intact");
    const before = realShapedRegister();
    writeFileSync(registerPath, before);

    appendRegisterRows([queuedRow("P101")], ["P101"], registerPath);
    const written = readFileSync(registerPath, "utf8");

    expect(written).toContain(EXAMPLE_ROW_PARAGRAPH);
    expect(written.slice(written.indexOf("## Rejected ids"))).toBe(
      before.slice(before.indexOf("## Rejected ids")),
    );
  });

  it("appends a whole batch and every one of them is a parsed row", () => {
    const registerPath = registerPathFor("shape-batch");
    writeFileSync(registerPath, realShapedRegister());

    const ids = Array.from({ length: 542 }, (_, index) => `P${101 + index}`);
    appendRegisterRows(ids.map(queuedRow), ids, registerPath);
    const written = readFileSync(registerPath, "utf8");
    const register = registerTableOf(written);

    expect(parseMarkdownTables(written).problems).toEqual([]);
    expect(register.rows).toHaveLength(543);
    expect(register.rows.every((row) => row.length === 6)).toBe(true);
    expect(register.rows.at(-1)?.[0]).toBe("P642");
    expect(written.indexOf("| P642 |")).toBeLessThan(written.indexOf(EXAMPLE_ROW_PARAGRAPH));
  });

  /**
   * The negative control. Reproducing the old insertion point — above the `## Rejected ids`
   * heading — against this same fixture must produce a document the parser refuses, otherwise
   * these tests would pass on the broken implementation too.
   */
  it("the old insertion point produces output the parser rejects", () => {
    const before = realShapedRegister();
    const marker = "## Rejected ids";
    const markerIndex = before.indexOf(marker);
    const corrupted = `${before.slice(0, markerIndex).replace(/\s+$/, "")}\n${queuedRow("P101")}\n\n${before.slice(markerIndex)}`;

    const register = registerTableOf(corrupted);
    expect(register.rows.map((row) => row[0])).not.toContain("P101");
    expect(corrupted.indexOf("| P101 |")).toBeGreaterThan(corrupted.indexOf(EXAMPLE_ROW_PARAGRAPH));
  });

  it("refuses to write at all when the register has no table to append to", () => {
    const registerPath = registerPathFor("shape-no-table");
    writeFileSync(registerPath, "# Register\n\n## Register\n\nNo table here.\n\n## Rejected ids\n");

    expect(() => appendRegisterRows([queuedRow("P101")], ["P101"], registerPath)).toThrow(
      /no table under it/,
    );
  });

  it("refuses when the Register heading is missing entirely", () => {
    const registerPath = registerPathFor("shape-no-heading");
    writeFileSync(registerPath, "# Drafts\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n");

    expect(() => appendRegisterRows([queuedRow("P101")], ["P101"], registerPath)).toThrow(
      /no "## Register" heading/,
    );
  });
});

describe("parseMarkdownTables", () => {
  it("reads a well-formed table into its header and rows", () => {
    const { tables, problems } = parseMarkdownTables("| a | b |\n| --- | --- |\n| 1 | 2 |\n");

    expect(problems).toEqual([]);
    expect(tables).toHaveLength(1);
    expect(tables[0].headerCells).toEqual(["a", "b"]);
    expect(tables[0].rows).toEqual([["1", "2"]]);
  });

  it("refuses a run of pipe lines with no delimiter row — what lazy continuation produces", () => {
    const { tables, problems } = parseMarkdownTables("Some paragraph text\n| P101 | queued |\n");

    expect(tables).toEqual([]);
    expect(problems[0]).toContain("no delimiter row");
  });

  it("reports a row whose column count does not match the header", () => {
    const { problems } = parseMarkdownTables("| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n");

    expect(problems[0]).toContain("3 cell(s), header has 2");
  });

  it("finds every table in a document, not just the first", () => {
    const { tables } = parseMarkdownTables(realShapedRegister());

    expect(tables.length).toBeGreaterThanOrEqual(2);
  });
});

describe("JSONL parsing", () => {
  it("skips blank lines and keeps one-based line numbers", () => {
    const { records, parseErrors } = parseJsonl('{"a":1}\n\n{"a":2}\n');

    expect(records.map((record) => record.line)).toEqual([1, 3]);
    expect(parseErrors).toEqual([]);
  });

  it("reports a malformed line and keeps reading the rest", () => {
    const { records, parseErrors } = parseJsonl('{"a":1}\nnot json\n{"a":3}\n');

    expect(records).toHaveLength(2);
    expect(parseErrors[0].line).toBe(2);
  });
});

/** The script with its prose stripped, so a boundary claim is checked against code, not comments. */
function executableSource(): string {
  return readFileSync(join(REPO_ROOT, "scripts/prepare-migration-batch.mjs"), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join("\n");
}

describe("the scope boundary", () => {
  it("never mentions the extraction skills it must not call", () => {
    for (const skill of ["draft-a-skills", "product-skills", "meta-skills"]) {
      expect(executableSource()).not.toContain(skill);
    }
  });

  it("never reads or writes the catalogue or the keyword map by path", () => {
    expect(executableSource()).not.toContain("data/keyword-map.json");
    expect(executableSource()).toContain("data/products.json");
    expect(executableSource()).not.toMatch(/writeFileSync\([^)]*products\.json/);
  });

  it("builds a raw block, not a Draft A object — the two are distinguishable by shape", () => {
    const block = buildRawBlock(cleanRecord(), "P101", BATCH_ID, "1002");

    expect(block).not.toHaveProperty("attributes");
    expect(block).not.toHaveProperty("status");
    expect(block.confirmationState.draftAExtractionRun).toBe(false);
  });
});

/**
 * M-5. `--dry-run` existed, was documented in ADR-054 and had no test at all — which is how a flag
 * whose entire job is "write nothing" gets to be the one flag nobody has proved writes nothing.
 * Every case here asserts against the filesystem afterwards, not against the exit code alone.
 */
describe("runCli --dry-run", () => {
  function dryRunRoot(name: string): string {
    const root = join(incomingRoot, `cli-${name}`);
    mkdirSync(root, { recursive: true });
    return root;
  }

  function runDryRun(fixture: string, root: string, extraArguments: string[] = []): number {
    const logged = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errored = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      return runCli([
        fixture,
        BATCH_ID,
        `--incoming-root=${root}`,
        "--date=2026-08-23",
        "--dry-run",
        ...extraArguments,
      ]);
    } finally {
      logged.mockRestore();
      errored.mockRestore();
    }
  }

  /**
   * These CLI cases changed meaning on 2026-08-24. `runCli` reads the real
   * `data/products.json`, and once Phase 2 landed P106–P122 there, the override floor assertion
   * refuses every run — dry or not — before any planning happens. That refusal is the designed
   * end state of a one-time script, so what is provable at the CLI level now is that a spent
   * override exits 1, says why, and still writes nothing. The dry-run *planning* behaviour
   * (counts, id ranges, known-stub handling) remains covered by the `planBatch` suites above,
   * which inject a pre-P050 catalogue fixture.
   */
  it("writes no raw block, no manifest and no needs-attention file when the spent override refuses", () => {
    const root = dryRunRoot("clean");
    stageImages(root, readFixture(VALID_FIXTURE));

    const exitCode = runDryRun(VALID_FIXTURE, root);

    expect(exitCode).toBe(1);
    expect(existsSync(join(root, BATCH_ID, "manifest.json"))).toBe(false);
    expect(existsSync(join(root, BATCH_ID, "needs-attention.md"))).toBe(false);
    for (const productId of ["P101", "P110"]) {
      expect(existsSync(join(root, BATCH_ID, productId, "raw-block.json"))).toBe(false);
    }
  });

  it("leaves the register untouched — not one row appended", () => {
    const root = dryRunRoot("register");
    stageImages(root, readFixture(VALID_FIXTURE));
    const registerPath = join(root, "register.md");
    const before = realShapedRegister();
    writeFileSync(registerPath, before);

    runDryRun(VALID_FIXTURE, root, [`--register=${registerPath}`]);

    expect(readFileSync(registerPath, "utf8")).toBe(before);
  });

  it("explains the refusal instead of reporting counts, naming the id that spent the override", () => {
    const root = dryRunRoot("counts");
    stageImages(root, readFixture(VALID_FIXTURE));
    const logLines: string[] = [];
    const errorLines: string[] = [];
    const logged = vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logLines.push(String(message));
    });
    const errored = vi.spyOn(console, "error").mockImplementation((message?: unknown) => {
      errorLines.push(String(message));
    });

    try {
      runCli([VALID_FIXTURE, BATCH_ID, `--incoming-root=${root}`, "--dry-run"]);
    } finally {
      logged.mockRestore();
      errored.mockRestore();
    }

    const errorOutput = errorLines.join("\n");
    expect(errorOutput).toContain("REFUSING TO RUN");
    expect(errorOutput).toContain("P122");
    expect(logLines.join("\n")).not.toContain("DRY RUN — nothing written.");
  });

  it("exits 1 when records were refused, and still writes nothing", () => {
    const root = dryRunRoot("refused");

    const exitCode = runDryRun(INVALID_FIXTURE, root);

    expect(exitCode).toBe(1);
    expect(existsSync(join(root, BATCH_ID))).toBe(false);
  });

  it("refuses before --known-stub-ids is even consulted, and still writes nothing", () => {
    const root = dryRunRoot("known-stub");
    stageImages(root, readFixture(INVALID_FIXTURE));

    const exitCode = runDryRun(INVALID_FIXTURE, root, ["--known-stub-ids=odoo-2002"]);

    expect(exitCode).toBe(1);
    expect(existsSync(join(root, BATCH_ID, "manifest.json"))).toBe(false);
    expect(existsSync(join(root, BATCH_ID, "needs-attention.md"))).toBe(false);
  });

  it("refuses a --known-stub-ids file it cannot read rather than running with an empty set", () => {
    const root = dryRunRoot("bad-list");
    const listPath = join(root, "not-an-array.json");
    writeFileSync(listPath, JSON.stringify({ ids: ["odoo-2002"] }));
    const errored = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      expect(runCli([INVALID_FIXTURE, BATCH_ID, `--incoming-root=${root}`, "--dry-run", `--known-stub-ids=${listPath}`])).toBe(1);
      expect(errored).toHaveBeenCalledWith(expect.stringContaining("Could not read --known-stub-ids"));
    } finally {
      errored.mockRestore();
    }
  });
});
