# Candidate gallery additions for live P010 (Mini Watch Ring) — awaiting owner review

Staged 2026-08-25 while executing the owner-approved
[duplicate-cluster merge proposal](../../../docs/pipeline-prep/duplicate-cluster-merge-proposal.md),
cluster A-4. The owner confirmed queued P354 and P360 are the same product as live P010;
both ids are retired (see the register's
[Rejected ids](../../../docs/pipeline-prep/drafts-in-progress.md#rejected-ids)). These are
the photos from their staged bundles that live P010 does **not** already show — candidates
to enrich P010's one-image gallery, byte-copied here for the owner to open and judge.

**Nothing here is live.** `data/products.json` still lists P010 with `/products/P010.webp`
(plus the golden variant image) only. Adding any of these is a separate, final step after
this review. Each candidate was verified by SHA-256 to match nothing P010 already has:
not `public/products/P010.webp`, not `P010-golden.webp`, not the three older files in
`public/products/staging/`.

## Manifest

| File | Dimensions | Size | SHA-256 (first 12) | Origin |
| --- | --- | --- | --- | --- |
| `candidate-1.webp` | 800×800 | 43,358 B | `eb37f7ab1a38` | P354's **main** photo; also P360's `extra-1`. The largest file of the set |
| `candidate-2.webp` | 800×800 | 20,560 B | `12ac045e5854` | P360's `extra-2` — existed **only** in P360, nowhere else in the repo |
| `candidate-3.webp` | 800×800 | 27,806 B | `f879d193b201` | P354's `extra-1`; also P360's `extra-3` |

Source files (untouched, still in place):
`content-pipeline/incoming/2026-08-23-batch-01/P354/raw/` and `…/P360/raw/`.
P360's `main.webp` is **not** here because it is byte-identical to the already-live
`public/products/P010.webp` (`03bf45afb5a6`) — the match that revealed this cluster
duplicates P010 in the first place.

## What the owner is judging

Whether each candidate is a genuinely useful additional angle of the Mini Watch Ring, or a
near-duplicate/low-quality frame not worth adding. Hashing can only prove they are not
byte-identical; the visual call is the owner's. Approved images then go through the normal
live-gallery addition (copy into `public/products/` under P010 names, extend
`media.images` in `data/products.json` — that step edits the catalogue and is **not** part
of this staging).
