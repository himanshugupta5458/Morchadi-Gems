import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  planBatch,
  readMaxCatalogueProductId,
  renderDraftsInProgressRows,
  renderNeedsAttention,
  toVariants,
  validateSourceRecord,
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

/**
 * Stages the empty `.webp` placeholders the validator looks for. The check is that a path
 * resolves, not that a file decodes, so zero-byte files are the honest fixture here.
 */
function stageImages(incomingRoot: string, records: { value: unknown }[]): void {
  for (const { value } of records) {
    const record = value as SourceRecord;
    const images = record.images as { main?: string; extra?: string[] } | undefined;
    const files = [images?.main ?? "main.webp", ...(images?.extra ?? [])];
    for (const file of files) {
      const path = join(incomingRoot, BATCH_ID, `odoo-${String(record.originalId)}`, "raw", file);
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

function validateOne(record: SourceRecord, imageExists = everyImageExists) {
  return validateSourceRecord(record, { batchId: BATCH_ID, index: 0, imageExists });
}

function cleanRecord(overrides: SourceRecord = {}): SourceRecord {
  return {
    originalId: 1002,
    originalSku: "SYN-RG-1002",
    originalUrl: "https://morchadijewels.example/shop/syn",
    referenceTitle: "SYNTHETIC FIXTURE — a record that passes",
    rawContent:
      "A description comfortably longer than the fifty-character stub threshold, so nothing here is a stub.",
    rawHtml: "<p>A description.</p>",
    originalCategories: ["Rings"],
    category: "rings",
    subcategory: "adjustable-rings",
    suggestedCollections: [],
    referencePrice: "₹499 (old site)",
    knownStub: false,
    attributes: [],
    images: { main: "main.webp", extra: [], variantImages: [] },
    ...overrides,
  };
}

describe("the fixture itself", () => {
  it("is ten synthetic records, every one of them marked as fabricated", () => {
    const records = readFixture(VALID_FIXTURE);

    expect(records).toHaveLength(10);
    for (const { value } of records) {
      expect(String((value as SourceRecord).referenceTitle)).toContain("SYNTHETIC FIXTURE");
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

  it("rejects missing rawContent when the record is not flagged as a known stub", () => {
    const result = validateOne(cleanRecord({ rawContent: null }));

    expect(result.ok).toBe(false);
    expect(result.failures).toContainEqual({
      field: "rawContent",
      reason: expect.stringContaining("not flagged knownStub"),
    });
  });

  it("rejects short-but-present content when the record is not flagged as a known stub", () => {
    const result = validateOne(cleanRecord({ rawContent: "Nice ring." }));

    expect(result.ok).toBe(false);
    expect(result.failures[0].reason).toContain("10 characters");
  });

  it("accepts a stub when the export flags it explicitly, and warns that it has nothing to quote", () => {
    const result = validateOne(cleanRecord({ rawContent: "Nice ring.", knownStub: true }));

    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual({
      field: "rawContent",
      reason: expect.stringContaining("knownStub"),
    });
  });
});

describe("image existence validation", () => {
  it("rejects a record whose main photograph is not on disk, quoting the path it looked for", () => {
    const result = validateOne(cleanRecord(), () => false);

    expect(result.ok).toBe(false);
    expect(result.failures).toContainEqual({
      field: "images.main",
      reason: `no file on disk at content-pipeline/incoming/${join(BATCH_ID, "odoo-1002", "raw", "main.webp")}`,
    });
  });

  it("looks for the main photograph under the record's own originalId", () => {
    const looked: string[] = [];
    validateOne(cleanRecord({ originalId: 4242 }), (path) => {
      looked.push(path);
      return true;
    });

    expect(looked).toEqual([join(BATCH_ID, "odoo-4242", "raw", "main.webp")]);
  });

  it("rejects a malformed variant image entry before it can reach the transformer", () => {
    const result = validateOne(
      cleanRecord({
        images: {
          main: "main.webp",
          extra: [],
          variantImages: [{ attribute: "Colour", value: "", file: "v.webp" }],
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.field)).toContain("images.variantImages[0]");
  });
});

describe("collecting every fault rather than the first", () => {
  it("reports the category and the missing image together", () => {
    const result = validateOne(cleanRecord({ category: "toe-rings" }), () => false);

    expect(result.failures.map((failure) => failure.field).sort()).toEqual([
      "category",
      "images.main",
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

  it("passes against the real data/products.json", () => {
    const realCatalogue: unknown = JSON.parse(
      readFileSync(join(REPO_ROOT, "data/products.json"), "utf8"),
    );

    expect(readMaxCatalogueProductId(realCatalogue)).toBeLessThanOrEqual(CATALOGUE_MAX_ID_CEILING);
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
      { value: cleanRecord({ originalId: 1002 }), line: 1 },
      { value: cleanRecord({ originalId: 1002 }), line: 2 },
      { value: cleanRecord({ originalId: 1003 }), line: 3 },
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
  it("maps Odoo attributes onto { optionName, values }", () => {
    expect(
      toVariants({
        attributes: [
          { name: "Colour", values: ["Golden", "Silver"] },
          { name: "Size", values: ["6", "7", "8"] },
        ],
      }),
    ).toEqual([
      { optionName: "Colour", values: ["Golden", "Silver"] },
      { optionName: "Size", values: ["6", "7", "8"] },
    ]);
  });

  it("produces an empty array for a record with no attributes", () => {
    expect(toVariants({})).toEqual([]);
  });

  it("copies the values rather than aliasing the source array", () => {
    const source = { attributes: [{ name: "Colour", values: ["Golden"] }] };
    toVariants(source)[0].values.push("Silver");

    expect(source.attributes[0].values).toEqual(["Golden"]);
  });

  it("keeps source spelling and source order untouched", () => {
    expect(toVariants({ attributes: [{ name: "Strap Colour", values: ["Gold", "black"] }] })).toEqual([
      { optionName: "Strap Colour", values: ["Gold", "black"] },
    ]);
  });
});

describe("Part C — the image transformation", () => {
  const record = {
    images: {
      main: "main.webp",
      extra: ["extra-1.webp", "extra-2.webp"],
      variantImages: [
        { attribute: "Colour", value: "Golden", file: "variant-golden.webp", verified_distinct: true },
        { attribute: "Colour", value: "Rose Gold", file: "variant-rose.webp", verified_distinct: false },
      ],
    },
  };

  it("puts the main photograph first and numbers its siblings from 2, per ADR-006", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(images.general).toEqual([
      "/products/P101.webp",
      "/products/P101-2.webp",
      "/products/P101-3.webp",
    ]);
  });

  it("keys variant images as OptionName:Value", () => {
    const { images } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(images.variantImages).toEqual({
      "Colour:Golden": "/products/P101-golden.webp",
      "Colour:Rose Gold": "/products/P101-rose-gold.webp",
    });
  });

  it("carries verified_distinct forward as metadata beside the suggestion, not inside it", () => {
    const { images, imageSuggestionProvenance } = buildImageSuggestions(
      record,
      "P101",
      BATCH_ID,
      "1002",
    );

    for (const path of Object.values(images.variantImages)) {
      expect(typeof path).toBe("string");
    }
    expect(imageSuggestionProvenance.variantImages).toEqual([
      {
        key: "Colour:Golden",
        path: "/products/P101-golden.webp",
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "variant-golden.webp"),
        verifiedDistinct: true,
      },
      {
        key: "Colour:Rose Gold",
        path: "/products/P101-rose-gold.webp",
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "variant-rose.webp"),
        verifiedDistinct: false,
      },
    ]);
  });

  it("treats a missing verified_distinct as not verified rather than as verified", () => {
    const { imageSuggestionProvenance } = buildImageSuggestions(
      { images: { variantImages: [{ attribute: "Colour", value: "Golden", file: "v.webp" }] } },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(imageSuggestionProvenance.variantImages[0].verifiedDistinct).toBe(false);
  });

  it("records the source file behind every general suggestion", () => {
    const { imageSuggestionProvenance } = buildImageSuggestions(record, "P101", BATCH_ID, "1002");

    expect(imageSuggestionProvenance.general).toEqual([
      {
        path: "/products/P101.webp",
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "main.webp"),
        role: "main",
      },
      {
        path: "/products/P101-2.webp",
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "extra-1.webp"),
        role: "extra-1",
      },
      {
        path: "/products/P101-3.webp",
        sourceFile: join(BATCH_ID, "odoo-1002", "raw", "extra-2.webp"),
        role: "extra-2",
      },
    ]);
  });

  it("disambiguates two option names that slug to the same value", () => {
    const { images } = buildImageSuggestions(
      {
        images: {
          variantImages: [
            { attribute: "Colour", value: "Gold", file: "a.webp", verified_distinct: true },
            { attribute: "Strap", value: "Gold", file: "b.webp", verified_distinct: true },
          ],
        },
      },
      "P101",
      BATCH_ID,
      "1002",
    );

    expect(images.variantImages).toEqual({
      "Colour:Gold": "/products/P101-colour-gold.webp",
      "Strap:Gold": "/products/P101-strap-gold.webp",
    });
  });

  it("gives a record with no photographs beyond the main one a single general entry", () => {
    const { images } = buildImageSuggestions({ images: {} }, "P101", BATCH_ID, "1002");

    expect(images).toEqual({ general: ["/products/P101.webp"], variantImages: {} });
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
      "knownStub",
      "originalCategories",
      "originalId",
      "originalSku",
      "originalUrl",
      "rawContent",
      "rawHtml",
      "referenceTitle",
    ]);
    expect(block.sourceNotes.originalId).toBe("1002");
    expect(block.sourceNotes.originalSku).toBe("SYN-RG-1002");
  });

  it("transcribes rawContent byte for byte", () => {
    const source = readFixture(VALID_FIXTURE)[0].value as SourceRecord;
    const block = plan().assigned[0].rawBlock;

    expect(block.sourceNotes.rawContent).toBe(source.rawContent);
  });

  it("carries the Phase B category, subcategory and suggestedCollections through unchanged", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.category).toBe("rings");
    expect(block.subcategory).toBe("adjustable-rings");
    expect(block.suggestedCollections).toEqual(["anti-tarnish"]);
  });

  it("quarantines the source price to pricing.referencePrice and writes no other price field", () => {
    const block = plan().assigned[0].rawBlock;

    expect(block.pricing).toEqual({ referencePrice: "₹499 (old site)" });
    expect(block.pricing).not.toHaveProperty("price");
    expect(block.pricing).not.toHaveProperty("mrp");
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
    for (const [key, path] of Object.entries(block.images.variantImages)) {
      expect(key).toMatch(/^.+:.+$/);
      expect(path).toMatch(/^\/products\/P\d{3}[a-z0-9-]*\.webp$/);
    }
  });

  it("carries none of the fields extraction owns", () => {
    const block = plan().assigned[0].rawBlock;

    for (const field of ["attributes", "flaggedContent", "personalized", "notes", "generatedBy"]) {
      expect(block).not.toHaveProperty(field);
    }
  });

  it("gives a record with no attributes an empty variants array rather than omitting it", () => {
    const withoutAttributes = plan().assigned.find((entry) => entry.originalId === "1008");

    expect(withoutAttributes?.rawBlock.variants).toEqual([]);
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
          { value: cleanRecord({ rawContent: "Short.", knownStub: true }), line: 1 },
          { value: cleanRecord({ originalId: 1003 }), line: 2 },
        ],
        parseErrors: [],
        batchId: BATCH_ID,
        catalogue: CATALOGUE_AT_P049,
        imageExists: everyImageExists,
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
    expect(rendered).toContain("`rawContent`");
    expect(rendered).toContain("`images.main`");
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

  it("refuses to append an id the register already names", () => {
    const registerPath = join(incomingRoot, "register-collision.md");
    writeFileSync(registerPath, "| P101 | already here |\n\n## Rejected ids\n");

    expect(() => appendRegisterRows(["| P101 | x |"], ["P101"], registerPath)).toThrow(
      /already names P101/,
    );
  });

  it("inserts above the Rejected ids heading rather than at the end of the file", () => {
    const registerPath = join(incomingRoot, "register-insert.md");
    writeFileSync(registerPath, "## Register\n\n| a | b |\n\n## Rejected ids\n\n| x | y |\n");

    appendRegisterRows(["| P101 | queued |"], ["P101"], registerPath);
    const written = readFileSync(registerPath, "utf8");

    expect(written.indexOf("P101")).toBeLessThan(written.indexOf("## Rejected ids"));
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
