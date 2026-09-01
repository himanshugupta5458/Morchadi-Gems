# RESULT 2026-09-01 — the staging copy, and the gate that can now see it

Verification of [ADR-074](../decisions/ADR-074-publish-stages-its-own-photographs.md). The
defect this closes was diagnosed first, without a fix: the audit that produced the 206 figure is
summarised in the Context section of that ADR, and the mechanism is quoted from BUILD_LOG row 94.

**Scope note.** The 206 affected products were deliberately **not** repaired in this pass. No
file under `public/products/` was written for any of them, `data/products.json` was not touched,
and `generate:placeholders` was not run at any point.

## Gate

Run stage by stage, because `validate:products` now fails and chaining would have hidden `build`
and `test:run` behind it.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | ✔ No ESLint warnings or errors |
| `npm run validate:products` | **exit 1 — 206 failures, expected and correct.** See below |
| `npm run build` | exit 0 |
| `npm run test:run` | 129 files, 2545 passed, exit 0 |

### The expected failure

`validate:products` reports:

```
Published photographs against the pipeline's own confirmed source
  verified identical 194
  no staged photo    49 (hand-made, nothing claims one)
  differ, not flat   0
  source missing     0
  PLACEHOLDER SHOWN  206

FAIL — 206 problem(s):
  - P103: public/products/P103.webp is a flat generated graphic (colour stdev 15.7, below 21)
    and is not the confirmed photograph the record stages at
    2026-08-23-batch-01/P103/raw/main.webp. A real photo exists but was never published —
    run: npm run stage:images -- P103 --force
  … 205 more
```

194 + 49 + 206 = 449, the whole catalogue, with every product in exactly one bucket.

**The flagged set was compared against the audit's independently-derived list of 206 and is
identical** — same 206 ids, no product outside the set, none of the set missed. The two were
arrived at by different routes: the audit compared each published file's md5 against
`content-pipeline/completed/{id}/raw/main.webp` and read dimensions; the gate resolves the
record's own confirmed `sourceFile` and only then measures flatness.

The gate stays red until those 206 are re-published, which is a separate change with its own
review. It reports each one by id with the command that repairs it.

## Why the threshold is not the check

The flatness signal **does not separate the two populations on its own**, and a check built on
it alone would have been wrong about five products:

| Population | n | min | p5 | median | max |
| --- | --- | --- | --- | --- | --- |
| Known placeholders | 206 | 14.1 | 15.9 | 18.3 | 19.9 |
| Correctly published migrated photographs | 194 | **15.7** | 23.6 | 52.8 | 92.7 |
| The owner's own photography (P001–P049) | 49 | **13.1** | 13.6 | 42.9 | 82.3 |

Three migrated photographs (15.7, 17.5, 18.3) sit inside the placeholder band, and two of the
owner's own go below all of it. None of the five is ever measured: each is byte-identical to
the source its record stages, or has no staged source at all, and the check stops there. That
ordering — bytes first, flatness only on a file that already differs — is what makes
`PLACEHOLDER_MAX_STDEV = 21` safe, and it is recorded in `scripts/image-flatness.mjs` beside the
constant so nobody later reads the number as a standalone rule.

## Runtime

`validate:products` went from **0.45 s to about 14 s**, all of it decoding the 206 flagged
images. Every one of the other 243 products is settled by the byte comparison without decoding
anything, so the check gets **faster as the catalogue gets healthier**: once the 206 are
re-published, all 400 migrated products resolve on bytes alone.

## Manual runs against the real repository

Both were run against the shipped catalogue, and `git status` afterwards confirmed neither wrote
a file.

**A known-good product — `npm run stage:images -- P566`.** P566 is one of the 194 already
published correctly, so the expected outcome is a no-op skip, and that is idempotence
demonstrated on real data rather than on a fixture:

```
  P566  skipped     /products/P566.webp  (already the staged photograph)

Copied              0
Overwritten         0
Skipped, identical  1
Skipped, differs    0
Confirmed, unstaged 0
UNRESOLVED          0

OK.
```

Exit 0.

**A clean case in neither set — `npm run stage:images -- P164 --dry-run`.** P164 is a draft in
`content-pipeline/drafts/` that is **not in `data/products.json` at all**, so it is in neither
the 206 nor the 194, and no file exists at its destination. `--dry-run` proves the resolution
without writing:

```
DRY RUN — nothing will be written.

  P164  would copy  /products/P164.webp  (136960 B, from 2026-08-23-batch-01/P164/raw/main.webp)

Would copy          1
Would overwrite     0
Skipped, identical  0
```

Exit 0, and `public/products/P164.webp` does not exist afterwards — confirmed by `ls`. The
source resolved is the real staged photograph, 136,960 bytes, still under
`content-pipeline/incoming/`.

The write path itself, the `--force` overwrite report and every refusal are covered in
`lib/stage-images.test.ts` against a temp repository, for the reason stated at the top of that
file: a suite with a force-overwrite case in it must not be able to reach the real 206.

## Test counts

| Suite | Before | After |
| --- | --- | --- |
| `lib/stage-images.test.ts` | — | 15 (new) |
| `lib/publish-product.test.ts` | 18 | 22 |
| Whole suite | 128 files | **129 files, 2545 passed** |

The 19 added cases are the whole delta this change introduces.
