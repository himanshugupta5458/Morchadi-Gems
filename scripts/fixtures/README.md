# scripts/fixtures

Fixture inputs for the scripts in the parent directory. **Everything here is fabricated.** No
file in this folder is an export, a sample of real data, or a record of anything the owner's
sites ever contained.

| File | For | Status |
| --- | --- | --- |
| [`synthetic-odoo-batch.jsonl`](synthetic-odoo-batch.jsonl) | `scripts/prepare-migration-batch.mjs` | **SYNTHETIC** — 10 fabricated records, all valid, so the batch assigns P101–P110 |
| [`synthetic-odoo-batch-invalid.jsonl`](synthetic-odoo-batch-invalid.jsonl) | `scripts/prepare-migration-batch.mjs` | **SYNTHETIC** — 4 fabricated records, each broken in one specific way, so `needs-attention.md` can be seen |

## Why these exist

The real Phase B JSONL has not been delivered. These fixtures pin the *mechanism* — validation,
id assignment, shape transformation, the manifest — so that when the real export arrives the only
thing that changes is the path passed to the script. They match the schema
[ADR-054](../../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md) states the export
will have.

The product titles, descriptions, SKUs and prices are invented for this purpose. They are **not**
copy to reuse, and nothing here has been through the honesty rules of
[ADR-018](../../docs/decisions/ADR-018-honest-product-description.md) or
[ADR-035](../../docs/decisions/ADR-035-catalogue-content-pass.md). Two of the records deliberately
carry the kinds of claim `docs/pipeline-prep/source-data-notes.md` catalogues — a karat number on
a plated item, an `American Diamond` trade name — because Stage 0 must transcribe those untouched
and hand them to review, and a fixture with only clean copy would not prove that.

## The images these records reference

`prepare-migration-batch.mjs` checks that each record's main photograph exists on disk. No image
files are committed here: the test suite writes empty `.webp` placeholders into a temporary
directory and points the run at it with `--incoming-root`. The check is that a path resolves, not
that a file decodes.
