# ADR-056: An image suggestion is confirmed like an attribute, a migrated record keeps its origin, and the similarity gate can see the batch it is scoring

- **Status:** Accepted
- **Date:** 2026-08-23
- **Prompt:** 75

## Context

The [pre-migration readiness audit](../testing/RESULT-2026-08-23-pre-migration-readiness-audit.md)
read the whole Draft A pipeline — [ADR-051](ADR-051-draft-a-content-pipeline.md) through
[ADR-055](ADR-055-category-vocabulary-and-surfacing.md) — against a fully green gate, before the
542-product Odoo export arrives. It found three problems that are the **same problem wearing three
faces**: a mechanism designed and calibrated for a hand-written 49-product catalogue, never
extended to cover data arriving in bulk from somewhere else.

| Audit finding | The mechanism | What it was built for | What breaks at 542 |
| --- | --- | --- | --- |
| BLOCKING-2 | Draft A rule A3, *"images must be empty"* | A draft written from nothing, where an attached image could only have been attached by something with no business attaching it | Stage 0 derives a suggested path per photograph off the export. Either extraction carries them and **all 542 fail A3**, or it drops them and the `verified_distinct` evidence never reaches the reviewer |
| BLOCKING-3 | `PRODUCT_KEYS`, the strict record allow-list | A catalogue whose every product was written by hand and had no origin to record | `subcategory` and four `original*` fields are validated by Stage 0, declared in the Draft A schema, and then read by nothing. 542 products ship with no link back to the listing they came from, in a repository whose `content-pipeline/` is gitignored |
| IMPORTANT-1 | `selectActiveSimilarityInputs`, *"drafts are not live copy"* | 49 published products, where "everything live" and "everything there is" were the same set | Every migrated product is `status: "draft"` until someone publishes it, so each of 542 candidates was scored against the 49 originals and **never against the other 541** — the ones whose copy came off one old site |

Fixed together because they are one shape of mistake, and because two of the three fixes touch the
same two files.

## Decision

### 1. An image suggestion carries `confirmed`, and rule A3 is about confirmation rather than absence

Every entry in `images.general` and every value in `images.variantImages` becomes an object:

```json
{ "path": "/products/P101.webp", "confirmed": false,
  "sourceFile": "2026-08-23-batch-01/odoo-1002/raw/main.webp", "role": "main" }
```

with `verifiedDistinct` in place of `role` on a variant entry. This is
[ADR-051](ADR-051-draft-a-content-pipeline.md)'s attribute pattern applied unchanged to images —
always propose, always confirm — and the two rules now read as exact mirrors of each other:

| Stage | `attributes[].confirmed` | `images.*[].confirmed` |
| --- | --- | --- |
| `validateDraftA` — rule B1 / rule **A3**, before review | must be `false` | must be `false` |
| `validatePublishReadiness` — rule D1 / rule **D4**, after review | must be `true` | must be `true` |

A draft carrying suggestions that are all `confirmed: false` now **passes** pre-review validation;
that is the expected state of a Stage-0-prepared migrated product. A draft carrying any
`confirmed: true` **fails**, for the same reason a pre-confirmed attribute fails: it is claiming a
review that did not happen.

The alternative was to relax A3 into permitting a populated image list unconditionally, which the
audit named and rejected in advance: it *"deletes the Phase 1 guarantee that no image is attached
by something with no business attaching it."* Nothing about that guarantee is given up here. What
changes is that the guarantee is now enforced on the field that means it.

`mapImagesToMedia` carries only `confirmed: true` entries into `media`, and says out loud which
ones it dropped. A suggestion the reviewer declines is deleted from the draft rather than left
unconfirmed — which is what makes "every entry confirmed" a rule a reviewer can actually satisfy.

### 2. The provenance rides inside the suggestion, reversing ADR-054 decision 5

[ADR-054](ADR-054-stage-0-migration-batch-preparation.md) put `sourceFile` and `verifiedDistinct`
in a parallel `imageSuggestionProvenance` block, *"alongside them, and deliberately not inside
them"*, and gave a reason:

> Keeping the flag beside the suggestion rather than inside it is what keeps those two questions
> apart: `images.variantImages` stays a plain string-to-string map matching the Draft A schema
> exactly, and the evidence for each entry is one field away for whoever is deciding.

**That reason is void as of decision 1** — the Draft A schema is no longer a plain string-to-string
map — and the parallel block was precisely why the evidence had nowhere to go: the Draft A schema
had no slot for it, so the one piece of hash-checked, trusted data in the whole import stopped at
the `queued` → `extracted` boundary. `imageSuggestionProvenance` is removed and its contents live
inside each suggestion.

The distinction ADR-054 was protecting survives intact, because it was never a matter of field
placement. `verifiedDistinct` answers *"do these two files differ"*, a question about bytes.
`confirmed` answers *"is this the right photograph for this variant on this shop"*, a question
about the shop. They are now adjacent fields with different names and different writers: Stage 0
writes the first and only the manual image-assignment step writes the second. A missing
`verifiedDistinct` still reads as **not** verified.

### 3. `subcategory` and `migrationProvenance` become real product fields, and provenance is a named group

```ts
subcategory?: string;
migrationProvenance?: {
  originalId: string;
  originalSku: string | null;
  originalUrl: string | null;
  originalCategories: string[];
};
```

Both are optional and absent from all 49 hand-written products.

**The four `original*` fields are one nested object rather than four top-level keys**, and that is
the load-bearing part of this decision. Provenance has to be excluded from every client-facing
shape, and a group is excluded by dropping one key while four flat fields are excluded by
remembering four. The next surface added inherits the exclusion for free; with flat fields it
would inherit three-quarters of it.

`migrationProvenance` is **server-only**, held to the same seal as `pricing.cost` and for a
comparable reason: it is not the shopper's business, and another shop's identifiers in a page a
crawler reads is worse than merely useless. `subcategory` is **not** sensitive and is deliberately
*permitted* to reach a client bundle should a surface ever want it — see decision 5, where that
distinction is stated rather than left to be inferred from the fact that it currently does not.

The audit was right that the alternative — carrying nothing — is defensible: a catalogue record
arguably should not hold another shop's identifiers. It is rejected on the audit's own grounds.
That argument was never made in an ADR, it was made when the field cost one product rather than
542, and `content-pipeline/` is gitignored, so *"which old SKU is P387?"* becomes unanswerable the
first time somebody cleans up a working directory. A field nothing renders costs a line in a JSON
file; re-reading 542 raw blocks that may no longer exist costs considerably more.

### 4. The similarity gate's population is every record, drafts included

`selectActiveSimilarityInputs` is no longer what the gate compares against. It survives, narrowed
to what its name says — the published half, for a caller who genuinely wants live copy — and
`selectSimilarityComparisonPopulation` is the gate's population: **every record in
`data/products.json` regardless of status, plus any sibling draft written earlier in the same
orchestration session that has not been saved yet.**

This is [ADR-053](ADR-053-draft-a-to-product-orchestration.md) decision 4's argument, transplanted
without modification. That decision added a second keyword index over draft records *"because the
committed map cannot see drafts"* and *"two drafts claiming one keyword is a collision that only
surfaces at publish, when it is expensive."* Every word of it is true of descriptions, and it was
never applied to them.

The `sessionDrafts` argument is the one thing keywords did not need. Within a single run several
drafts can be written before any reaches `data/products.json`, and a comparison against a sibling
that exists only in memory is the earliest this gate can ever make it.

Every comparison now records `againstPopulation`, and the report carries `comparedAgainstActive`
and `comparedAgainstDraft` separately. A 0.9 against a published product and a 0.9 against a
sibling from the same migrated batch are different findings, and the file a future calibration run
reads has to be able to tell them apart.

**`SIMILARITY_THRESHOLD` stays `null` and nothing is refused.** This decision deliberately sets no
number: the calibration that would earn one still has not happened, for the reasons
[ADR-053](ADR-053-draft-a-to-product-orchestration.md) gave and the audit's E12 restated. What is
fixed here is the *population being scored*, because that is the data the eventual calibration
reads — and getting it right now means turning the gate on stays one assignment rather than one
assignment plus a second retrofit of the comparisons that were already logged against the wrong
set.

### 5. The client-bundle seal is verified by building the site and grepping the output

A unit test asserting that `toCatalogueEntry` omits a field proves the whitelist works. It does not
prove the field is absent from what a browser receives, because a field can reach a browser through
a prerendered RSC flight payload without passing through `toCatalogueEntry` at all.

So the check is empirical, on the precedent set for `pricing.cost`: inject a probe value into
`data/products.json`, run a real production build, grep `.next/static` and every prerendered
`.html` and `.rsc` for the field name **and each of its values**, then revert. Values as well as
names, because a test that looks only for `migrationProvenance` passes while the old shop's URL
sits in the markup under some other name.

The run is recorded with its negative controls in
[RESULT-2026-08-23-image-confirmation-provenance-and-draft-similarity.md](../testing/RESULT-2026-08-23-image-confirmation-provenance-and-draft-similarity.md).
The controls are not decoration: a grep returning zero proves nothing unless the same grep returns
non-zero for something that genuinely does reach the browser.

**Stated as a choice rather than left as an observation:** `subcategory` does not currently reach a
client bundle, and it is *allowed* to. It is not sensitive. Its absence today is a consequence of
`toCatalogueEntry`'s whitelist and of no rule about this field, and a future surface that wants to
render a subcategory may add it to the entry without reopening this ADR. `migrationProvenance` may
not, ever, and the regression test names both facts so neither can be mistaken for the other.

## Consequences

**Rule A3 changed meaning, and its name changed with it.** `checkImagesAreEmpty` is now
`checkImagesAreUnconfirmed`. The rule id is still `A3`, so a stored finding from an earlier run
still resolves, but a draft that would have failed it before may now pass and vice versa.

**`imageSuggestionProvenance` no longer exists.** Any raw block written by Stage 0 before this
change carries it and carries bare-string image entries; both are now rejected. No real batch has
been prepared — the Phase B export has not arrived — so there is nothing to migrate. If a synthetic
batch is sitting in `content-pipeline/incoming/`, re-run Stage 0 against a fresh batch id.

**`validate-products.mjs` gained a validator and a counter.** `migrationProvenance` is checked for
its own key allow-list, a non-empty `originalId`, nullable-but-typed `originalSku` and
`originalUrl`, and an array of non-empty strings in `originalCategories`. The summary prints
`With provenance N (migrated, server-only)`, which is `0` today and is the number to watch when the
batch lands.

**`selectActiveSimilarityInputs` is still exported and is now the wrong function to call from the
orchestration skill.** `.claude/skills/draft-a-to-product-skills.md` step 4 says so in as many
words, because the trap is that calling it still works and still produces a plausible report.

**The similarity report file shape changed.** It gains `againstPopulation` per comparison and two
new counts. Reports written before this change lack them, which a calibration run reading a mixed
directory has to tolerate — there are none today.

**Nothing about the threshold changed, and nothing blocks.** Both gates this ADR touches remain
advisory. The keyword gate blocks and always did.

**One unaddressed audit finding stays unaddressed here, deliberately:** BLOCKING-1, the register
append that writes 542 rows outside the table. It is a different mechanism with a different fix and
belongs in its own change.
