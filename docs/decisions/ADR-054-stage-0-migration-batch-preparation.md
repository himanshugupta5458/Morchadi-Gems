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


## Addendum, 2026-08-23 — decision 5's field placement is reversed

[ADR-056](ADR-056-image-confirmation-provenance-and-draft-similarity.md) moves the image
provenance **inside** each suggestion, which is the opposite of what decision 5 chose. The
`imageSuggestionProvenance` block no longer exists, and `images.general` and
`images.variantImages` hold objects — `{ path, confirmed, sourceFile }` plus `role` or
`verifiedDistinct` — rather than bare paths.

Decision 5's reason is quoted in full in ADR-056 and is worth restating here: the provenance sat
beside the suggestion so that *"`images.variantImages` stays a plain string-to-string map matching
the Draft A schema exactly."* ADR-056 changed the Draft A schema to carry `confirmed` per image, so
the map is no longer plain and the reason no longer holds. What the placement cost in the meantime
is that the Draft A schema had no slot for a parallel block, so `verified_distinct` — the one piece
of hash-checked evidence in the whole import — stopped at the `queued` → `extracted` boundary.

The distinction decision 5 was protecting is untouched, because it was never about field placement:
`verifiedDistinct` answers *do these two files differ*, `confirmed` answers *is this the right
photograph for this variant on this shop*, Stage 0 writes only the first, and a missing
`verifiedDistinct` still reads as **not** verified.

No real batch has been prepared, so there is nothing to migrate. A synthetic batch already sitting
in `content-pipeline/incoming/` carries the old shape and should be re-prepared under a fresh batch
id. Everything else in this record — validation, id assignment from P101, the manifest, the
`queued` stage, the refusals — is unchanged.


## Addendum, 2026-08-24 — the real export shape

This record was written before the export existed, against the schema the Phase B specification
described. The file arrived on 2026-08-23 and does not have that shape. The reconciliation in
[`docs/testing/RESULT-2026-08-23-stage0-real-data-reconciliation.md`](../testing/RESULT-2026-08-23-stage0-real-data-reconciliation.md)
walked every path of all 542 records against every `record.*` access in the script and measured
the whole of the difference; this addendum records what was changed in response. **The body above
is left untouched** — an accepted decision is not rewritten, and the gap between what it predicted
and what arrived is the most useful thing about it.

### What the export actually does

| The schema said | The export does |
| --- | --- |
| `originalId`, `rawContent`, `rawHtml`, `referenceTitle`, `originalSku`, `originalUrl`, `originalCategories` at the top level | all seven under **`sourceNotes`** |
| `referencePrice` at the top level | **`pricing.referencePrice`**, a descriptive sentence |
| `images`, with `main` a filename string and `extra[]` an array of strings | **`sourceImages`**, with `main` an **object** carrying `.file`, and **`extras[]`** an array of objects |
| `images.variantImages[]` carrying `{attribute, value, file, verified_distinct}` | **`sourceImages.variants[]`** carrying `{variantId, value, file, verifiedDistinct, …}` — **no `attribute` field at all**, and the flag spelled camelCase |
| variant options in a deduplicated top-level `attributes[]` of `{name, values[]}` | a per-variant combination list in **`variants[].attributes[]`** of `{attribute, value}`. Top-level `attributes` is `[]` in all 542 records |
| `knownStub: true` on a record whose copy is genuinely short | **the key appears nowhere in the file** |

Three of those rejected every record loudly — 0 of 542 passed. The other four did not reject
anything: they wrote a wrong value into `raw-block.json` and exited 0, and were invisible only
because the loud three rejected the record first. **Fixing the loud three alone would have turned
0 rejections into 531 silently-degraded raw blocks**, which is the reason this addendum exists at
all rather than a one-line field rename.

### Decision 1 — Stage 0 reads the export's real shape, through named accessors

Every source read now goes through a named function — `readSourceNotes`, `readSourceImages`,
`readMainImageFile`, `readExtraImageFiles`, `readVariantImageEntries`, `readRawContent`,
`readRawHtml`, `readReferencePrice`, `readVariantAttributePairs` — rather than through an inline
property chain at the point of use. That is not decoration. A property chain that reads the wrong
path returns `undefined`, and `undefined` becomes `null` in the raw block without a word; a named
accessor puts the real path in exactly one place, where a test can pin it. The four silent
mismatches all had the same shape, and this is the structural answer to that shape.

### Decision 2 — variants are derived from the combination list, not from `attributes[]`

`toVariants` collects the distinct `{attribute, value}` pairs across every entry of a product's
`variants[].attributes[]`, keyed by option name in first-appearance order, values deduplicated in
first-appearance order within their option. Nine real products carry two option names and 154
variants carry more than one attribute, so the dedup is load-bearing rather than incidental.

Top-level `attributes[]` is **not** a fallback. It is an empty array in all 542 records and is
read as correctly-empty; a *populated* one now raises a warning saying Stage 0 does not read it,
because silently ignoring a field that has data in it is the same class of fault this addendum is
correcting.

### Decision 3 — the variant-image attribute name is recovered by a real join

`sourceImages.variants[]` has a `variantId` and a `value` and no attribute name; the Draft A image
map is keyed `OptionName:Value`. `resolveVariantImageAttribute` finds the variant the image belongs
to by `variantId`, then takes the attribute whose value the image entry names. It returns `null`
when the variant is absent or when no pair on it carries that value, and `validateSourceRecord`
**refuses the record** rather than keying the map by `undefined` — which is what the old code did,
for all 50 real variant images, silently.

The reconciliation verified the join succeeds for 50/50 real cases. It is implemented as a join
regardless: verified-today is not the same as guaranteed-tomorrow, and the failure path is a
refusal with the offending `variantId` named.

### Decision 4 — `verifiedDistinct` is read camelCase, as the export spells it

Read as `verified_distinct` it was `undefined === true` for all 50 real variant images, so every
one of them would have reached the reviewer as `verifiedDistinct: false` — which the schema defines
as *not verified*. This is precisely the evidence
[ADR-056](ADR-056-image-confirmation-provenance-and-draft-similarity.md) reversed decision 5 to
preserve, and it would have arrived inverted. A missing flag still reads as **not** verified; that
part of decision 5 is unchanged.

### Decision 5 — `sourceNotes.originalMetaDescription` is carried, archival-only

**Owner-confirmed.** 331 records carry a meta description the owner wrote for the old site. It is
carried into the raw block's `sourceNotes` so the record of what the source held is complete, and
it is **read by nothing**. Extraction must not quote it, paraphrase it, seed a meta description
from it, or treat it as evidence for a material, plating or stone claim. `sourceNotes.rawContent`
remains the only field extraction reads for content.

The reason is the one ADR-018 and ADR-035 already give for the descriptions themselves: it is
marketing copy from the system whose claims this migration exists to re-examine, not source text
about the product. A meta description is the most concentrated form of that copy — a claim
compressed to 155 characters with no room for the qualification that makes it honest. Carrying it
without this restriction would let the least reliable text in the export become the seed for the
most-read text on the new site.

The restriction is stated in `scripts/prepare-migration-batch.mjs` at the point the field is
carried through, not only here, because the person who needs to read it is the one editing that
line.

### Decision 6 — the export's own `notes[]` are carried, as `sourceNotes.exportNotes`

563 QA observations from the extraction session — *"only one image available from source"* ×366,
*"no source category mapped"* ×43, *"duplicate title shared with template(s) …"* ×54, *"source
description is only N characters"* ×11 — were being dropped entirely. They are the migration's own
account of what it found, and the reviewer of a queued raw block is exactly the person who should
see it.

They are carried as **`sourceNotes.exportNotes`**, not as a top-level `notes`, because the Draft A
schema has a top-level `notes[]` of its own that extraction writes. Two arrays with the same name
and different owners in the same pipeline is a collision waiting for someone to merge them; under
`sourceNotes` they are unambiguously the source describing itself.

### Decision 7 — `--known-stub-ids` replaces the `knownStub` field the export does not have

**Owner-confirmed.** The sub-50-character stub rule stands: a record with almost no copy is a data
fault unless someone says otherwise. The export has no field for saying otherwise — `knownStub`
appears nowhere in the file — so the rule had no lever at all, and the 11 genuine stubs were
refused with no way to accept them.

The lever is now a CLI flag:

```
--known-stub-ids=odoo-817,odoo-818,odoo-819     # the ids themselves
--known-stub-ids=path/to/known-stubs.txt        # or a file holding them
```

The value is either the ids, comma- or space-separated, or the path to a file — a JSON array, or
one id per line with `#` comments. Which it is is decided by asking the filesystem whether the
value names an existing file, rather than by a prefix or an extension: eleven ids fit on a command
line, two hundred would not, and the operator should not have to remember a sigil to switch
between them. Both `odoo-817` and the bare `817` are accepted, so a list can be pasted from either
the export or `needs-attention.md`.

**This is a deliberate manual override and is documented as one.** Naming an id here is a person
taking responsibility for a record extraction will have nothing to quote from. The record is still
queued *with a warning*, its raw block still records `sourceNotes.knownStub: true`, and the
manifest still marks it `queued-with-warnings`. If the export ever grows a real `knownStub` field
it is still honoured, and this flag can go.

The alternative — lowering `KNOWN_STUB_MAX_CONTENT_LENGTH` until the 11 slipped under it — was
rejected: it would accept every future short record silently, which is the opposite of what the
rule is for.

### Decision 8 — existence is checked against what the record says, and for every image

The old check probed the hardcoded literal `"main.webp"` rather than the record's own value, and
looked at nothing but the main photograph. It agreed with the data only by coincidence — every
real `sourceImages.main.file` happens to be `main.webp` — and left 483 extras and 50 variant images
unchecked by anything except the reconciliation's own manual probe.

`validateSourceRecord` now resolves the record's actual `sourceImages.main.file`, every
`sourceImages.extras[].file` and every `sourceImages.variants[].file`, and names the specific entry
that is missing. A suggestion that points at a file nobody downloaded is now a refusal rather than
a queued record with a broken path in it.

### What this does not change

Id assignment from P101, the ordering rule, the `queued` stage, the manifest, the register append,
the double-run guards, the catalogue ceiling and the separation from extraction are all untouched.
`--dry-run` is unchanged too — it merely has tests now, which it did not before (finding M-5).

### Not fixed here, and deliberately

**I-6 — no duplicate-title or duplicate-description check.** The export flags 54 records as
sharing a title, 31 of them with byte-identical descriptions, and Stage 0's duplicate check is on
`originalId` only. ADR-056's similarity gate is the mechanism that can see this population, and its
`SIMILARITY_THRESHOLD` is still `null`. Calibrating that threshold is its own decision with its own
evidence, and guessing at one inside a field-mapping fix would be the wrong place to make it.

**M-1 — `workingId` is still derived rather than read.** `workingIdFor(originalId)` produces the
same string as the export's own `workingId` in all 542 records. It is now written into the raw
block so the two can be compared, but the directory name is still derived, so a record with no
`workingId` still resolves.

**M-4 — `extras[].sequence` is a string.** Irrelevant while array order already matches the file
numbering, which the reconciliation verified for all 483. Nothing sorts on it.
