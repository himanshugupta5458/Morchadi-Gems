# ADR-074: Publishing carries the photograph, and the gate checks which one it carried

- **Status:** Accepted
- **Date:** 2026-09-01
- **Prompt:** 118
- **Narrows:** [ADR-006](ADR-006-product-image-convention.md) — the id-keyed file drop is
  unchanged; what changes is that a migrated product's drop is performed by the publish step
  rather than by hand
- **Closes:** finding D4 of
  [the 2026-08-24 post-pilot audit](../testing/RESULT-2026-08-24-pipeline-audit-post-pilot.md),
  which asked for this script by name and was not built at the time

## Context

Between a confirmed Draft A image and a live product there was one move that nothing performed.

The reviewer confirms a photograph, which sets `confirmed: true` on an entry carrying both
halves of the move: `sourceFile` names the staged file and `path` names where the record says it
belongs. `mapImagesToMedia` copies that `path` into `media` verbatim, `publish-product.mjs`
flips the record to `active`, and `validate-products.mjs` checks that a file exists at that
path. Nothing copied the photograph there. The step existed only as a hand-typed `cp`,
described in exactly one sentence of one document — `docs/pipeline-prep/README.md` step 7, whose
own words were "**no script performs the copy**".

The 2026-08-24 audit found this and said what it would cost:

> a `stage-images PNNN` helper that performs the manual `cp` of confirmed `sourceFile`s to their
> `path`s — 531 products ≈ 1,062 hand-copies otherwise, each a chance for a
> wrong-file-under-right-name mistake that **no gate can catch** (the validator checks
> existence, not content).

It was flagged as warranted and not built. What happened next is the whole argument for this
ADR, and it is worse than a wrong file under a right name.

**Skipping the copy did not stop a publish.** It failed the catalogue gate afterwards, on a
missing file — and the gate's own failure message, the `IMAGES.md` recipe for adding a product,
and ADR-006 all name the same remedy: `npm run generate:placeholders`. That script writes a gem
motif on an ivory gradient at exactly that path, and it never overwrites, deliberately, because
the thing at risk is photography that may exist nowhere else. So the remedy for a missing
photograph installed a permanent stand-in over one that was sitting a directory away.

**206 of 449 products shipped that way**, across three orchestration runs on 2026-08-27
(`fdbe6d6`, `f413918`, and the eighteen chunk commits of `bb9c127`…`f4a8e48`). BUILD_LOG row 94
records the mechanism in its own words: *"the 20 new records' `/products/PNNN.webp` files didn't
exist — fixed by running the existing, non-destructive `npm run generate:placeholders`"*. The
runs between 13:44 and 17:38 that day did perform the copy, and their 194 products are
byte-identical to their sources today. Nothing about the products, their categories or their
photographs separates the two groups. The only difference is whether a person remembered.

That is the shape of defect this repository has a stated position on: a rule that depends on
discipline rather than on a check is a rule that has already been broken somewhere.

## Decision

### 1. `scripts/stage-images.mjs` performs the copy, and the destination is read, never derived

`sourceFile` is carried to `path`. Both come out of the record; neither is recomputed here.

Re-deriving the destination would mean a second implementation of a convention that already has
one — re-slugging `Wine Red` to `wine-red`, re-numbering `extra-1` to `-2` — and the two would
agree only until one of them changed. What the script does assert is that `path` is a
`/products/…​.webp` path whose file name belongs to the product the record came from, so a
malformed draft cannot write outside `public/products/` or under another product's id.

A `sourceFile` is batch-relative and the directory it names is renamed at publish, so both
locations are tried: `content-pipeline/incoming/{sourceFile}` while queued, then
`content-pipeline/completed/{id}/raw/{file name}` once filed. The second match is on the file's
own name because publish renames the staging directory from its working id (`odoo-124/`) to the
product id (`P106/`).

### 2. It never overwrites without being told to, and an overwrite is never silent

A file already at the destination is left alone and reported. `--force` replaces it and prints
the size and dimensions either side, because the file being replaced may be the only copy of
something — the same reason `generate-placeholders.mjs` has no force flag at all.

This script does not read, call or know about that one. A placeholder standing where a
photograph belongs is a fact about `public/products/`, not about the generator, and the two
concerns stay apart.

### 3. Publishing calls it, before the catalogue is written

`publishProduct` stages the product's confirmed photographs after every refusal check and
**before** the catalogue and keyword map are written. A record whose confirmed photograph cannot
be found now refuses the publish outright, rather than publishing and leaving a hole at the path
for a placeholder to fill. A destination already holding a different file is a warning naming
`stage:images --force`, not a silent pass and not an overwrite.

A product that stages no photograph at all — `sourceFile: null`, the hand-made intake path —
publishes exactly as before. That is not the same failure as a record naming a file the
repository cannot produce, and it is not a failure at all.

### 4. The gate stops asking whether a file exists and starts asking which file it is

`existsUnderPublic` answered "is something there", and something was always there. The new check
in `validate-products.mjs` is a **conjunction**, and neither half is sound alone:

1. The record's confirmed `sourceFile` is resolved and compared **byte for byte** with what is
   published. Identical is proof, not evidence: that file *is* the photograph, and nothing
   further is measured.
2. Only a file that differs from its own staged source has its flatness measured, by the
   pixel-variance signal `flag-dummy-images.mjs` already used, now shared from
   `scripts/image-flatness.mjs` so there is one threshold rather than two. Below
   `PLACEHOLDER_MAX_STDEV` it is a **hard failure**.

**The threshold on its own would be wrong, and this is why the byte comparison is not merely an
optimisation.** Measured across this catalogue, the 206 known placeholders span 14.1–19.9 — but
three genuine migrated photographs measure 15.7, 17.5 and 18.3, and the owner's own photography
reaches down to 13.1. A flatness threshold alone would call five real photographs generated.
None of them is ever measured, because each is byte-identical to the file its record stages.

Run against the catalogue as it stands, the check flags **exactly the 206** the audit identified
by hand, with no product outside that set and none of it missed.

A product with no pipeline record, or none carrying a confirmed `sourceFile`, is not judged.
Nothing claims a photograph exists for it, and a flat image there may be a plain product shot —
which is why the 49 hand-photographed products, three of which are flatter than any placeholder,
are silent in this check rather than exempted by a special case.

## Consequences

**`npm run validate:products` fails today, and that failure is correct.** It reports the 206
products whose published image is a placeholder over a real photograph. They are deliberately
not repaired here: this change is the mechanism, and re-publishing 206 images is a separate
change with a separate review. Until then the gate is red and says precisely why, per product,
with the command that fixes each one.

**The gate got slower, and gets faster as the catalogue gets healthier.** 0.45 s to about 14 s,
all of it decoding the 206 flagged images. A catalogue where every published photograph matches
its source decodes none of them, because the byte comparison settles every product first.

**The `generate:placeholders` recipe is no longer the answer to a missing migrated photograph.**
`IMAGES.md` and `content-pipeline/README.md` now route a migrated product to `stage:images` and
keep the generator for what it was always for: a product nobody has photographed yet.

**What this does not do** is judge a photograph. A file that differs from its staged source and
is not flat is reported as an advisory and nothing more — someone put a real image there on
purpose, and this gate has no standing to overrule them.

## Addendum, 2026-09-01 — the repair ran, and it found the next one

The consequence above — "`npm run validate:products` fails today, and that failure is correct" —
no longer holds. The 206 were re-published in the change immediately following this one, from the
list the gate itself derives, and the photograph check now reads `verified identical 400`,
`PLACEHOLDER SHOWN 0`. The results are in
[RESULT-2026-09-01-republish-206-photographs.md](../testing/RESULT-2026-09-01-republish-206-photographs.md).
Nothing in the decision changed; only the state of the catalogue it measures.

Running the repair surfaced a defect this ADR does not cover and does not fix. Staging all 206
products copied **267 secondary photographs** as well — the `-2`, `-3` and `-{variant}` entries
their records confirm — and **`data/products.json` references none of them**. 436 of 449 records
carry exactly one entry in `media.images`, and no runtime path resolves a `-N` suffix:
`lib/variant-images.ts` reads an explicit `media.variantImages` mapping and returns `null` for an
unmapped selection.

The mapper is not the thing at fault. `mapImagesToMedia` pushes **every** confirmed general path,
and P629 shows the gap plainly: its completed draft confirms three images with three distinct
paths, and the catalogue holds one. Whatever wrote those records dropped the extras somewhere
between the mapper and the file — the same shape of loss this ADR closed for the primary
photograph, one layer further in.

It is left open deliberately. Repairing it edits `data/products.json`, which is a catalogue
change under [ADR-001](ADR-001-tech-stack.md) and takes its own review, and the check that would
catch it does not exist yet: the gate compares a *published path* against its source, so an image
that reaches no path at all is invisible to it. A record that confirms an image the catalogue
never names should be a finding, and today it is silence.
