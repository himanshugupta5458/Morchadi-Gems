# Known issues accepted for post-publish review

The durable record of issues the owner has **explicitly accepted publishing with**, on the
stated basis that the site is currently private and unshared and that a 1–2 day review window
follows publish. Each entry stays `open` until the owner resolves it and records the outcome
here. This file is the record the post-publish review pass works through — an entry that is
fixed is marked `resolved` with a date and what was done, never deleted.

An issue belongs here only when the owner has decided to proceed despite it. A defect nobody
has accepted is not a "known issue"; it is a blocker, and it stops the pipeline instead of
landing in this file.

## Entries

### KI-001 — P106 and P120 share an identical source photograph

- **Products:** P106, P120 (both "Rose Gold Plated American Diamond Ring" on the old site,
  Odoo ids 124 and 145, SKUs MJ-504 and MJ-501)
- **Shared image sha256:** `e57b58789e5b30b47408926320f01897b97eba7c0420e58ce70023a148770650`
- **What is wrong:** the source export supplied the same photograph — a rose gold-plated
  five-petal cubic zirconia flower ring — as the main image for two different SKUs. Both
  `public/products/P106.webp` and `public/products/P120.webp` are byte-identical copies of it,
  so two distinct listings currently show one and the same piece. Either one SKU needs its own
  photograph, or the two listings are duplicates of one product and one of them should not
  exist.
- **Owner decision:** publish anyway, accepted 2026-08-24 during the 11-product pilot batch —
  the site is private and unshared, and the owner will resolve this within the stated 1–2 day
  post-publish window. Both drafts' `notes[]` record the acceptance and point here.
- **Status:** open

### KI-002 — P121 priced at its ₹99 reference, against the batch summary's tally

- **Product:** P121 (Odoo id 146, SKU MJ-509)
- **What is wrong:** the owner's pilot pricing decision was "same as each product's reference
  price", summarised as "nine at ₹59, two — P109 and P119 — at ₹99". P121's recorded reference
  price is **₹99**, consistently from the Stage 0 raw block through the draft, so the batch
  actually splits eight at ₹59 and three at ₹99 — the summary's tally and the recorded data
  cannot both be right.
- **What was done:** the governing principle ("same as each product's reference price") was
  followed: P121 is priced at ₹99. If the owner intended ₹59 for P121, the fix is a one-line
  price edit and a re-run of the gate.
- **Owner decision needed:** confirm ₹99 is correct for P121, or restate the price.
- **Status:** open

## Format for new entries

`### KI-NNN — <one-line summary>`, then: products involved, the evidence (hashes, ids, paths),
a plain-language description of what is wrong, the owner decision that accepted it (with date),
and a `Status:` line — `open` or `resolved (YYYY-MM-DD): <what was done>`.
