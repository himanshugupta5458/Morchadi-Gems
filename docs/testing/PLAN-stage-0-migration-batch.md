# Test Plan: Stage 0 migration batch preparation

- **Scope:** `scripts/prepare-migration-batch.mjs` — the whole of it. Validation (Part A),
  the P101 override and its safety assertion (Part B), the Odoo-to-schema transformation
  (Part C), the manifest and the register rows (Part D), and the scope boundary that says this
  script does not extract. Designed by
  [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md).

  Explicitly **not** covered: Draft A extraction, which this script does not do and which is a
  human-supervised step run afterward. Nothing here asserts anything about the quality of a
  candidate value, because Stage 0 proposes none.

- **Prerequisites:** none. No env vars, no credentials, no network, no batch on disk. Every
  decision function is pure, and the two cases that need files write them into a
  `mkdtemp` directory that is removed afterward.

- **Fixtures:** [`scripts/fixtures/synthetic-odoo-batch.jsonl`](../../scripts/fixtures/README.md)
  — ten fabricated records, every title marked `SYNTHETIC FIXTURE`, all valid — and
  `synthetic-odoo-batch-invalid.jsonl`, four records each broken in one specific way. **The real
  Phase B export has not been delivered**; these pin the mechanism, not the data.

## Cases

### Part A — category validation

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-01 | Each of the eleven fixed slugs | Accepted | Automated |
| TC-02 | `null` | Accepted — Phase B may not have decided one | Automated |
| TC-03 | A slug outside the eleven (`toe-rings`) | Refused, `field: "category"`, reason quotes the value | Automated |
| TC-04 | A non-string category (`7`) | Refused | Automated |
| TC-05 | `gift-hampers` | **Accepted with a warning** naming the downstream `Category` union it is absent from | Automated |

### Part A — subcategory validation

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-06 | Any non-empty string | Accepted — no enum is fixed yet | Automated |
| TC-07 | `null`, or the field absent entirely | Accepted | Automated |
| TC-08 | `""` and `"   "` | Refused — present but not a value | Automated |

### Part A — the sub-50-character stub rule

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-09 | `rawContent` over the threshold | Accepted | Automated |
| TC-10 | `rawContent: null`, no stub flag | Refused, reason names `knownStub` | Automated |
| TC-11 | 10 characters of content, no stub flag | Refused, reason states the measured length | Automated |
| TC-12 | 10 characters with `knownStub: true` | Accepted **with a warning** that extraction will have nothing to quote | Automated |

### Part A — image existence

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-13 | Main photograph absent from disk | Refused, `field: "images.main"`, reason quotes the exact path looked for | Automated |
| TC-14 | Which path is looked for | Exactly `{batch}/odoo-{originalId}/raw/main.webp`, once | Automated |
| TC-15 | A malformed `variantImages` entry | Refused before it can reach the transformer | Automated |

### Part A — reporting

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-16 | A record with two faults | **Both** reported, not just the first | Automated |
| TC-17 | Every refusal reaches `needs-attention.md` | Field and reason present for each | Automated |
| TC-18 | An unparseable JSONL line | Reported as a refusal; the surrounding records still parse | Automated |
| TC-19 | A batch with no refusals | The report says so plainly rather than being empty | Automated |

### Part B — the P101 safety assertion

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-20 | Catalogue at P049 | Passes, reports `maxProductId: "P049"` | Automated |
| TC-21 | **The real `data/products.json`** | Its maximum is at or below the P049 ceiling | Automated |
| TC-22 | Catalogue maximum artificially set to **P050** | Throws `REFUSING TO RUN`, naming P050 | Automated |
| TC-23 | Catalogue already holding P110 | Throws `REFUSING TO RUN` | Automated |
| TC-24 | A catalogue id that is not `PNNN` | Throws rather than treating it as zero | Automated |
| TC-25 | The assertion inside a full run | `planBatch` throws — **no id is assigned at all** | Automated |

### Part B — sequential assignment

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-26 | The ten-record fixture | Exactly **P101–P110** | Automated |
| TC-27 | The start constant | `MIGRATION_ID_START === 101`, and the first id is derived from it | Automated |
| TC-28 | Two runs, identical input | Identical id assignments **and** byte-identical raw blocks | Automated |
| TC-29 | The same records in reversed file order | Identical `originalId`-to-`productId` pairing — order comes from the data, not the file | Automated |
| TC-30 | Numeric ordering | `99`, `205`, `1042` — not a string sort | Automated |
| TC-31 | Non-numeric ids | Total, stable string fallback | Automated |
| TC-32 | The same `originalId` on two lines | **Both** refused; a stable assignment is not defined for them | Automated |
| TC-33 | A record that failed validation | No id assigned, `assignedRange` null | Automated |

### Part C — variant transformation

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-34 | Odoo attributes | `[{ optionName, values }]`, exactly draft-a-skills.md's shape | Automated |
| TC-35 | No attributes | `[]`, not an omitted field | Automated |
| TC-36 | The returned values array | A copy — mutating it does not reach the source record | Automated |
| TC-37 | Source spelling and order | Untouched, including inconsistent casing | Automated |

### Part C — image transformation

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-38 | Main plus two extras | `/products/P101.webp`, `-2`, `-3` — ADR-006's convention | Automated |
| TC-39 | Variant image keys | `"OptionName:Value"` mapping to a `/products/…` path | Automated |
| TC-40 | `verified_distinct` | Carried forward as `verifiedDistinct` **beside** the suggestion; `variantImages` stays a plain string-to-string map | Automated |
| TC-41 | `verified_distinct` absent | Reads as `false` — never as verified | Automated |
| TC-42 | Source provenance | Every suggested path records the source file it came from | Automated |
| TC-43 | Two option names slugging to the same value | Disambiguated by attribute; no path collision | Automated |
| TC-44 | No extras and no variant images | One general entry, empty variant map | Automated |

### Part C — the raw block

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-45 | Identity fields | `productId`, `stage: "queued"`, `sourceType: "migrated"` | Automated |
| TC-46 | The file states its own status | `confirmationState.draftAExtractionRun` and `imagesConfirmed` both `false` | Automated |
| TC-47 | `sourceNotes` key set | Exactly the eight fields ADR-054 names | Automated |
| TC-48 | `rawContent` | Transcribed byte for byte from the source | Automated |
| TC-49 | Phase B's category, subcategory, collections | Carried through unchanged | Automated |
| TC-50 | Price | Quarantined to `pricing.referencePrice`; no `price`, no `mrp` field at all | Automated |
| TC-51 | Schema conformance | `variants` and `images` match draft-a-skills.md exactly | Automated |
| TC-52 | Fields extraction owns | `attributes`, `flaggedContent`, `personalized`, `notes`, `generatedBy` all **absent** | Automated |

### Part D — manifest and register

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-53 | Entry count | One per record **read** — queued, refused and unparseable alike | Automated |
| TC-54 | A queued entry | id, category, status and raw-block path | Automated |
| TC-55 | A refused entry | `productId` and `rawBlockPath` both null | Automated |
| TC-56 | Provenance of the assignment | The catalogue maximum it was made against is recorded | Automated |
| TC-57 | A warning-carrying record | Status `queued-with-warnings`, distinct from `queued` | Automated |
| TC-58 | Register stage | Every row says `queued`; **none** says `extracted` | Automated |
| TC-59 | Register row shape | Six pipe-delimited cells, id first, batch and Odoo id in the notes | Automated |
| TC-60 | An id the register already names | Refused — the second half of the double-run guard | Automated |
| TC-61 | Insertion point | Above the `## Rejected ids` heading, not at end of file | Automated |

### The scope boundary

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-62 | The script's own source, prose stripped | Contains none of `draft-a-skills`, `product-skills`, `meta-skills` | Automated |
| TC-63 | Same, for data paths | No `data/keyword-map.json` anywhere; `data/products.json` **read** but never written | Automated |
| TC-64 | A raw block against a Draft A object | Distinguishable by shape — no `attributes`, no `status` | Automated |

### Manual cases

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-65 | Full CLI run on the ten-record fixture | Exit 0, `P101–P110`, ten raw blocks, a manifest, an empty needs-attention report, ten register rows | Manual |
| TC-66 | Re-running the same batch id | Exit 1, `REFUSING TO WRITE`, nothing overwritten | Manual |
| TC-67 | Full CLI run on the invalid fixture | Exit 1, zero queued, all four faults in `needs-attention.md`, register untouched | Manual |
| TC-68 | Two full runs into separate directories | Byte-identical raw blocks and byte-identical register rows | Manual |
| TC-69 | `data/products.json` and `data/keyword-map.json` after every run | Unmodified | Manual |
