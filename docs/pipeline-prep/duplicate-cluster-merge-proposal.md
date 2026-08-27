# Duplicate-cluster merge proposal — A-3, A-4, A-5, B-6–B-10

**Date:** 2026-08-25 · **Status:** proposal only — nothing executed. `data/products.json`
untouched, no image file moved or copied, no `raw-block.json` edited, no id retired.
Every claim below is from a fresh SHA-256 pass done for this report; nothing was carried
forward from the [duplicate-photo groups review](duplicate-photo-groups-review.md) without
re-verification.

The eight clusters here are rows 3–10 of that review's curation table (its A-band rows 3–5
and B-band rows 6–10), confirmed by the owner as true duplicates to merge. This report
locates every image in each cluster, hashes it, separates already-known duplicates from
candidate unique images, and proposes the surviving product's final image list per cluster.

**Method.** Every image was re-hashed (SHA-256) across **all three locations**: staged files
under `content-pipeline/incoming/2026-08-23-batch-01/PNNN/raw/`, published files under
`public/products/`, and the archived pilot bundles under `content-pipeline/completed/PNNN/raw/`.
Each cluster hash was then grepped against the full 1,146-file corpus (all images in
`public/products/` + `content-pipeline/`), so a match *outside* the cluster would have been
caught — and one was (see A-4). Duplicate detection is exact byte-identity only; no
perceptual/visual similarity was attempted, per the task. Dimensions read with Pillow.

## The headline, before the per-cluster detail

**Seven of the eight clusters contain zero unique images.** In A-3, A-5 and all five B
clusters, every file the queued twin owns is byte-identical to a file the live product
already serves. There is nothing to merge — each of those merges reduces to a pure
retirement of the queued id, and no visual judgement call about "which angle to keep"
exists for the owner to make. Each queued twin in the B clusters ships exactly one photo
(its `images.json` lists no extras and no variants — verified per product), and that one
photo is the live main.

**The only cluster with real image decisions is A-4 (P354/P360)** — and the fresh hash pass
against the *full* corpus surfaced something the earlier review could not have seen (it
hashed only the 1,075 staged migration photos): **P360's main photo is byte-identical to
`public/products/P010.webp`, the live main of P010 "Mini Watch Ring"** — a legacy catalogue
product, also ₹199, whose source titles describe the same watch-design ring. The A-4
cluster may therefore not be "two queued duplicates of each other" but a three-way
duplicate of an *already-live* product. That reframes the whole cluster and is flagged as
the report's principal open question.

One adjacent observation, outside this task's scope but re-confirmed while verifying A-5:
live `P106.webp` and live `P120.webp` are still byte-identical to each other (same hash
`e57b58…`, same 110,350 bytes) — the open KI-001 decision. Retiring P160 resolves only the
*queued* third leg of that triangle.

---

## A-3 — P135 → live P108 (Butterfly Wing Bypass Ring)

**Cluster:** live **P108** (MJ-508, ₹59) + queued **P135** (MJ-159, "DC Jewelry Butterfly
Duo Ring – Rosegold Finish | Adjustable CZ Ring", ₹59).

Every image found, with hash groups:

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `65cc9c9c0f75` | `public/products/P108.webp` · `completed/P108/raw/main.webp` · `incoming/…/P135/raw/main.webp` | 1080×1080 | 122,600 B |
| `5bf653e67f2f` | `public/products/P108-2.webp` · `completed/P108/raw/extra-1.webp` · `incoming/…/P135/raw/extra-1.webp` | 1080×1080 | 45,068 B |
| `c77ab9aea310` | `public/products/P108-3.webp` · `completed/P108/raw/extra-2.webp` · `incoming/…/P135/raw/extra-2.webp` | 1080×1080 | 45,122 B |

**Candidate unique images: none.** P135's entire three-photo gallery is byte-for-byte
P108's entire three-photo gallery, in the same main/extra-1/extra-2 order. The task's
premise ("merge P135's unique images into P108") resolves to an empty set.

**Proposal.**
- **Survivor:** P108, image list unchanged — `/products/P108.webp`, `/products/P108-2.webp`,
  `/products/P108-3.webp` in their current order.
- **Retire:** P135. Nothing moves.
- No visual judgement needed from the owner — there is no distinct file to judge.
- Housekeeping worth recording at execution time: P135's source identity (Odoo id 165,
  SKU MJ-159, the "Butterfly Duo" title) becomes the provenance of a retired id; if old-site
  SKU/URL mapping ever matters, MJ-159 should map to P108.

## A-4 — P354 + P360 (Minimal Watch Design Adjustable Ring) — and, unexpectedly, live P010

**Cluster as confirmed:** queued **P354** (MJ-419, Odoo 789, "Minimal Watch Design
Adjustable Ring for Girls", ₹199) + queued **P360** (MJ-420, Odoo 799, same title +
"(Pack of 1)", ₹199). Neither is live, and neither has been through Draft A — both
raw blocks carry `draftAExtractionRun: false`, `imagesConfirmed: false`. **So this merge,
if approved, happens at the raw-block/queue stage (edit the surviving raw block +
`images.json`, drop the retired one from the register), not as a live-product edit like
every other cluster here.**

Every image found, with hash groups — four distinct photos exist across the pair:

| Hash (first 12) | Files | Dimensions | Size | Notes |
| --- | --- | --- | --- | --- |
| `03bf45afb5a6` | `incoming/…/P360/raw/main.webp` · **`public/products/P010.webp` (live)** | 800×800 | 27,674 B | P360's main is the live P010 main, byte-identical |
| `eb37f7ab1a38` | `incoming/…/P354/raw/main.webp` · `incoming/…/P360/raw/extra-1.webp` | 800×800 | 43,358 B | P354's main; P360 holds it as an extra |
| `f879d193b201` | `incoming/…/P354/raw/extra-1.webp` · `incoming/…/P360/raw/extra-3.webp` | 800×800 | 27,806 B | shared extra |
| `12ac045e5854` | `incoming/…/P360/raw/extra-2.webp` | 800×800 | 20,560 B | **only copy anywhere in the corpus — P360-unique** |

**P360 is a strict superset of P354:** both of P354's photos appear in P360's set, and P360
adds two more (its main and extra-2). P360's raw block also carries a variant suggestion
(colour: silver/golden) that P354's does not — matching live P010, which sells exactly
those two colour options.

**The new finding.** P360's main = live `P010.webp` ("Mini Watch Ring", ₹199, colour
variants silver/golden, legacy product from the original 49). Same price, same 800×800
export size, and the P354/P360 source copy describes the same design P010 sells. The
earlier review hashed only staged migration photos, so this live overlap was invisible to
it. P010's golden-variant image (`P010-golden.webp`) matches nothing in the cluster.

**Proposal — flagged as a proposal, not a decision, in two layers:**

1. **Survivor between the two queued ids: P360.** It holds all four distinct photos
   (P354 contributes nothing P360 lacks), carries the colour-variant suggestion, and its
   only title difference is the removable "(Pack of 1)" suffix. Its proposed image order:
   - main: `P360/raw/main.webp` (`03bf45…`, 27,674 B)
   - extra-1: `P360/raw/extra-1.webp` (`eb37f7…`, 43,358 B — P354's former main, the
     largest file of the set; the owner may prefer it *as* the main)
   - extra-2: `P360/raw/extra-2.webp` (`12ac04…`, 20,560 B)
   - extra-3: `P360/raw/extra-3.webp` (`f879d1…`, 27,806 B)
   **Retire: P354.** No file needs to move — P360's own `raw/` already contains everything.
2. **But the owner must first rule on P010.** If this queued design *is* the live Mini
   Watch Ring (the byte-identical main, identical price and matching colour options all
   point that way), the honest outcome is not a new product at all: retire **both** P354
   and P360 from the queue, and separately decide whether any of the three photos P010
   does not currently show (`eb37f7…`, `12ac04…`, `f879d1…`) are worth adding to live
   P010's gallery — a normal live-product image addition, on P010's own schedule. If the
   owner instead judges it a genuinely distinct product (e.g. a different watch-ring
   design that reused P010's photo in the export), the surviving P360 **cannot ship with
   its current main** — a second live listing would carry P010's exact photo — so a
   replacement main would be needed before publish.

**Open questions for the owner (visual judgement / business call):**
- Is P354/P360 the same physical product as live P010? (Everything hash-level says the
  photos overlap; only the owner can say whether the *product* is the same.)
- If a new product survives: which of the four photos is the main? The current P360 main
  is also P010's live main — reusing it is the KI-001 situation again.
- Are the three non-main photos (`eb37f7…`, `f879d1…`, `12ac04…`) genuinely different
  angles worth keeping? At 800×800 and 20–43 KB they are the smallest images in any
  cluster here; the size spread suggests different shots rather than re-encodes, but only
  eyes can confirm none is a near-duplicate or a blurry frame.

## A-5 — P160: retire with nothing to merge (re-verified, not assumed)

**Cluster:** live **P106** (MJ-504) + live **P120** (MJ-501) + queued **P160** (MJ-252,
"Floral Cluster CZ Gold-Plated Adjustable Ring", ₹59). The task: confirm P160 still has
zero unique images before proposing its retirement.

**Re-verified from scratch.** P160's staged bundle contains exactly one image —
`raw/main.webp`, and its `images.json` declares no extras and no variants:

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `e57b58789e5b` | `incoming/…/P160/raw/main.webp` · `public/products/P106.webp` · `public/products/P120.webp` · `completed/P106/raw/main.webp` · `completed/P120/raw/main.webp` | 1080×1080 | 110,350 B |

Grepped against the full 1,146-file corpus: those five files are the *only* holders of
this hash, and P160 owns no other file. **The prior finding holds: P160 has zero
distinct-hash images.**

**Proposal.**
- **Retire:** P160. Nothing merges anywhere — its only photo is already live twice.
- **Unchanged and out of scope, but restated so it isn't lost:** P106 and P120 remain two
  live products sharing one byte-identical main photo (KI-001, owner-accepted at publish,
  still open in [known-issues-post-publish.md](known-issues-post-publish.md)). Retiring
  P160 shrinks the triangle back to the original KI-001 pair; it does not resolve it.

## B-6 — P141 + P167 → live P115 (Beaded-Edge CZ Band Ring)

**Cluster:** live **P115** (MJ-505, ₹59) + queued **P141** (MJ-183, "DC Jewelry Rose Gold
Band CZ Adjustable Ring", ₹59) + queued **P167** (MJ-138, "Classic Eternity Band CZ
Gold-Plated Ring", ₹59).

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `403e42f4c3d2` | `public/products/P115.webp` · `completed/P115/raw/main.webp` · `incoming/…/P141/raw/main.webp` · `incoming/…/P167/raw/main.webp` | 1080×1080 | 90,694 B |

P141 and P167 each hold exactly this one photo (no extras, no variants). **Candidate
unique images: none.**

**Proposal.** Survivor **P115**, image list unchanged (`/products/P115.webp` only).
**Retire both P141 and P167.** Nothing moves; no visual call for the owner. Provenance
note for execution: MJ-183 and MJ-138 both map to P115.

## B-7 — P146 → live P110 (Lattice Criss-Cross CZ Ring)

**Cluster:** live **P110** (MJ-499, ₹59) + queued **P146** (MJ-195, "DC Jewelry X-Shape
Rose Gold Ring", ₹59).

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `00f5bb206b4c` | `public/products/P110.webp` · `completed/P110/raw/main.webp` · `incoming/…/P146/raw/main.webp` | 1080×1080 | 148,030 B |

P146's single photo is the live P110 main. **Candidate unique images: none.**

**Proposal.** Survivor **P110**, image list unchanged. **Retire P146.** MJ-195 → P110.

## B-8 — P159 → live P109 (Oval CZ Swirl Cocktail Ring)

**Cluster:** live **P109** (MJ-500, ₹99) + queued **P159** (MJ-448, "Oval Halo Swirl CZ
Gold-Plated Ring", ₹99).

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `6bdb4922c7d8` | `public/products/P109.webp` · `completed/P109/raw/main.webp` · `incoming/…/P159/raw/main.webp` | 1080×1080 | 132,508 B |

P159's single photo is the live P109 main. **Candidate unique images: none.**

**Proposal.** Survivor **P109**, image list unchanged. **Retire P159.** MJ-448 → P109.

## B-9 — P144 → live P118 (Open Heart and Teardrop CZ Ring)

**Cluster:** live **P118** (MJ-506, ₹59) + queued **P144** (MJ-184, "DC Jewelry Rose Gold
Heart Ring", ₹59).

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `bcc9a87f2f70` | `public/products/P118.webp` · `completed/P118/raw/main.webp` · `incoming/…/P144/raw/main.webp` | 1080×1080 | 88,728 B |

P144's single photo is the live P118 main. **Candidate unique images: none.**

**Proposal.** Survivor **P118**, image list unchanged. **Retire P144.** MJ-184 → P118.

## B-10 — P149 → live P122 (Rose Gold-Plated CZ Solitaire Ring)

**Cluster:** live **P122** (MJ-503, ₹59) + queued **P149** (MJ-160, "DC Jewelry Classic
Round Solitaire Ring", ₹59).

| Hash (first 12) | Files | Dimensions | Size |
| --- | --- | --- | --- |
| `0b1a0cbccb13` | `public/products/P122.webp` · `completed/P122/raw/main.webp` · `incoming/…/P149/raw/main.webp` | 1080×1080 | 104,316 B |

P149's single photo is the live P122 main. **Candidate unique images: none.**

**Proposal.** Survivor **P122**, image list unchanged. **Retire P149.** MJ-160 → P122.

---

## Summary table

| Cluster | Survivor | Survivor's proposed image list | Retire | Unique images to merge | Owner judgement needed? |
| --- | --- | --- | --- | --- | --- |
| A-3 | P108 (live) | current 3 images, unchanged | P135 | 0 | no |
| A-4 | **P360 (proposed)** — pending the P010 ruling | 4 photos (order above), merge at raw-block stage | P354 — or **both**, if this is live P010 | 2 P360-only photos (`03bf45…` = live P010 main, `12ac04…`) | **yes — three questions above** |
| A-5 | — (pure retirement) | n/a | P160 | 0 (re-verified) | no |
| B-6 | P115 (live) | current 1 image, unchanged | P141, P167 | 0 | no |
| B-7 | P110 (live) | current 1 image, unchanged | P146 | 0 | no |
| B-8 | P109 (live) | current 1 image, unchanged | P159 | 0 | no |
| B-9 | P118 (live) | current 1 image, unchanged | P144 | 0 | no |
| B-10 | P122 (live) | current 1 image, unchanged | P149 | 0 | no |

Queued ids proposed for retirement: **P135, P160, P141, P167, P146, P159, P144, P149**,
plus **P354** (or P354+P360 under the P010 reading of A-4) — nine or ten of the 531 queued.

## What execution would involve (not done, listed so approval is informed)

- For the seven zero-unique clusters: remove the retired ids from the batch register /
  queue per the register's retirement convention, record the SKU→survivor mapping in the
  provenance notes, and delete or archive the retired `incoming/…/PNNN/` bundles per
  whatever retention rule the owner prefers (their images are byte-identical to files git
  already tracks under `completed/`, so nothing is lost either way).
- For A-4: an owner ruling on the P010 question first; then either a raw-block merge into
  P360 (Draft A has not run — the merge is an edit to queue-stage suggestion data, at
  no risk to any live record) or a double retirement with an optional later image
  addition to live P010.
- No step above touches `data/products.json`, and none should until the owner signs off
  on this document.

---

## Resolved — 2026-08-25: Parts A and B executed on owner approval

The owner approved this document and additionally **confirmed the A-4 open question: P354
and P360 are the same product as live P010** — so the A-4 resolution is the "P010 reading"
above (both queued ids retire; no new product survives), not the P360-survives fallback.

**All ten ids are permanently retired, never published: P135, P141, P144, P146, P149,
P159, P160, P167, P354, P360.** For each:

- Its `raw-block.json` was **marked, not deleted** (audit trail preserved): `stage` moved
  `queued` → `retired`, and a `retirement` object records the date, the survivor id, the
  cluster, the reason, and `idPermanentlyUnused: true`. The staged bundles stay in place
  under `incoming/2026-08-23-batch-01/`.
- Its row was removed from the [register](drafts-in-progress.md)'s active queue and an
  entry added to the register's **Rejected ids** table (the register's own convention for
  a rejected id: delete the row, record it there, never reuse the number) — recording id,
  date, the surviving duplicate, and the link back to this proposal. The register's
  derive-don't-hardcode test keys on exactly these two tables, so the gate itself now
  enforces the retirement.
- Permanent-retirement consistency with P050–P100: that block was retired by
  [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md) in tracked
  documentation with a never-reuse rule; these ten follow the same pattern through the
  register's Rejected-ids mechanism, which cites
  [ADR-051 decision 4](../decisions/ADR-051-draft-a-content-pipeline.md) for the same
  never-reuse guarantee. Queue count: 531 → **521**.

**P010 enrichment staged, not applied.** The three photos across P354/P360 that live P010
does not already have — re-verified by hash against `P010.webp`, `P010-golden.webp` *and*
the three older `public/products/staging/P010-*` files — are byte-copied to
**`content-pipeline/pending-review/P010-additional-images/`** with a manifest
(`README.md` there) for the owner's visual review:

| Staged file | Dimensions | Size | SHA-256 (first 12) | Origin |
| --- | --- | --- | --- | --- |
| `candidate-1.webp` | 800×800 | 43,358 B | `eb37f7ab1a38` | P354 main / P360 extra-1 |
| `candidate-2.webp` | 800×800 | 20,560 B | `12ac045e5854` | P360 extra-2 (only copy in repo) |
| `candidate-3.webp` | 800×800 | 27,806 B | `f879d193b201` | P354 extra-1 / P360 extra-3 |

P360's main was **not** staged — it is the already-live `public/products/P010.webp`.
`data/products.json` is untouched: P010 still lists its single image plus the golden
variant, and adding any candidate is the separate final step after the owner looks at
these files. `.gitignore` gained a `pending-review/` rule matching the `incoming/`
philosophy: manifests/READMEs tracked, image files untracked.

## Part C — the full queued-vs-live scan: 30 NEW matches (read-only findings, no action taken)

**The gap.** Until the P360→P010 discovery, duplicate detection had only ever hashed the
staged migration photos against *each other* — never against the live catalogue's original
images. This scan closes that gap: every image of every still-queued product (521 products,
1,046 files under `incoming/2026-08-23-batch-01/*/raw/` after the ten retirements) was
SHA-256-hashed against every file under `public/products/` (71 files, `staging/` included).

**Result: 34 file matches across 32 queued products — 30 of them never reported before.**
The two already known were the C-band rows of the
[duplicate-photo review](duplicate-photo-groups-review.md) (P148↔P119, P177↔P121, both
flagged there because the pilot products' photos were also in the staged corpus). Every
one of the 30 new matches is against an **original-49 legacy product (P001–P047)** — the
exact population the earlier hashing never saw.

**The pattern behind the 30.** In the large majority, the queued product's source title
and reference price match the live product outright (e.g. queued P359 "kashmiri ghungroo
bangles" ₹199 ↔ live P041 "Kashmiri Ghungroo Bangles" ₹199; queued P583 "Pink Tulip Bow
Hair Clip" ₹49 ↔ live P047, same name, same price). The original 49 were evidently
hand-curated from the same Odoo shop this batch migrates, so the batch contains queued
twins of already-live products — a whole new band-A-grade cluster family. **Nothing has
been acted on**; this table is for the owner's curation pass:

| Queued | SKU | Source title (truncated) · ref ₹ | Matched file(s) | Live product (name · ₹ · status) |
| --- | --- | --- | --- | --- |
| P359 | MJ-626 | kashmiri ghungroo bangles · 199 | main | **P041** Kashmiri Ghungroo Bangles · 199 · active |
| P361 | MJ-240 | Elegant Silver Knot Adjustable Ring · 210 | main **and** extra-2 (internal dup) | **P008** Silver-Tone Bow Twist Ring · 210 · active |
| P362 | MJ-284 | Gold Hug Hands Adjustable Ring · 199 | main | **P007** Hug Embrace Open Ring · 199 · active |
| P366 | MJ-046 | Anti Tarnish Multicolor Adjustable Finger Ring · 199 | main (of 7 files) | **P021** Rainbow Baguette Eternity Ring · 199 · active |
| P371 | MJ-251 | Floating Teardrop Locket (Without Charm) · 450 | main (of 8 files) | **P006** Floating Locket Pendant · 450 · active |
| P400 | MJ-428 | Minimalist Steel Ring, Green Crystal · 210 | main (of 11 files) | **P018** Green Solitaire Thread Ring · 210 · active |
| P401 | MJ-431 | Minimalist Steel Ring, White Crystal · 210 | main (of 11 files) | **P017** Clear Solitaire Thread Ring · 210 · active |
| P402 | MJ-430 | Minimalist Steel Ring, White Crystal Red · 210 | main (of 11 files) | **P016** Pink Solitaire Thread Ring · 210 · active |
| P403 | MJ-429 | Minimalist Steel Ring, White Crystal Pink · 210 | main (of 11 files) | **P015** Red Solitaire Thread Ring · 210 · active |
| P405 | MJ-433 | Minimalist Vintage Square Gemstone Ring · 349 | main | **P014** Emerald-Green Baguette Stacking Ring · 349 · active |
| P406 | MJ-432 | Minimalist Vintage Square Gemstone Ring · 349 | main | **P013** Pink Baguette Stacking Ring · 349 · active |
| P407 | — | Brass Initial Letter adjustable ring · 210 | main (of 47 files) | **P001** Wave Band Initial Ring · 210 · active |
| P489 | MJ-565 | Silver-Plated Floral Cluster Nath · 129 | main | **P035** Silver-Plated Floral Cluster Nath · 129 · active |
| P490 | MJ-312 | Gold-Plated Minimalist Stone Nath · 109 | main | **P034** Gold Minimalist Stone Nath · 109 · active |
| P491 | MJ-325 | Gold-Plated Traditional Peacock Nath · 109 | main | **P033** Gold Peacock Nath with Clear Stones · 109 · active |
| P492 | MJ-326 | Gold-Plated Peacock Nath, Ruby Red · 109 | main | **P032** Gold Peacock Nath with Pearl Drop · 109 · active |
| P493 | MJ-567 | Silver-Plated Floral Teardrop Nath · 109 | main | **P031** Silver-Plated Floral Teardrop Nath · 109 · active |
| P505 | MJ-611 | Emerald Green Glass Bangle Set · 299 | main | **P043** Emerald Green Glass Bangle Set · 299 · active |
| P506 | MJ-519 | Royal Purple Glass Bangle Set · 299 | main | **P042** Royal Purple Glass Bangle Set · 299 · active |
| P514 | MJ-281 | Gold Heart Locket Personalized Necklace · 450 | main (of 3 files) | **P003** Heart Floating Locket with Birthstone Charms · 450 · active |
| P560 | MJ-125 | Blue Tulip Anti-Tarnish Bracelet · 299 | main | **P040** Blue Tulip Bracelet · 299 · active |
| P561 | MJ-468 | Pink Tulip Anti-Tarnish Bracelet · 299 | main | **P039** Pink Tulip Bracelet · 299 · active |
| P562 | MJ-440 | Multicolour Tulip Anti-Tarnish Bracelet · 299 | main | **P038** Multicolour Tulip Bracelet · 299 · active |
| P563 | MJ-462 | Pink Flower Anti-Tarnish Bracelet · 299 | main | **P037** Pink Flower Bracelet · 299 · active |
| P578 | MJ-119 | Black Evil Eye Spiral Charm Anklet · 120 | main | **P045** Black Evil Eye Spiral Charm Anklet · 120 · active |
| P579 | MJ-142 | Clover Charm Gold Anti-Tarnish Anklet · 220 | main **and** extra-1 (internal dup) | **P046** Clover Charm Gold Anklet · 220 · active |
| P581 | MJ-556 | Silver Snake Chain Ball Anklet · 89 | main | **P044** Silver-Plated Snake Chain Ball Anklet · 89 · active |
| P582 | MJ-446 | Orange Enamel Floral Kada · 299 | main | **P036** Orange Enamel Floral Kada · 299 · active |
| P583 | MJ-469 | Pink Tulip Bow Hair Clip · 49 | main | **P047** Pink Tulip Bow Hair Clip · 49 · active |
| P618 | — | Vintage Gold Beaded Bracelet Watch · 499 | main | **P022** Vintage Gold Beaded Bracelet Watch · 499 · active |

Already known (repeated for completeness, not new): P148 main ↔ live P119 (₹59 vs ₹99,
review row 19) and P177 main ↔ live P121 (₹59 vs ₹99, review row 20).

**Consequences worth naming, still decision-free:**

1. **Several earlier cluster readings change complexion.** P405/P406 (band-A row 1, "the
   cleanest exclusion candidate") are each *also* byte-identical to a live legacy product's
   main — P014 and P013 respectively — so that pair may be two live products' queued twins,
   not one duplicate pair to collapse. Likewise the P400–P403 "colour family" (row 22) are
   the four live Solitaire Thread Rings P015–P018, and P371/P514 (row 23) are live P006/P003.
   The owner's curation of those rows should happen with this table in hand.
2. **A `public/products/staging/` anomaly surfaced as a side effect**: the three old
   `staging/P010-*.webp` files are byte-identical to *other* live products' images —
   `staging/P010-default.webp` = `P001.webp`, `staging/P010-Silver.webp` = `P003.webp`,
   `staging/P010-golden.webp` = `P007.webp` — i.e. they look like misnamed leftovers from
   an early staging pass, unrelated to the real P010 photos. Nothing references them; a
   cleanup decision for the owner, not taken here.
3. **Scan coverage note:** this pass compared queued files against `public/products/` only.
   Queued-vs-queued duplicates were already fully covered by the
   [72-group review](duplicate-photo-groups-review.md); together the two scans now cover
   every pairing that exists.
