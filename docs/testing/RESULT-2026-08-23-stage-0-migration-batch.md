# Test Result: Stage 0 migration batch preparation — 2026-08-23

- **Plan:** [PLAN-stage-0-migration-batch.md](PLAN-stage-0-migration-batch.md)
- **Commit:** working tree at prompt 72, on `main` after `fc53c6b`
- **Environment:** local container. No env vars, no credentials, no network, no database.
- **Suite:** `lib/prepare-migration-batch.test.ts` — **69 cases, all passing**. Full suite
  **1636 passing across 85 files**.
- **Fixtures:** `scripts/fixtures/synthetic-odoo-batch.jsonl` (10 fabricated records, all valid)
  and `scripts/fixtures/synthetic-odoo-batch-invalid.jsonl` (4 records, each broken in one way).

**The real Phase B JSONL export has not been delivered, and no real Odoo listing has been through
this script.** Everything below proves the mechanism against fabricated data. When the export
arrives, the only thing that changes is the path on the command line.

## Automated cases

| Group | Cases | Result |
| --- | --- | --- |
| Part A — category validation | TC-01 … TC-05 | Pass |
| Part A — subcategory validation | TC-06 … TC-08 | Pass |
| Part A — the sub-50-character stub rule | TC-09 … TC-12 | Pass |
| Part A — image existence | TC-13 … TC-15 | Pass |
| Part A — reporting | TC-16 … TC-19 | Pass |
| Part B — the P101 safety assertion | TC-20 … TC-25 | Pass |
| Part B — sequential assignment | TC-26 … TC-33 | Pass |
| Part C — variant transformation | TC-34 … TC-37 | Pass |
| Part C — image transformation | TC-38 … TC-44 | Pass |
| Part C — the raw block | TC-45 … TC-52 | Pass |
| Part D — manifest and register | TC-53 … TC-61 | Pass |
| The scope boundary | TC-62 … TC-64 | Pass |

Two of these are worth naming individually.

**TC-21 runs against the real `data/products.json`**, not a fixture, and asserts its maximum id is
at or below the P049 ceiling. It is the case that will start failing on the day the catalogue
moves past P049 — which is the day this one-time override stops being safe to run.

**TC-62 and TC-63 read the script's own source with its prose stripped out**, so the scope
boundary is checked against executable code rather than against a comment claiming the code
behaves. The three extraction skills appear nowhere in it, and `data/keyword-map.json` appears
nowhere at all.

## Manual cases

### TC-65 — full CLI run on the ten-record fixture

Run against a scratch `--incoming-root` with zero-byte `.webp` placeholders staged, and a scratch
`--register` copy so no fabricated product reached the real register.

```
Stage 0 batch preparation — synthetic-2026-08
No Draft A extraction runs here. This step validates, assigns ids and queues.

  source            scripts/fixtures/synthetic-odoo-batch.jsonl
  records read      10
  queued            10
  needs attention   0
  catalogue max id  P049
  ids assigned      P101–P110

PASS — every record queued. Draft A extraction is the next, separate step.
```

Exit 0. Ten `PNNN/raw-block.json` files, `manifest.json`, `needs-attention.md`, and ten register
rows — all at stage `queued`, each naming its batch and its Odoo id. **Pass.**

### TC-66 — re-running the same batch id

```
REFUSING TO WRITE — 10 raw block(s) already exist under …/synthetic-2026-08.
A raw block IS the id reservation, so overwriting one would hand an assigned number to a
second product. Move the existing batch aside or use a new batch id.
```

Exit 1, nothing overwritten. **Pass.**

### TC-67 — full CLI run on the invalid fixture

Exit 1, zero queued, four refused, and every fault named with its field and its reason:

| JSONL line | originalId | Field | Reason |
| --- | --- | --- | --- |
| 1 | `2001` | `category` | `"toe-rings"` is not null and not one of the eleven fixed slugs |
| 2 | `2002` | `rawContent` | only 10 characters, under the 50-character stub threshold, and not flagged `knownStub: true` |
| 3 | `2003` | `images.main` | no file on disk at `content-pipeline/incoming/synthetic-bad/odoo-2003/raw/main.webp` |
| 4 | `2004` | `subcategory` | `"   "` is present but is not a non-empty string |

The register file was byte-identical afterward — a run with nothing to queue writes no rows.
**Pass.**

### TC-68 — determinism across two full runs

The ten-record fixture prepared twice, into two separate directories with two separate register
copies. `diff` on the raw blocks (P101, P105, P110 checked individually) and on the register
files: identical. **Pass.**

### TC-69 — the catalogue and the keyword map

`git status --short data/` is empty after every run in this session. Neither
`data/products.json` nor `data/keyword-map.json` was modified by anything here. **Pass.**

## The gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass — no output |
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm run test:run` | Pass — 1636 tests, 85 files |
| `npm run validate:products` | `PASS — all checks green` (the same pre-existing advisories as before this prompt) |
| `npm run build` | Pass — compiled, 75 static pages generated, 50 product pages |

## Findings

**None from the script itself.** Two things were found while writing the tests, both fixed before
this run:

1. The first draft of the invalid-fixture test asserted zero records queued while injecting an
   `imageExists` that always returned true — which made the missing-image record pass and the
   assertion wrong for a reason unrelated to what it was testing. The fixture and the injected
   predicate now agree.
2. The two scope-boundary assertions originally read the script's raw source, so they were
   satisfied — or in one case failed — by its own documentation rather than by its code. Both now
   strip comment lines first.

## What this run does not show

- **Nothing about real data.** The schema in
  [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md) is the schema the export
  is expected to have. If it differs, this suite passes and the script still needs changing.
- **Nothing about the images.** The validator checks that a path resolves. Zero-byte placeholders
  satisfy it, and nothing here opens, decodes or measures a photograph.
- **Nothing about extraction.** By design — see ADR-054 decision 1. The queue this produces has
  never been handed to `draft-a-skills.md`.
- **The `gift-hampers` question is open.** TC-05 proves the warning fires. It does not decide what
  a gift hamper is in this catalogue's information architecture, which is an owner call and
  blocks any such record from being published.
