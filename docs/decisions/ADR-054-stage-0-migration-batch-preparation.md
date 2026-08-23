# ADR-054: Stage 0 — deterministic migration batch preparation, and why it stops before extraction

- **Status:** Accepted
- **Date:** 2026-08-23
- **Prompt:** 72

## Context

[ADR-051](ADR-051-draft-a-content-pipeline.md) designed the Draft A pipeline and
[ADR-053](ADR-053-draft-a-to-product-orchestration.md) connected its far end to
`data/products.json`. Between them the pipeline can now take *one* raw block and carry it to a
published product. What neither of them answered is how several hundred raw blocks get to the
front of that pipeline in the first place.

The Odoo migration is that question made concrete. The old site — `morchadijewels.com`, running
Odoo, the subject of the consolidation described in `docs/PROJECT-STATE.md` — is being exported
as a JSONL file with one record per listing, alongside a directory of photographs already
downloaded and hash-checked. Each record carries the original listing's text, its variant
attributes, its images, a reference price, and a category and subcategory that Phase B of the
export has already mapped onto this project's vocabulary.

Three facts about that input shape everything below.

**It is large.** Five hundred listings is not a size at which "run the extraction skill over the
file" is a reviewable action. A single run producing 500 Draft A objects is a run nobody reads,
and ADR-051's entire design rests on the owner reading every candidate value.

**It is uneven.** `docs/pipeline-prep/source-data-notes.md` already recorded what the export
looks like: rows whose description is a payment policy, rows with a word repeated three times,
rows with a price in prose. Some listings will have almost no copy at all. A batch step that
meets a bad record has exactly three options — refuse it, quietly drop it, or quietly pass it
through — and two of those are how a migration loses products without anyone noticing.

**Half of the work in it is not judgement.** Reading a JSONL file, checking that a category is
one of eleven strings, checking that a file exists on disk, assigning the next number in a
sequence, renaming `attributes[].name` to `variants[].optionName` — none of that is a call the
owner has to make, and none of it should consume a model's attention or a person's.

That last observation is the whole of this ADR. The migration's work divides cleanly into a part
a machine can do identically twice and a part that requires a person to read a sentence and
decide whether the shop is willing to say it. Mixing them produces the worst of both: a
deterministic step that can hallucinate, and a judgement step buried in bookkeeping.

## Decision

### 1. Stage 0 is a separate step, and it does not extract

`scripts/prepare-migration-batch.mjs` is Stage 0. It ingests the JSONL export, validates every
record, assigns real product ids, transforms the Odoo shapes into this project's shapes, and
writes a queue. Then it stops.

It does not run Draft A extraction. It never loads `.claude/skills/draft-a-skills.md`,
`product-skills.md` or `meta-skills.md`. It produces no Draft A object, proposes no material,
plating or stone candidate, quotes no source phrase, and writes to neither `data/products.json`
nor `data/keyword-map.json`. `lib/prepare-migration-batch.test.ts` asserts the first two of
those against the script's own source with its prose stripped out, so the boundary is checked
against code rather than against a comment claiming the code behaves.

Draft A extraction remains what it already was: a separate, human-supervised, Claude-driven step,
run afterward over the queue in reviewable sub-batches.

The separation is not squeamishness about letting a model near the data. It is that the two steps
have opposite correctness conditions:

| | Stage 0 | Draft A extraction |
| --- | --- | --- |
| Correct means | The same input produces byte-identical output every time | Every proposed value carries the source phrase it came from, and a person has read it |
| A failure looks like | A crash, or a record silently dropped | A fluent claim with no source behind it |
| How it is checked | Unit tests, run in CI, over a fixture | The owner reading candidates one at a time |
| Rerunnable | Yes, into a fresh batch directory | Not meaningfully — review is the expensive part |

A step that is both is checkable as neither. Keeping them apart also means a bad export can be
found and fixed before any extraction budget is spent on it, and it means the id assignment — the
one irreversible thing in the whole pipeline — happens in the step that has tests rather than in
the step that has judgement.

### 2. Validation refuses, and a refusal is written down

Four checks, and a record failing any of them is not queued:

| Field | Rule |
| --- | --- |
| `category` | `null`, or one of eleven fixed slugs |
| `subcategory` | Absent, `null`, or a non-empty string. **No enum**, per the owner's data-capture-only decision — the vocabulary is being collected, not yet fixed |
| `rawContent` | At least 50 characters of trimmed text, **or** the record explicitly carries `knownStub: true` |
| `images.main` | A file exists on disk at `content-pipeline/incoming/{batch-id}/odoo-{originalId}/raw/main.webp` |

Every fault a record has is reported, not just the first: a record with a bad category and a
missing photograph should be fixed once.

Refusals go to `content-pipeline/incoming/{batch-id}/needs-attention.md` as a table of line
number, `originalId`, field and reason, and they also appear in `manifest.json` with status
`needs-attention` and a null `productId`. The manifest holds one entry per record *read*, so its
count always equals the number of lines in the export. There is no path through this script on
which a record is skipped without a row, and no path on which a failing record is carried forward
as though it had passed. A malformed JSON line is reported the same way rather than aborting the
run — 499 good records should not wait on one bad one.

**Two extensions to the stated rules, both refusals rather than repairs.** A record whose
`originalId` is missing cannot be ordered or have its images located, so it is refused. Two
records sharing an `originalId` are *both* refused, because a stable assignment is not defined
for them — picking one arbitrarily would break decision 3 the first time the export was
regenerated.

#### The sub-50-character stub rule, and what it actually asserts

50 characters is not a quality bar. It is the length below which there is not enough source text
for extraction to quote anything, which makes the resulting Draft A object provenance-free by
construction — the one shape ADR-051 exists to prevent. The rule is therefore not "short copy is
bad" but "a short record must be an acknowledged decision". `knownStub: true` is that
acknowledgement, and a stub that carries it is queued with a warning saying it needs
owner-supplied copy before extraction can do anything useful with it.

#### `gift-hampers` is accepted here and by nothing else

Ten of the eleven category slugs are the [ADR-020](ADR-020-two-tier-catalogue-ia.md) categories
that `types/product.ts`, `scripts/validate-products.mjs` and `scripts/validate-draft-a.mjs` all
hard-code. The eleventh, `gift-hampers`, is in none of them: the application's `Category` union
has ten members and a product carrying `gift-hampers` would be rejected by both downstream
validators.

Stage 0 accepts it anyway, with a warning attached to the record and carried into the manifest
and the register row. The batch is a faithful record of what the old site had, and the two
alternatives are worse: refusing the record loses a real product the owner sells, and silently
refiling it under one of the ten is precisely the judgement Stage 0 must not make. The warning is
what stops it reaching the catalogue unnoticed — whether `gift-hampers` becomes an eleventh
category, a collection, or something else is an owner decision, and it has to be made before any
such record can be published. **It is an open question this ADR raises and does not answer.**

### 3. Ids start at P101, are assigned in a stable order, and the script refuses to run twice

`data/products.json` holds P001–P049 and `content-pipeline/drafts/README.md` names P050 as the
next unused number. This batch starts at **P101** instead, leaving P050–P100 deliberately unused.

The gap is not an accident and not a reservation for later use. It is a legible boundary: an id
in the hundreds is a migrated Odoo listing, an id below fifty is an original catalogue product,
and the fifty numbers between them are the seam. This costs nothing — ADR-051 decision 4 already
established that gaps in the sequence are correct and expected, and that ids are never reused —
and it buys the ability to tell at a glance, in an invoice line or a photograph filename, which
half of the catalogue a product came from. **P050–P100 are permanently retired**, on the same
terms as a rejected candidate's number.

**The safety assertion.** Before assigning anything, the script reads `data/products.json` and
refuses to proceed unless its maximum id is P049 or lower. It fails loudly, prints the id it
found, and offers no flag to override the override. A maximum at or above P050 means either this
script has already run and its products have been published, or the catalogue is not in the state
this one-time override was written against; in both cases the sequence is no longer the sequence
the script assumes. This guards the one thing in the pipeline that cannot be undone by editing a
file — ADR-051 decision 4's reasoning applies exactly: *an id with no product behind it is a
harmless hole; an id with two products behind it is a defect that reads as correct.*

**Stability.** Validated records are sorted by `originalId` ascending — numerically, so 205 sorts
before 1042 — before the first id is handed out. Re-running against identical input therefore
produces identical assignments, which is what makes the script safe to run against a corrected
export: fixing record 400 does not renumber records 1 through 399.

**Two more double-run guards, past the assertion.** The script refuses to write if any
`raw-block.json` it is about to create already exists, and `appendRegisterRows` refuses if the
register already names any id it is about to add. Both fail before writing anything.

### 4. The raw block is the reservation, and it is deliberately not a Draft A object

`content-pipeline/drafts/README.md` says an id is reserved by being written into a draft, not by
appearing in a table. Stage 0 does not create drafts, so that rule needed reconciling rather than
replacing. The reconciliation, now written into that README: **the artefact that reserves an id is
the first file named after it**, which is `content-pipeline/drafts/PNNN.json` on the fresh path
and `content-pipeline/incoming/{batch-id}/PNNN/raw-block.json` on the migration path. The rule is
unchanged in substance; only the list of files that can be the first one is longer.

A raw block is **not** a Draft A object and must never be handed to
`scripts/validate-draft-a.mjs`. It carries `sourceNotes`, the pre-mapped
category/subcategory/`suggestedCollections`, `pricing.referencePrice`, the transformed `variants`,
and the suggested `images`. It carries no `attributes`, no `flaggedContent`, no `personalized`
verdict, no `notes` and no `status`, because every one of those is produced by extraction. It says
so in the file itself, in a `confirmationState` block whose `draftAExtractionRun` is `false`, so a
raw block cannot be mistaken for a draft by anything that opens it — including a person.

This is also why the populated `images` block is not a violation of the Phase 1 rule that drafts
carry no images. That rule is about drafts. A raw block's images are suggestions being carried
*to* the manual image-assignment step, not values that step has already made.

### 5. Image paths are suggestions with their provenance attached, and `verified_distinct` is evidence

`images.general` and `images.variantImages` are populated with the paths the product *would* use:
`/products/P101.webp` for the main photograph, `/products/P101-2.webp` onward for its siblings,
and `/products/P101-golden.webp` keyed as `"Colour:Golden"` for a variant. Those are ADR-006's
existing conventions, matching what P002 and P010 already do in `data/products.json`, because
these strings are copied verbatim into `media.images` by ADR-053's mapper and a path invented here
would be a path the site cannot serve.

Alongside them, and deliberately not inside them, sits `imageSuggestionProvenance`: for every
suggested path, the source file it describes, and for every variant image, the source system's
`verified_distinct` flag carried forward as `verifiedDistinct`.

This is the earlier agreed exception, stated precisely. Verified, hash-checked source-system data
is a **trusted suggestion** — good enough that a person reviewing it will usually accept it, which
is exactly why it is worth carrying — but it is never a blind auto-population. `verified_distinct`
answers "are these two files actually different images", which is a question about bytes. It does
not answer "is this the photograph that should represent the Golden variant on this shop", which
is a question about the shop. Keeping the flag beside the suggestion rather than inside it is what
keeps those two questions apart: `images.variantImages` stays a plain string-to-string map
matching the Draft A schema exactly, and the evidence for each entry is one field away for whoever
is deciding. A missing flag reads as *not verified*, never as verified.

Nothing in a raw block is confirmed. `imagesConfirmed` is `false` in every one of them.

### 6. `queued` is a new, earlier stage in the register vocabulary

`docs/pipeline-prep/drafts-in-progress.md` documented five stages beginning at `extracted`. Stage
0 adds a sixth **before** it: `queued` — an id is assigned and a raw block exists, and Draft A
extraction has not run.

Reusing `extracted` was the alternative and it is a lie about state. `extracted` means "the skill
has produced the draft and `validate-draft-a.mjs` passes"; a queued record has been through
neither. The register is the human index that survives if `content-pipeline/` is lost, and a stage
name that overstates what has happened to a product is the one kind of error it cannot afford.
The vocabulary is updated in both places that document it — the register's own Stages table and
`content-pipeline/drafts/README.md`.

## Alternatives considered

**One script that prepares and extracts.** Fewer moving parts, one command, no queue directory.
Rejected for the reason decision 1 gives: the two halves have opposite correctness conditions, and
a combined step is testable as neither. It would also put id assignment — irreversible — in the
same run as extraction, so a run that failed halfway would leave ids assigned to products whose
drafts do not exist.

**Assign ids at extraction time instead.** Would keep Stage 0 read-only and defer the
irreversible act. Rejected because the id is what every other artefact is named after: the raw
block, the register row, the photograph, the manifest entry. Without one, the queue has no stable
key and the sub-batches cannot be split, tracked or resumed. Assigning early is also what makes
extraction restartable — a failed sub-batch is re-run against raw blocks that already know their
own ids.

**Continue the sequence at P050.** Simpler, and it is what the existing documentation says.
Rejected for decision 3's reason: the gap is free and the legibility is not. It also removes any
chance of a migrated product colliding with a fresh-path draft created by hand at P050 while the
migration is in flight.

**Refuse `gift-hampers`.** Cleanest against the existing type system, and it would keep Stage 0's
accepted vocabulary identical to the application's. Rejected because it loses real products the
owner sells, and because deciding what a gift hamper *is* in this catalogue's information
architecture is an owner decision that should not be forced by a validator's convenience.

**Auto-populate variant images where `verified_distinct` is true.** The flag is trustworthy and
this would save real review time. Rejected: see decision 5. The flag answers a question about
bytes and the population is a question about the shop, and collapsing them would put the pipeline
in the business of deciding what a product looks like.

## Consequences

**What this makes possible.** A migration batch can be prepared, inspected and corrected before
any extraction runs. The queue is a directory of small JSON files with a manifest over it, so
sub-batches for extraction are a matter of choosing ids. A bad export is discovered in seconds
rather than in a review session.

**What it costs.** One more directory (`content-pipeline/incoming/`), one more stage in the
register vocabulary, and a manual step between Stage 0 and extraction that nothing automates — by
design, since that step is where a person looks at `needs-attention.md`.

**What is still not built.** The extraction driver that walks the queue in sub-batches does not
exist; today that is a person invoking the skill against a set of raw blocks. Nothing moves a raw
block into `content-pipeline/drafts/` once extraction has produced its Draft A object, and nothing
advances a register row from `queued` to `extracted`. Both are manual, consistent with every other
step in `docs/pipeline-prep/README.md`.

**What has not been run.** The real Phase B JSONL has not been delivered. Everything above was
built and tested against `scripts/fixtures/synthetic-odoo-batch.jsonl` — ten fabricated records
matching the schema this ADR states, marked `SYNTHETIC FIXTURE` in every title — and a companion
fixture of four deliberately broken records. **No real Odoo listing has been through this script.**
When the export arrives, the only thing that changes is the path passed on the command line; if
its schema differs from the one above, this ADR is what needs an addendum.

**One open question, restated so it is not lost:** `gift-hampers` is accepted by Stage 0 and by
nothing else in the repository. It needs an owner decision before any record carrying it can
become a product.

## The Phase B export schema this assumes

```json
{
  "originalId": 1002,
  "originalSku": "MJ-RG-1002",
  "originalUrl": "https://morchadijewels.com/shop/...",
  "referenceTitle": "string",
  "rawContent": "string | null",
  "rawHtml": "string | null",
  "originalCategories": ["string"],
  "category": "one of the eleven | null",
  "subcategory": "string | null",
  "suggestedCollections": ["string"],
  "referencePrice": "string | null",
  "knownStub": false,
  "attributes": [{ "name": "string", "values": ["string"] }],
  "images": {
    "main": "main.webp",
    "extra": ["extra-1.webp"],
    "variantImages": [
      { "attribute": "string", "value": "string", "file": "string", "verified_distinct": true }
    ]
  }
}
```

## Running it

```
node scripts/prepare-migration-batch.mjs <export.jsonl> <batch-id> [--incoming-root=DIR] [--register=FILE] [--date=YYYY-MM-DD] [--dry-run]
```

Exit 0 when every record queued, 1 when any record was refused or a guard fired, 2 on a usage
error. `--dry-run` prints the plan and writes nothing. `--incoming-root` and `--register` exist so
a synthetic batch can be demonstrated end to end without writing fabricated products into the real
register; both default to the real paths.

## Addendum, 2026-08-23 — the `gift-hampers` question is closed

Decision 2 of this record accepted `gift-hampers` as the eleventh category slug while noting that
nothing else in the repository recognised it, and its Consequences left that as **the** open owner
decision blocking publication of any record carrying it.

That decision has been made and implemented in
[ADR-055](ADR-055-category-vocabulary-and-surfacing.md). `gift-hampers` is now a valid category in
`types/product.ts`, `scripts/validate-products.mjs` and `scripts/validate-draft-a.mjs` as well as
here, and `lib/category-vocabulary.test.ts` asserts all four enumerations agree.

Two things change in this record's terms:

- **The `CATEGORIES_UNKNOWN_DOWNSTREAM` warning is gone.** The constant and its branch in
  `scripts/prepare-migration-batch.mjs` are deleted rather than emptied. A record carrying
  `gift-hampers` is now queued clean, with `validationStatus: "queued"` rather than
  `"queued-with-warnings"`. The prose in decision 2's *"`gift-hampers` is accepted here and by
  nothing else"* section describes a state that no longer exists; it is left in place because an
  accepted record is not rewritten, and this addendum is the correction.
- **Nothing else about Stage 0 changes.** Validation, id assignment from P101, the transformation
  and the manifest are untouched. ADR-055 added a `pending` state on the *category*, which is a
  storefront concern; Stage 0 does not read it and a raw block does not carry it.

The category being valid is not the same as it being browsable. A published gift-hamper product
would still be unreachable by a shopper until ADR-055's flag is flipped, and
`npm run validate:products` fails loudly if one is published before then.
