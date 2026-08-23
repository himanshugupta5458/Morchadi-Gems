# ADR-051: The Draft A content pipeline — two intake paths, one schema, and the allow-lists that gate them

- **Status:** Accepted
- **Date:** 2026-08-22
- **Prompt:** 64

**This ADR is a design record, not a completion record.** One artefact of the design exists in
the repository — the extraction skill at
[`.claude/skills/draft-a-skills.md`](../../.claude/skills/draft-a-skills.md), with its companion
image prompt at
[`docs/pipeline-prep/fresh-listing-image-prompt.md`](../pipeline-prep/fresh-listing-image-prompt.md).
Both were written by the owner and are reproduced nowhere here; read them at those paths. Three
things the skill depends on **are not built**, and nothing in this ADR should be read as claiming
otherwise:

| Not built | What it is |
| --- | --- |
| `data/material-phrases.json` | The owner-curated metal / plating / coating allow-list |
| `data/stone-terms.json` | The owner-curated stone and gem trade-name allow-list |
| `scripts/validate-draft-a.mjs` | The mechanical validator the skill specifies |

**One row of that table is out of date and the body below is not rewritten to match. The
validator now exists** — see the [addendum](#addendum-2026-08-23--the-validator-exists-and-the-allow-list-gate-does-not) at the
end of this record, which also states what the skill's revision did to the two allow-list rows.
Everything between here and that addendum is the design as it was accepted on 2026-08-22.

A fourth item is not merely unbuilt but *undecided*: the similarity threshold and comparison
method for phase three's duplicate-content monitoring have not been calibrated, and this ADR
does not calibrate them.

## Context

[ADR-035](ADR-035-catalogue-content-pass.md) put honesty rules on `data/products.json` and
[ADR-018](ADR-018-honest-product-description.md) set the vocabulary they enforce: the catalogue
may claim anti-tarnish, it may not claim hallmarked, and it may not claim a metal or a stone the
owner has not stated. Both were written for a catalogue of 49 products the owner could read
end to end.

Prompt 63 changed the scale of that problem. The extraction recorded in
[`docs/pipeline-prep/`](../pipeline-prep/README.md) scanned 492 product rows out of the owner's
`Latest.xlsx` export and pulled **531 distinct material, plating and stone phrases** out of them
by exact string equality. Its README says the thing that matters here: a candidate list is not an
allow-list, and `data/material-phrases.json` is built by the owner *from* those files, never
generated from them.

That leaves two problems the honesty ADRs do not answer.

**The first is volume.** Reading 492 rows and deciding each one by hand is the work; there is no
version of this where the owner does not make every material and stone call personally. What can
be mechanised is everything *around* that call — transcription, boilerplate stripping, brand
mismatch flagging, category assignment, price quarantining — so the owner's attention lands only
where a judgement is genuinely required.

**The second is a new intake path.** Migrated listings arrive as text, and text can be quoted. A
*fresh* listing arrives as photographs plus whatever the owner types alongside them, and a
photograph asserts nothing. A model looking at a picture of a yellow ring can say "gold" with
total fluency and no source whatsoever. `docs/pipeline-prep/source-data-notes.md` already records
what happens when unsourced claims accumulate: 47 rows carrying a karat number as a *plating*
value, 14 rows claiming `skin-safe` against zero rows claiming `nickel-free`. Those came from a
human writing marketing copy. A model describing a photograph would produce the same class of
claim faster and more confidently.

So the pipeline needs a rule that survives contact with a generative step, and "be careful" is
not that rule.

## Decision

### 1. Two intake paths converge on one Draft A schema

There is exactly one structured intermediate — the Draft A object whose schema is stated in the
skill — and two ways to reach it.

| Path | `sourceType` | Input | Route to Draft A |
| --- | --- | --- | --- |
| Migrated | `"migrated"` | A listing's original copy from the `Latest.xlsx` export | Straight into the skill |
| Fresh | `"fresh"` | Product photographs plus the owner's own notes | Through the image prompt first, whose output text is then the skill's input |

The convergence is the point. Downstream — the validator, the product-creation phase, and every
honesty rule — sees one shape and does not branch on where a record came from. The paths differ
only in what counts as a legal *source* for a claim, and that difference is carried inside the
record by `sourceType` and by each attribute's `source.origin`, not by a fork in the code.

### 2. Two owner-curated allow-lists, and no third source of material truth

A material or stone claim may enter a Draft A object from exactly two files:

- **`data/material-phrases.json`** — metal, plating and coating phrases
- **`data/stone-terms.json`** — stone and gem identity, including the trade-name → technical-term
  mapping (`American Diamond` → `cubic zirconia`) that `docs/pipeline-prep/source-data-notes.md`
  found on 51 of the 58 rows saying `diamond`

**Neither file exists.** Creating them is owner work and it is the gate on the whole pipeline: the
skill cannot be run for real until both exist, because with no allow-list every candidate phrase
correctly resolves to *no match* and every material attribute correctly comes back unset.

Three properties of the matching rule are load-bearing, and all three are stated in the skill
rather than restated here: the rule binds to what a value **claims** rather than to the label it
was filed under; a candidate matches only if it equals an entry **in its entirety**, so
`18K gold-plated stainless steel` does not match an entry of `gold-plated`; and a non-match
produces an unset attribute plus a note quoting the candidate verbatim, which is how the
allow-lists grow — by the owner reading those notes, not by the pipeline widening its own gate.

Model knowledge is never a third list. A trade name the owner has not curated is a note, not a
value.

### 3. On the fresh path, material and stone identity come only from a delimited owner-notes block

**Never inferred from an image. Never taken from generated prose. Only from
`<owner-stated-facts>`.**

The image prompt forbids the descriptive pass from naming any metal or stone at all — it must
write `gold-toned`, not `gold` — at every mention, with no already-established-context exception.
That is the first defence and it is not the one this decision rests on, because a forbidden-words
list is a request and requests leak.

The rule that holds is downstream and mechanical: on `sourceType: "fresh"`, **the descriptive
paragraph is not scanned for allow-list matches at all.** Only the content inside the
`<owner-stated-facts>` delimiters is a legal source. A material phrase that leaks into the prose
is therefore not a risk to be caught — it is text nothing ever reads for that purpose. The
failure mode being prevented has a name worth writing down: an accidental phrase in generated
copy being laundered into a "verified, sourced" claim, indistinguishable in the output from
something the owner actually said.

This is the reason the two artefacts are a pair. The image prompt makes the leak unlikely; the
skill makes the leak harmless.

### 4. `productId` is sequential, assigned once, and permanently reserved

[ADR-016](ADR-016-real-product-import.md) made the owner's P-code the product id. This extends
that scheme forward rather than replacing it: the next Draft A candidate takes the next unused
number, which today is **P050** — `data/products.json` currently holds P001 through P049.

Two properties:

- **Assigned once, at Draft A creation** — by pipeline code, never by the model. The skill's own
  rule 14 puts `productId` and `rawContent` outside what the model may populate, on the grounds
  that a model asked to round-trip long source text will silently tidy or truncate it, which
  would quietly break the provenance trail that `source.quotedPhrase` depends on.
- **Permanently reserved** — if a candidate is rejected in review, its number dies with it and is
  never reused by a later product. Gaps in the sequence are correct and expected.

The reservation rule is deliberate and it costs nothing. Ids appear in the owner's invoices, in
photograph filenames, and — since [ADR-006](ADR-006-product-image-convention.md) — in the derived
image path `/products/P050.webp`. Reusing a number after a rejection means a stale photograph, a
stale invoice line or a stale message now silently refers to a *different* product. An id with no
product behind it is a harmless hole; an id with two products behind it is a defect that reads as
correct.

### 5. The pipeline is three phases, and only the first is designed

| Phase | What it does | State |
| --- | --- | --- |
| **1 — Draft A generation** | Raw input → one validated Draft A object per source block, never skipped, never merged. Prices quarantined to `pricing.referencePrice` as a descriptive string; `pricing.price` and `pricing.mrp` always `null`. Images empty. Boilerplate, review markup and brand mismatches stripped into `flaggedContent` rather than deleted | Skill written; allow-lists and validator not built |
| **2 — Product creation from Draft A** | Owner review of each draft, then promotion into `data/products.json` — real prices, real photographs, the honesty rules of [ADR-018](ADR-018-honest-product-description.md) and [ADR-035](ADR-035-catalogue-content-pass.md), and the SEO metadata of [ADR-036](ADR-036-product-seo-metadata-pass.md) | Not designed |
| **3 — Duplicate-content monitoring** | Ongoing, over the *active* catalogue rather than the drafts: detect near-duplicate descriptions and metadata across live products as the catalogue grows | Not designed; threshold and comparison method **not calibrated** |

Phase 1 ends at a draft and goes no further. It writes no price, attaches no image, and touches
`data/products.json` not at all — the catalogue-as-code rule of
[ADR-001](ADR-001-tech-stack.md) is unchanged, and a price still becomes real only in a commit
a human wrote.

Phase 3 is separated from phases 1 and 2 because it runs on a different clock. Generation and
creation are per-product events; duplicate-content risk is a property of the catalogue *as a
whole* and only grows as products are added, which means it is a recurring check against live
data rather than a step in an intake run. Calibrating it against 49 products would produce a
threshold tuned to the wrong catalogue.

### 6. A filename drift, recorded rather than repaired

The image prompt refers to the skill as `.claude/skills/draft-a-skill.md`. The file on disk is
`.claude/skills/draft-a-skills.md`, plural — matching its siblings `product-skills.md` and
`meta-skills.md`. Both files are owner-authored and neither is edited by this prompt. The
mismatch is noted here so a reader following the reference does not conclude a file is missing;
whichever way the owner resolves it, no code reads either path today.

## Alternatives considered

**Let the model identify materials and stones from its own knowledge, with a human spot-check.**
Rejected. The failure is not that the model is often wrong — it is that a fluent wrong answer and
a right answer are typographically identical, so spot-checking 492 rows means re-deciding 492
rows, and the pipeline has saved nothing while adding a plausible-looking claim to every one of
them. The allow-list inverts this: the model's uncertainty surfaces as an unset field and a
quoted note, which is cheap to review precisely because it is visibly incomplete.

**Fuzzy or normalised matching against the allow-lists.** Rejected, and this is why exact
whole-phrase matching survives the awkward cases. `docs/pipeline-prep/README.md` already holds
the line for the candidate extraction — `Gold-Plated`, `Gold-plated`, `gold-plated` and
`gold plating` are four rows and stay four rows. Loosening it downstream would re-import the
judgement the allow-list exists to remove: `18K gold-plated stainless steel` fuzzy-matching
`gold-plated` silently drops both the karat claim and the base metal, and the row that produced
`Stainless Steel Gold Plated Stainless Steel` shows the source is noisy enough that a
similarity score would be guessing. No match is a question for the owner. A fuzzy match is an
answer nobody gave.

**A single intake path — convert fresh photographs to text and treat it as migrated text.**
Rejected, because the two paths differ in exactly one way that matters: migrated text was written
by a human about a real object, and image-derived text was written by a model about pixels. Erase
that and `source.origin` becomes decorative, `<owner-stated-facts>` becomes advisory, and the
laundering the fresh-path rule exists to prevent happens by default. One schema, two paths, one
discriminating field is the smallest structure that keeps the distinction alive downstream.

**Recycle rejected ids to keep the sequence dense.** Rejected — see decision 4. A dense sequence
is worth nothing and a reused id is worth less than nothing.

**Build the allow-lists in this prompt from the 531 extracted candidates.** Rejected, and it is
the same call prompt 63 already made: which of `Gold-Plated`, `18K gold-plated stainless steel`
and `high-quality alloy` is a claim this shop is willing to make is a business and honesty
decision, not a text-processing one. Generating the allow-list from the candidate list would make
every phrase in the export true by construction, including the 47 karat-on-plating rows and the
14 `skin-safe` rows the extraction flagged specifically because they need a human answer.

## Consequences

**What this makes easy.** The owner's judgement is concentrated in two JSON files instead of
spread across 492 listings, and it is reusable — curate a phrase once and every product using it
is decided. Provenance is checkable rather than trusted: the validator's rule that every
`source.quotedPhrase` must appear verbatim in `sourceNotes.rawContent` means a claim can be
traced to its origin text mechanically. And because prices are quarantined to a descriptive
string and images stay empty, phase 1 cannot damage the catalogue even if it runs badly.

**What this makes hard.** Nothing can run until the owner writes both allow-lists — the pipeline
is fully blocked on external judgement by design, and that is the intended shape, not an
oversight. Early runs will be note-heavy, because a small allow-list means most phrases miss;
the notes are the mechanism by which the lists grow, so the first passes are as much list-building
as extraction. Exact whole-phrase matching will also reject phrases a human would call obvious
matches, and each rejection costs a note and an owner decision.

**What is deferred.** All three build items in the table at the top of this record, plus the whole
of phases 2 and 3. Phase 3 in particular needs a decision this ADR does not make: what counts as
"too similar" between two live product descriptions, measured how.

**What would force a revisit.** The allow-lists turning out to need structure the skill's flat
whole-phrase match cannot express — a hierarchy, or a phrase whose meaning depends on the
category it appears in. Phase 3's calibration finding that near-duplicate detection needs a
signal Draft A does not carry. A second catalogue source arriving with a shape neither intake
path fits. Or the fixed lists the skill validates against changing: the ten categories of
[ADR-020](ADR-020-two-tier-catalogue-ia.md) or the two collection slugs `gifting` and
`anti-tarnish`, both of which the skill hard-codes and both of which live in
`types/product.ts` today.


## Addendum, 2026-08-23 — the validator exists, and the allow-list gate does not

*Prompt 65. This record's body above is unchanged; ADRs are immutable once accepted, and this
section states only what has moved since. Two things have.*

### `scripts/validate-draft-a.mjs` is built

The third row of the "not built" table at the top of this record is now wrong, and it is the
only row of it this addendum retires. The validator exists, with 100 tests in
`lib/validate-draft-a.test.ts` and a `node scripts/validate-draft-a.mjs <directory | glob>`
entry point that exits non-zero on a hard failure.

| Item | Status as of this addendum |
| --- | --- |
| `data/material-phrases.json` | **No longer a dependency** — see below. Not built, and under the current skill nothing is waiting for it |
| `data/stone-terms.json` | **Still not built.** Owner work. Its role has narrowed from a gate to a helper, but it does not exist |
| `scripts/validate-draft-a.mjs` | **Built.** This addendum's subject |
| Phase 3 similarity threshold and comparison method | **Still undecided.** No calibration has happened; the "not merely unbuilt but *undecided*" sentence above stands in full |

### What the validator checks, and the one thing it deliberately does not

`.claude/skills/draft-a-skills.md` has since been revised by the owner to an **"always propose,
always confirm"** design, and its own "Core principle (changed from earlier drafts)" section
states the change: *there is no allow-list gate for material or treatment claims anymore.* Every
product's Draft A goes through owner review regardless, so rather than pre-approving phrases the
skill always proposes its best candidate value attached to the exact source quote it came from,
and the owner confirms or edits each one. `data/stone-terms.json` survives in that design as a
helper that makes a suggested value faster to confirm, not as a gate; a phrase absent from it
still produces a candidate, marked `stoneSource: "unverified-guess"`.

That removes the check decision 2 of this record would have asked a validator to perform. **The
validator therefore checks no phrase against any allow-list, and there is no allow-list for it to
check against.** It reads neither `data/material-phrases.json` nor `data/stone-terms.json`. Whether
`18K gold-plated stainless steel` is a claim this shop will make is an owner decision taken in
review, and a script answering it would be re-importing the judgement review exists to hold.

What is left is what a machine can decide, in two categories:

- **Structure** — `category` is null or one of the ten fixed slugs; `pricing.price` and
  `pricing.mrp` are both null; `images.general` and `images.variantImages` are both empty;
  `personalized` is exactly `true`, `false` or `null`; every `flaggedContent[].type` is one of the
  three fixed enum values.
- **Provenance** — every attribute carries `confirmed: false`; a non-null `source` carries
  `origin` and `quotedPhrase` **together or not at all**; and every `quotedPhrase` appears
  verbatim inside `sourceNotes.rawContent` after whitespace normalisation on both sides.

That last check is the one worth naming, because it is the only mechanical defence against a
failure mode this record's Consequences section already anticipated in one sentence
("provenance is checkable rather than trusted"). A model can invent a fluent quote as easily as a
fluent claim, and an invented quote is the worse of the two: a wrong claim with a real quote is
visibly wrong to a reviewer reading the quote, whereas a wrong claim with an invented quote reads
as an audit trail. Whitespace is normalised because a phrase lifted out of a marketplace export
routinely differs from its source by exactly that; nothing else is — no case folding, no
punctuation stripping — since a looser comparison would begin accepting the paraphrases the check
exists to catch.

One condition is a **warning** rather than a failure: `stoneSource: "known-trade-term"` with no
`displayTerm`. A trade-term match implies there was a trade name to record, so the absence
suggests a lookup bug worth a look — but the candidate value can still be right, and the owner
confirms it either way.

### Two checks, at two moments, expecting opposite things

The validator exports two functions rather than one, and only the first is wired to the CLI.

| Field | `validateDraftA` — Parts A/B, pre-review | `validatePublishReadiness` — Part D, post-review |
| --- | --- | --- |
| `attributes[].confirmed` | must be `false` | must be `true` |
| `pricing.price` | must be `null` | must be a positive number |
| `images.general` | must be empty | must hold at least one entry |
| `category` | `null` is legal | must be non-null and a fixed slug |
| `personalized` | `null` is legal | must be resolved to `true` or `false` |

They are not stricter and looser versions of each other. The first asks *did the extraction skill
produce well-formed output*, and runs before any human has looked at the object — which is why
`confirmed: true` is a hard failure there, since it claims a review that did not happen. The
second asks *has review happened and is this ready to become a product*, and runs after owner
review and after the separate manual image-assignment step. Pricing and image assignment happen
*between* the two, which is why a value that fails the first is required by the second.

`validatePublishReadiness` is exported but not called by the CLI, on purpose: the Phase 2 pipeline
that would call it is still not designed (decision 5 above), and running it over freshly extracted
drafts would fail every one of them by design.

### What has not changed

Nothing in this addendum touches decisions 1, 3, 4, 5 or 6, and nothing touches
`data/products.json`, pricing or the catalogue-as-code rule of
[ADR-001](ADR-001-tech-stack.md). The pipeline still cannot be run for real: `data/stone-terms.json`
does not exist, and while its absence no longer blocks the skill the way an allow-list gate would
have — every stone candidate now falls back to `stoneSource: "unverified-guess"` rather than to
nothing — a first real run has not happened, and no Draft A object exists in this repository. The
validator's tests are synthetic for exactly that reason.


## Addendum, 2026-08-23 — rule A3 is about confirmation, not absence

[ADR-056](ADR-056-image-confirmation-provenance-and-draft-similarity.md) changed what rule A3
checks, and this record's Phase 1 rule that *"images must be empty"* no longer describes the
validator.

The rule was written for a draft composed from nothing, where an attached image could only have
been attached by something with no business attaching it. Stage 0
([ADR-054](ADR-054-stage-0-migration-batch-preparation.md)) then began deriving a suggested path
per photograph off a real export, and an empty-only rule would have failed all 542 migrated drafts
at the `queued` → `extracted` boundary.

So an image suggestion now carries `confirmed`, exactly as an attribute does, and A3 checks that
flag rather than the length of the list: a suggestion may be **carried** and may never arrive
already **confirmed**. The Phase 1 guarantee this record was protecting is unchanged — it is now
enforced on the field that means it, and the rule reads as the exact mirror of B1 that it always
should have been. `validatePublishReadiness` requires every image `confirmed: true`, mirroring D1.

Nothing else in this record changes. Decisions 1 through 6 stand, and the two-check design of the
first addendum stands with them.
