# ADR-053: Phase 2 — the Draft A to product orchestration, its attribute mapping, and an advisory-only similarity gate

- **Status:** Accepted
- **Date:** 2026-08-23
- **Prompt:** 69

## Context

[ADR-051](ADR-051-draft-a-content-pipeline.md) designed the Draft A pipeline and stopped at the
structured intermediate. Its decision 5 named what did not exist: *"the Phase 2 pipeline that
would call it — owner review and promotion into `data/products.json` — is not designed yet."*
Three artefacts have landed since and each one ends at the same edge:

| Exists | Ends where |
| --- | --- |
| `.claude/skills/draft-a-skills.md` | Produces a Draft A object with every attribute `confirmed: false` |
| `scripts/validate-draft-a.mjs` (prompt 65) | `validatePublishReadiness` is written and deliberately **not** wired to the CLI, because nothing calls it |
| `content-pipeline/` and its two registers (prompt 67) | `awaiting-publish` is a stage whose next step "has no script yet" |
| `data/keyword-map.json` and `lib/keyword-collision-check.ts` (prompt 68) | Answers a collision question for a keyword nothing yet generates |
| `lib/content-similarity.ts` (the engine) | Scores any pair of descriptions and gates nothing |

Everything needed to turn a confirmed draft into a catalogue record exists. Nothing connects
them, and the connection is where the interesting decisions are — which gates run, in what
order, what refuses versus what merely reports, and how Draft A's deliberately loose shape
becomes the catalogue's deliberately strict one.

Two constraints shape all of it.

**The catalogue is code.** [ADR-001](ADR-001-tech-stack.md)'s surviving row says a price changes
when someone ships a commit. Phase 2 therefore cannot be a tool that publishes; it can only be a
tool that *prepares* something a person then commits. [ADR-052](ADR-052-product-status-field.md)
gave the record the state that makes this expressible: a record can exist in
`data/products.json`, be validated like any other, and reach no public surface.

**The owner has already decided everything that matters.** By the time Phase 2 runs, every
material claim, the price and the photographs have been settled by hand. A Phase 2 that re-opens
any of those decisions is a Phase 2 that undoes the review it depends on. Its job is
transcription and gating, not judgement.

## Decision

### 1. One skill, six steps, and every gate refuses rather than repairs

`.claude/skills/draft-a-to-product-skills.md` runs: publish readiness → name and description →
SEO metadata and the keyword gate → similarity → schema mapping → write and gate.

A failed gate stops the run and reports. The skill never confirms an attribute, resolves a
`personalized: null`, invents a price, or renames a keyword to get past a check. This is the
same rule ADR-051 decision 2 applied to the allow-lists — *the lists grow by the owner reading
the notes, not by the pipeline widening its own gate* — applied to the gates themselves.

The two copy skills are **called, not restated**. `product-skills.md` and `meta-skills.md` are
the owner's files, revised by the owner, and Phase 2 duplicating a rule from either would create
a second copy that drifts. The orchestration skill states only what changes when their source of
truth is a Draft A object rather than a `data/products.json` record, as a substitution table.

### 2. The attribute mapping is a stated synonym table, not a similarity match

Draft A's `attributes` is an open array of `{label, value}` written in whatever words the source
used. `specs` is a `Record<string, string>` with lower-case keys that `lib/specs.ts` orders and
labels. `lib/draft-a-to-product.ts` maps between them by label, through the table reproduced in
the skill and implemented as `SPEC_LABEL_ALIASES`.

**Why a stated table and not a fuzzy match.** ADR-051 made this call once already, for the
material allow-lists: a fuzzy match is an answer nobody gave.
`lib/keyword-collision-check.ts` made it again, which is why its loose normalisation is only ever
advisory. A label the table does not know keeps its own key and raises an advisory — `specs` is
open-ended by design (ADR-027) and `lib/specs.ts` renders an unknown key by capitalising its
first letter, so a watch's `movement` needs no code change and no guess.

Seven rules are load-bearing:

| Rule | Why |
| --- | --- |
| The value written is `attribute.value`, never `displayTerm` | `displayTerm` holds the trade name the source used. `specs.stone` reads `Cubic zirconia`, never `American Diamond` — a record's honesty is about what it claims (ADR-018, ADR-035) |
| Two attributes resolving to one key is a **hard error**, not a merge | `Material: stainless steel` plus `Plating: 18K gold` is a maximal phrase that got split, which Draft A rule 2 forbids. The fix belongs in the draft; deciding here which one survives would silently discard a confirmed claim |
| An unconfirmed attribute is a hard error even though step 1 checked | The mapper is callable on its own and does not assume its caller ran the gate |
| A blank label or value is a hard error | An unset candidate is not a spec |
| Values are sentence-cased and nothing more | `cat's-eye`, `CZ` and `18K` survive a transformation that would otherwise re-case a claim somebody checked by hand |
| At least one spec must result | A record with no specs says nothing about the piece |
| `stoneSource: "unverified-guess"` is an advisory, never a refusal | Confirmation is what clears a candidate. The advisory records that this one never had a reference list behind it |

`images.general` → `media.images` and `images.variantImages` → `media.variantImages` are a
rename: both already use the `"OptionName:value"` key format (ADR-050). The one check added is
that every variant key names an option the product declares and a value it offers — the unified
gallery strip renders every mapped photograph, so an unreachable key would put a thumbnail on the
page that no swatch selects back.

`variants` → `options` carries `optionName`, `values` and a `default` of `values[0]`. The control
`type` **is not derived from the number of values.** ADR-027 made it catalogue data on the
grounds that four locket shapes are a set to compare and four ribbon colours are a set to look at;
a mapper that guessed from a count would be re-deciding that per product. It is supplied by the
caller, and its absence is a refusal.

### 3. The record is always written as a draft

`buildProductFromDraft` sets `status: "draft"` unconditionally, including when the Draft A object
claims otherwise. Publication is `scripts/publish-product.mjs`, run by a person who has read the
record. A step that both writes a record and switches it on has no review point in it, and
ADR-052 exists to make that review point representable.

### 4. The keyword gate reads two indexes, because the committed map cannot see drafts

`data/keyword-map.json` indexes published products only, deliberately: an unpublished record is
not competing for a search result, so letting it reserve a keyword would block a real product on
behalf of one nobody can reach.

That correct exclusion opens a gap Phase 2 creates. Phase 2 writes drafts, so two drafts can
claim one primary keyword, and the collision surfaces at *publish* — after both descriptions are
written, when the fix is expensive. `checkCandidatePrimaryKeyword` therefore runs the same
`checkPrimaryKeywordCollision` twice: once against the committed map, and once against an index
built from the `status: "draft"` records in `data/products.json`. A hard finding in either
refuses. `scripts/publish-product.mjs` re-checks at publish, as the backstop.

**The map is still never hand-edited.** It is derived, `validate-products.mjs` rebuilds it every
gate run and fails on a mismatch, and the skill regenerates it with `npm run
backfill:keyword-map` — expecting no change, because a draft contributes nothing. Confirming
that is the point of running it.

### 5. The similarity gate is advisory by default, and the blocking path ships anyway

`SIMILARITY_THRESHOLD` in `lib/content-similarity.ts` is `number | null` and is `null`.

- **While it is `null`:** `evaluateSimilarityGate` computes all three of the engine's measures —
  raw, normalised, opening-sentence — against every **active** product, writes the whole result
  to `content-pipeline/drafts/{productId}-similarity.json`, and sets `blocked: false` on every
  run including a verbatim copy of a live description.
- **When it is a number:** a comparison whose peak of the three sits **strictly above** it lands
  in `report.exceeded` and sets `blocked: true`. Equal to the threshold passes, so a threshold of
  `1` reads as "refuse a verbatim copy" rather than "refuse everything".

The blocking logic is implemented and tested now, against a threshold passed explicitly. Turning
the gate on is the one assignment and nothing else — no new code path, no new call site, no
change to the skill.

**The peak of the three, not the raw score alone.** The three measures answer different
questions: raw catches a paste, normalised catches a template with the nouns swapped, opening
catches forty descriptions that all start the same way. A gate reading only one of them would be
blind to the other two failures, which are the ones a 500-product migration actually produces.

#### The threshold is null, and a number requires a calibration run that has not happened

`docs/pipeline-prep/similarity-calibration-report.md` measured all 1176 pairs across the 49
products in this repository and said, correctly, that it sets no threshold.

A number fitted to those 49 would be a number about the wrong catalogue. They are the survivors
of a hand-written content pass — descriptions written one at a time, against batch-discipline
rules, by someone who read the previous ones. The population this gate will police is several
hundred migrated listings whose copy came off one old site, plus fresh listings generated in
batches. Those distributions are not the same, and a threshold set against the tighter one blocks
honest copy on the looser one.

**Setting a real threshold requires calibrating against the owner's actual final catalogue, not
the 49 test products**, and it is a separate decision that will need its own record. Until then a
wrong number that blocks is worse than no number that reports, which is why the default is `null`
rather than a cautious guess.

### 6. `scripts/publish-product.mjs` does three things at once, and none of them alone

1. `status` flips `draft` → `active`, after `validatePublishReadiness` is re-run over the draft
   file — it passed once, but the file is hand-edited between the two points and publish is
   irreversible.
2. `data/keyword-map.json` is regenerated. This is not a convenience: the map indexes published
   products, so activating a record makes the committed map stale, and a stale map is a **hard
   failure** in `validate-products.mjs`. Without this step, publishing breaks the gate on a
   change publishing itself made.
3. The draft moves to `content-pipeline/completed/`, so the provenance behind a live product
   survives.

Every check runs before any write, and the file move is last because it is the only step that
cannot be re-run. Publishing a product that is already active is refused — the difference between
"this did nothing" and "this re-published something" is a draft moved twice and a register row
written twice.

**It does not touch the two registers under `docs/pipeline-prep/`.** They say in their own headers
that nothing generates or reads them; a script editing them would make them a derived artefact
that nothing derives, which is the drift ADR-036 rejected. The CLI prints the exact row instead
and names the two files.

## Alternatives considered

**Publish directly, with no `draft` state.** Rejected. It removes the only point at which a human
reads a generated record before it is live, and ADR-052 built the state specifically so that
point could exist.

**Guess the option control type from the number of values.** Rejected — it re-decides per product
what ADR-027 decided once, and it would be wrong on the first four-value colour swatch.

**Merge two attributes that map to one spec key.** Rejected. Joining `stainless steel` and
`18K gold` into one string invents a phrase nobody confirmed; picking one discards a confirmed
claim silently. Refusing sends it back to the draft, where the maximal-phrase rule already says
what the right shape is.

**Pick a cautious similarity threshold now — 0.6, say, from the calibration report's p99.**
Rejected, and this is the alternative that was closest to being taken. A number chosen for its
plausibility rather than measured against the population it will police is exactly the kind of
answer-nobody-gave that ADR-051 rules out elsewhere, and it would arrive with the authority of a
constant. Shipping `null` makes the absence visible in the report every run: *"threshold null,
nothing blocks."*

**Make secondary-keyword overlap or a near-match blocking.** Rejected, unchanged from ADR-036 and
prompt 68's finding: nine secondary keywords are already shared across fifteen live products
because two rings genuinely are both adjustable.

**Let the skill write the keyword map directly.** Rejected. The map is derived and gate-verified;
a second writer is the drift ADR-036 warned about. Regenerating with the committed script is the
only legal way to change it.

**Hold Phase 2 entirely in the skill markdown, with no `lib/` module.** Rejected. The attribute
mapping is the part most likely to be wrong and the part a reviewer most needs to be able to
check; prose cannot be tested, and 36 cases now cover the mapping alone.

## Consequences

**Easier.** A confirmed draft becomes a reviewable catalogue record by running one skill, and the
record cannot reach a shopper until a person runs a second command. Every gate has a message that
names the file and the fix. Turning the similarity gate on later is one assignment.

**Harder.** Phase 2 now has real dependencies on `products.json`'s shape: five mapping rules and
the field-by-field table would all need revisiting if the record shape changed again, as ADR-027
changed it once. The synonym table will need entries as real drafts arrive with labels nobody
anticipated — that is expected, and the unrecognised-label advisory is how those get noticed
rather than silently mis-filed.

**What would force a revisit.** A calibration run against the real migrated catalogue producing a
threshold — that is a new ADR and a one-line change here. A Draft A schema revision by the owner,
which the mapper reads field by field. Or a category of product whose specs do not fit
`Record<string, string>` at all, which would be a change to ADR-027 first and to this second.

**Still not built, and named so it is not mistaken for done.** No Draft A object has ever been
created in this repository; every test here runs on synthetic fixtures. `data/stone-terms.json`
still does not exist. The mechanism is complete and has never been run against real product data.

## Addendum, 2026-08-23 — one catalogue count, and synthetic ids stay out of the real range

The end-to-end dry run recorded in
[`RESULT-2026-08-23-content-pipeline-e2e.md`](../testing/RESULT-2026-08-23-content-pipeline-e2e.md)
took a synthetic product through every stage of this pipeline. The pipeline's own logic held at all
twelve steps. What did not hold was the scaffolding around it: appending the record — while it was
still a **draft** — turned the gate red, and getting back to green took nine hand-edits across
eight files that nothing in this ADR, in the skill, or in `publish-product.mjs` mentions. Two fixes
follow, and they pull in opposite directions on purpose.

### The count is asserted in exactly one place now, and it stays hardcoded there

`EXPECTED_PRODUCT_COUNT` in `scripts/validate-products.mjs` is a deliberate tripwire and is
**unchanged in kind**: still exact rather than a floor, still counting drafts, still requiring a
person to change it on purpose. ADR-052 explains why it counts every record in the file — it is a
check on the file, not on a surface, and a record appearing or vanishing unintentionally is exactly
what it exists to catch. Making it derive itself from the file would have turned it into
`catalogue.length === catalogue.length` and deleted the protection.

What was wrong was that seven test files had each grown their own copy of the same number:

| File | Was | Now |
| --- | --- | --- |
| `lib/product-schema.test.ts` | `const CATALOGUE_SIZE = 49` | `catalogue.length`, and the single-image count derives from the multi-image set rather than from `SIZE - 1` |
| `lib/product-seo.test.ts` | `toHaveLength(49)` | a non-empty guard; the per-product loop was always the real assertion |
| `lib/structured-data.test.ts` | `toHaveLength(49)` | a non-empty guard |
| `lib/content-similarity.test.ts` | `toHaveLength(49)` | a non-empty guard |
| `lib/sitemap.test.ts` | `toHaveLength(49)` twice | a non-empty guard, then `toHaveLength(products.length)` — "one entry each" was the invariant all along |
| `lib/keyword-collision-check.test.ts` | `toBe(publishedProducts.length)` **and** `toBe(49)` | the derived assertion alone; the literal was pure duplication of the line above it |
| `lib/product-copy.test.ts` | already derived | title only, which named a number the assertion did not |

None of these was testing catalogue size. Each was iterating the catalogue and needed a guard
against an empty array making a `for` loop pass vacuously. A non-empty guard does that job without
claiming to know how many pieces the owner stocks.

Duplicating the tripwire eight times bought no protection the one copy did not already give, and
charged an eight-file edit for every product added. One tripwire, seven derived checks. The
validator's failure message now names the single line to change, and says so differently depending
on whether a record appeared or went missing, because those are opposite problems.

### Synthetic product ids live in the P9xx range

`lib/content-similarity-gate.test.ts` used `P050` for its "candidate not yet in the catalogue"
fixture — the exact id this pipeline assigns next. That file scores its candidates against the
**real** `data/products.json`, and `compareAgainstCatalogue` filters out any entry sharing the
candidate's id. A real `P050` therefore shrank the comparison population by one silently; the test
failed on an arithmetic mismatch rather than on anything that named the collision.

It now uses a `SYNTHETIC_ID` constant set to `P900`, matching the convention
`lib/product-status.test.ts` already followed. `lib/draft-a-to-product.test.ts` and
`lib/publish-product.test.ts` were moved off `P050` and `P099` too. Those two are hermetic — they
build in-memory catalogues or write into a temporary repository root, and never read the real file
— so their ids could not collide. They were changed anyway, because a reader cannot tell a
placeholder from a real reference when the placeholder is picked from the real range, and because
the next person to wire one of them to the live catalogue should not have to notice.

**The rule, stated so it does not have to be rediscovered:** a product id that stands for a
fixture, in any test, is `P9xx`. `P001`–`P0xx` in a test means the real catalogue record of that
name.

### What this does not fix

Adding a product still requires bumping `EXPECTED_PRODUCT_COUNT`, and that is intended. The
difference is that it is now one line rather than eight, the failure message says which line and
what to set it to, and the skill's step 6 says so before the gate is ever run.
