# Duplicate-photo groups — curation review for the owner

**Date:** 2026-08-24 · **Status:** read-only report — no product excluded, merged or modified; no data file touched.

This is the owner-facing review of the **72 byte-identical photo groups (171 files)** that the
[post-pilot pipeline audit](../testing/RESULT-2026-08-24-pipeline-audit-post-pilot.md) found across
the 1,075 staged source photographs in `content-pipeline/incoming/2026-08-23-batch-01/`. The
question it answers: which queued products might be **genuine duplicate listings to exclude from
migration**, and which are **distinct designs that merely share a lazy or stock photo** and just
need their own photography eventually — the situation the 11 pilot products were treated as
(their copy was written off the photographs as 11 distinct designs, with the P106/P120 shared
photo recorded as [KI-001](known-issues-post-publish.md)).

**Method.** Every staged `.webp` was re-hashed (SHA-256) and grouped; product identity, title,
SKU, reference price and category come from each product's `raw-block.json`; the
duplicate-*title* findings come from the downloader export's `notes[]` in `draft-a-input.jsonl`
(the field Stage 0 drops — see the reconciliation RESULT, finding I-3). The hashing ran against
the pre-restructure `odoo-*/raw/` layout; the Part D restructure (images co-located under
`incoming/{batch}/PNNN/raw/`, the 11 published pilot bundles archived to
`content-pipeline/completed/PNNN/`) landed while this report was being written, and the findings
were re-verified against the new layout by spot-hash: identical bytes, identical groups —
1,062 files in `incoming/` + 13 in `completed/` = the same 1,075.
Everything reconciles with the audit exactly: 72 groups / 171 files, 17 main-image groups,
21 duplicate-title groups covering 54 products, and 10 of the 11 published pilot products with a
queued twin (P117 is the only pilot product without one).

## How to read the 72 groups

The 72 raw hash groups are not 72 curation decisions:

- **34 groups are internal to a single product** — the same photo appears twice *within one
  product's own image set* (its main duplicated as an extra, or an extra duplicated as a variant
  image). These are export artefacts, not duplicate listings; they are listed in §4 so the
  reviewer confirms only one copy per product, and they need no exclusion decision.
- **38 groups are cross-product**, and because several product pairs share more than one photo,
  they collapse to **24 product clusters**. Those 24 clusters are the actual curation worklist,
  and §1 ranks them by confidence.

## 1. The curation table — 24 clusters, highest-confidence duplicates first

Bands: **A** — very likely a true duplicate listing (strongest signals stacked); **B** — same
main photo at the same price with different names: could be a renamed duplicate or a distinct
design with a copied photo, genuinely needs the owner's eye; **C** — leans distinct design, but
the shared photo still has to be replaced before both listings are live; **D** — clearly
distinct designs sharing only secondary gallery shots: lowest priority, just need their own
photography eventually.

| # | Band | Products (id · SKU · original Odoo title · reference price · category) | What is shared | Also shares a title (export-flagged)? | Read |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **P405** MJ-433 — Minimalist Vintage Square Synthetic Gemstone Ring — ₹349 — rings<br>**P406** MJ-432 — Minimalist Vintage Square Synthetic Gemstone Ring — ₹349 — rings | 1 gallery photo | **yes** | Very likely duplicate listing. Identical title, byte-identical source descriptions (export-flagged), same price, adjacent SKUs, shared photo. The cleanest exclusion candidate in the batch. |
| 2 | A | **P267** MJ-090 — Anti-Tarnish Pink Diamond Pattern Kada — ₹299 — bracelets<br>**P268** MJ-089 — Anti-Tarnish Pink Diamond Pattern Kada — ₹299 — bracelets | 1 gallery photo | **yes** | Very likely duplicate listing. Identical title, byte-identical source descriptions (export-flagged), same price, adjacent SKUs, shared photo. |
| 3 | A | **P108** **[published]** MJ-508 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P135** MJ-159 — DC Jewelry Butterfly Duo Ring – Rosegold Finish &#124; Adjustable CZ Ring — ₹59 — rings | 1 main photo + 2 gallery photos | no | Very likely duplicate listing. Both products have exactly 3 photos and all 3 are byte-identical across the pair — the entire gallery is shared, at the same price. Titles differ (generic pilot name vs a descriptive "DC Jewelry" name), so the export title check missed it. P108 is already live. |
| 4 | A | **P354** MJ-419 — Minimal Watch Design Adjustable Ring for Girls — ₹199 — rings<br>**P360** MJ-420 — Minimal Watch Design Adjustable Ring for Girls (Pack of 1) — ₹199 — rings | 2 photos (one is P354's main) | no | Very likely duplicate listing. Titles identical except "(Pack of 1)", same price, adjacent SKUs, and they share two photos including P354's main. The parenthetical is the only reason the export title check missed this pair. |
| 5 | A | **P106** **[published]** MJ-504 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P120** **[published]** MJ-501 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P160** MJ-252 — Floral Cluster CZ Gold-Plated Adjustable Ring — ₹59 — rings | 1 main photo | **yes** | KI-001, now three-way. P106/P120 (both live) are the export-flagged identical-title, byte-identical-description, identical-main-photo pair already recorded as KI-001. Queued P160 has the same main photo at the same price under a different title — and it is P160's only photo. |
| 6 | B | **P115** **[published]** MJ-505 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P141** MJ-183 — DC Jewelry Rose Gold Band CZ Adjustable Ring — ₹59 — rings<br>**P167** MJ-138 — Classic Eternity Band CZ Gold-Plated Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Three ring listings, one main photo, all ₹59. Names differ. P115 is live. |
| 7 | B | **P110** **[published]** MJ-499 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P146** MJ-195 — DC Jewelry X-Shape Rose Gold Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ; P110 is live. |
| 8 | B | **P109** **[published]** MJ-500 — Rose Gold Plated American Diamond Ring — ₹99 — rings<br>**P159** MJ-448 — Oval Halo Swirl CZ Gold-Plated Ring — ₹99 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ; P109 is live. |
| 9 | B | **P118** **[published]** MJ-506 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P144** MJ-184 — DC Jewelry Rose Gold Heart Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ; P118 is live. |
| 10 | B | **P122** **[published]** MJ-503 — Rose Gold Plated American Diamond Ring — ₹59 — rings<br>**P149** MJ-160 — DC Jewelry Classic Round Solitaire Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ; P122 is live. |
| 11 | B | **P219** MJ-045 — Anti Tarnish Lover Ring — ₹249 — rings<br>**P231** MJ-039 — Anti Tarnish Infinity Glam Ring — ₹249 — rings | 1 main photo + 1 gallery photo | no | Same main photo + a gallery photo, same price — needs eyes. Two shared photos (main and an extra). Names differ. |
| 12 | B | **P114** MJ-216 — Double Butterfly Wing Silver-Plated Ring — ₹59 — rings<br>**P142** MJ-186 — DC Jewelry Silver Dolphin Tail & Heart Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ (butterfly vs dolphin motifs described). |
| 13 | B | **P116** MJ-163 — DC Jewelry Dainty Flower Adjustable Ring — ₹59 — rings<br>**P128** MJ-181 — DC Jewelry Petal Shine Finger Ring – Rosegold &#124; Adjustable American Diamond Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Both "DC Jewelry" flower rings under different names. |
| 14 | B | **P136** MJ-188 — DC Jewelry Sparkling Criss-Cross Ring – Rosegold Polish &#124; Adjustable AD Finger Ring — ₹59 — rings<br>**P168** MJ-262 — Geometric T-Bar CZ Gold-Plated Adjustable Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ. |
| 15 | B | **P138** MJ-176 — DC Jewelry Mirror Drop Oval Ring – Designer Statement Ring with CZ & Bead Charm — ₹59 — rings<br>**P157** MJ-149 — Cowrie Shell CZ Gold-Plated Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names differ. |
| 16 | B | **P150** MJ-175 — DC Jewelry Minimalist Open Bar Ring — ₹59 — rings<br>**P171** MJ-116 — Bar & Pebble CZ Gold-Plated Minimalist Ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. Names describe the same motif (minimalist open-bar ring) in different words. |
| 17 | B | **P169** MJ-606 — Twin Rose Design Gold-Plated Adjustable Ring — ₹59 — rings<br>**P179** MJ-197 — DC Jewelry double rose adjustable ring — ₹59 — rings | 1 main photo | no | Same main photo, same price — needs eyes. "Twin Rose" and "double rose" — the two names describe the same motif. |
| 18 | C | **P225** MJ-073 — Anti-Tarnish Infinity Link Ring — ₹249 — rings<br>**P237** MJ-075 — Anti-Tarnish Linked Infinity Ring — ₹249 — rings | 2 gallery photos | no | Leans distinct, but the names are permutations. "Anti-Tarnish Infinity Link Ring" vs "Anti-Tarnish Linked Infinity Ring", same price, adjacent SKUs, two shared gallery photos — but the main photos differ, which is the strongest evidence they are two designs. |
| 19 | C | **P119** **[published]** MJ-502 — Rose Gold Plated American Diamond Ring — ₹99 — rings<br>**P148** MJ-185 — DC Jewelry Round Stone Adjustable Ring — ₹59 — rings | 1 main photo | no | Leans distinct design (price differs), photo still shared as main. Same main photo but ₹99 vs ₹59 and clearly different names. The queued twin still cannot ship with this photo while P119 is live. |
| 20 | C | **P121** **[published]** MJ-509 — Rose Gold Plated American Diamond Ring — ₹99 — *(null)*<br>**P177** MJ-196 — DC Jewelry butterfly adjustable ring — ₹59 — rings | 1 main photo | no | Leans distinct design (price differs), photo still shared as main. Same main photo, ₹99 vs ₹59, different names. P121 is live; P121's raw block also still carries `category: null` (resolved to rings in its published record). |
| 21 | C | **P294** MJ-157 — Cute Multi-Charm Necklace — ₹259 — necklaces<br>**P309** MJ-256 — Floral Heart Locket Necklace — ₹218 — necklaces | 1 main photo | no | Leans distinct design (price differs), photo still shared as main. Same main photo, ₹259 vs ₹218, different names and different necklace designs described. |
| 22 | D | **P400** MJ-428 — Minimalist Stainless Steel Ring with Green Crystal Stone — ₹210 — rings<br>**P401** MJ-431 — Minimalist Stainless Steel Ring with White Crystal Stone — ₹210 — rings<br>**P402** MJ-430 — Minimalist Stainless Steel Ring with White Crystal Red — ₹210 — rings<br>**P403** MJ-429 — Minimalist Stainless Steel Ring with White Crystal Pink — ₹210 — rings | 9 gallery photos | no | Distinct colour family sharing gallery shots. Four colour variants of one steel ring design; mains differ, names differ only by stone colour, and they share nine lifestyle/gallery shots (one of them staged twice in every product's gallery). Not duplicates — if anything, a candidate for one product with a colour option rather than four listings (owner call). |
| 23 | D | **P371** MJ-251 — Floating Teardrop Locket (Without Charm) — ₹450 — necklaces<br>**P514** MJ-281 — Gold Heart Locket Personalized Necklace — ₹450 — necklaces<br>**P515** MJ-291 — Gold Oval Locket Personalized Necklace — ₹450 — necklaces | 2 gallery photos | no | Distinct designs sharing gallery shots. Three different lockets sharing two gallery photos (likely chain/packaging shots); mains differ. |
| 24 | D | **P551** MJ-035 — Anti Tarnish Gold CZ Tennis Bracelet for Women — ₹249 — bracelets<br>**P556** MJ-030 — Anti Tarnish Dainty Gold CZ Tennis Bracelet — ₹289 — bracelets | 1 gallery photo | no | Distinct designs sharing a gallery shot. Different names *and* different prices; only an extra is shared. |

## 2. Cross-reference against the 21 duplicate-title groups (54 products)

The downloader export flagged 21 groups of duplicate titles. **Sharing a photo *and* a title is
the strongest true-duplicate signal, and it occurs in exactly 3 of the 21 groups** — P405/P406,
P267/P268 and P106/P120 (inside the 11-product pilot ring group), which is why those clusters
top the table above. The other 18 title groups share **no** photo: two listings with the same
title but different photographs are far more plausibly two similar-but-distinct designs given a
lazy title, the mirror image of band D.

| Title group (products) | Shared title | Descriptions byte-identical? | Also shares a photo? |
| --- | --- | --- | --- |
| P106, P108, P109, P110, P115, P117, P118, P119, P120, P121, P122 | Rose Gold Plated American Diamond Ring | yes | **P106, P120** |
| P267, P268 | Anti-Tarnish Pink Diamond Pattern Kada | yes | **P267, P268** |
| P405, P406 | Minimalist Vintage Square Synthetic Gemstone Ring | yes | **P405, P406** |
| P102, P380 | Love Charm | no | no |
| P125, P126 | DC Jewelry Floral Elegance Ring – Rosegold Finish &#124; Premium AD Adjustable Ring | yes | no |
| P210, P211 | Anti Tarnish Rose Gold-Plated Bracelet | yes | no |
| P212, P279, P282 | Twisted Crystal Kangan (2 piece) | no | no |
| P216, P312 | Pink Rain Drop Glass Bangles (12 Piece) | no | no |
| P223, P236 | Anti Tarnish Ring | yes | no |
| P250, P262 | Anti-Tarnish Multi-Color Bamboo Style Kada | no | no |
| P255, P270 | Anti-Tarnish Pink Bamboo Style Kada | no | no |
| P329, P332 | Black Stone Silver Ring | no | no |
| P335, P336, P337 | Trendy Fashion Rings for Women | yes | no |
| P356, P357 | Minimal Thin Band Gold Ring for Girls | yes | no |
| P395, P396, P397 | Luxurious Tulip Flower Bracelet | yes | no |
| P447, P449 | Silver Heart Evil Eye Bracelet | yes | no |
| P451, P462 | Gold Heartbeat Lifeline Bracelet | no | no |
| P588, P589 | Satin Scrunchies Set of 4 | no | no |
| P606, P608 | Traditional Meenakari Bracelet Watch for Women | no | no |
| P610, P620 | Vintage Anti-Tarnish Gold Red Dial Bracelet Watch for Women | no | no |
| P613, P614 | Vintage Anti-Tarnish Gold Green Dial Bracelet Watch for Women | no | no |

*(The pilot ring group's row lists all 11 published products; only P106/P120 within it share a
photo with each other — the other nine share their photos with **queued** products instead, which
is what fills band B above.)*

## 3. What the owner should look at first — the short version

1. **Band A, rows 1–5.** Four of the five are near-certain duplicate listings (rows 1–2 stack
   every signal: identical title + byte-identical description + same price + shared photo; row 3
   — P108/P135 — shares its *entire three-photo gallery*; row 4 differs only by "(Pack of 1)").
   Excluding the queued half of each would remove **5 queued products** (P406 or P405, P268 or
   P267, P135, P360 or P354, P160). Row 5 extends the already-open KI-001 decision to a third
   listing.
2. **Band B, rows 6–17 (12 clusters, 25 products, all rings, each cluster at a single price).** Every one is
   a rerun of the KI-001 conversation: identical main photo, identical price, different names.
   Five clusters pair a **live** pilot product with a queued twin — those are time-sensitive,
   because publishing the twin as-is puts two live listings with the same photo on the
   storefront. Rows 11 and 16–17 (two shared photos / motif-synonym names) deserve the first
   look inside the band.
3. **Bands C–D, rows 18–24.** Leaning or clearly distinct designs; nothing to exclude, but every
   shared *main* photo (rows 19–21) still needs replacement photography before the queued twin
   ships, and row 22 (P400–P403) is a candidate for one product with a colour option rather than
   four listings — an owner call, not a duplicate.

A useful asymmetry while reviewing band B: the pilot showed that these photos are the *only*
real per-product differentiator in the ₹59/₹99 ring population (descriptions were byte-identical
across all 11). Where the queued twin's *name* describes the photographed design and the live
pilot product's name is the generic "Rose Gold Plated American Diamond Ring", the two records
may be one physical product listed twice — once in the generic drop, once under its descriptive
name.

## 4. The 34 within-product groups (no curation decision — listed for completeness)

Each row is one product whose own image set contains byte-identical files. If every suggestion
is later confirmed as-is, the storefront gallery would show the same photo twice; where the
duplicate is a `variant` file, the variant image is not actually distinct from the general
gallery. To be handled at each product's normal image-review step, not now.

| Product | SKU | Title | Internal dup groups | Identical file pairs |
| --- | --- | --- | --- | --- |
| **P253** | MJ-084 | Anti-Tarnish Orange Floral Enamel Kada | 1 | extra-3.webp=main.webp |
| **P255** | MJ-088 | Anti-Tarnish Pink Bamboo Style Kada | 1 | extra-3.webp=main.webp |
| **P265** | MJ-093 | Anti-Tarnish Pink Leaf Pattern Kada | 1 | extra-1.webp=main.webp |
| **P268** | MJ-089 | Anti-Tarnish Pink Diamond Pattern Kada | 1 | extra-3.webp=main.webp |
| **P273** | MJ-076 | Anti-Tarnish Maroon Chevron Enamel Kada | 1 | extra-1.webp=main.webp |
| **P285** | MJ-395 | Light Golden Transparent Glass Bangles | 2 | extra-1.webp=extra-2.webp=main.webp; extra-3.webp=extra-4.webp |
| **P286** | MJ-598 | Transparent Golden Glass Stone Bangles | 1 | extra-1.webp=main.webp |
| **P287** | MJ-444 | Olive Green Glass Stone Bangles | 1 | extra-1.webp=main.webp |
| **P288** | MJ-222 | Dual-Tone Glass Stone Bangles | 1 | extra-1.webp=main.webp |
| **P289** | MJ-450 | Pastel Green Antique Glass Bangle Set | 1 | extra-1.webp=main.webp |
| **P304** | MJ-616 | Vintage-Inspired Key Pendant Necklace | 1 | extra-1.webp=main.webp |
| **P326** | MJ-568 | Silver-Plated Pink Drop Earrings with CZ Stones | 1 | extra-1.webp=main.webp |
| **P361** | MJ-240 | Elegant Silver Knot Adjustable Ring for Women & Girls | 1 | extra-2.webp=main.webp |
| **P365** | MJ-347 | Infinity Necklace Bracelet Ring Set | 1 | extra-1.webp=main.webp |
| **P370** | MJ-293 | Gold Plated Anti Tarnish Nail Bracelet For Women | 1 | extra-2.webp=extra-3.webp |
| **P371** | MJ-251 | Floating Teardrop Locket (Without Charm) | 1 | extra-5.webp=extra-6.webp |
| **P407** | — | Brass Initial Letter adjustable ring | 1 | extra-18.webp=variant-s.webp |
| **P408** | — | Brass Initial Letter adjustable ring (Silver) | 2 | extra-1.webp=main.webp; extra-2.webp=variant-b.webp |
| **P544** | MJ-126 | Blush Crystal Vine Bracelet | 1 | extra-1.webp=main.webp |
| **P579** | MJ-142 | Clover Charm Gold Anti-Tarnish Anklet | 1 | extra-1.webp=main.webp |
| **P586** | MJ-523 | Satin Rose Flower Hair Tie | 5 | extra-1.webp=variant-dusty-mauve.webp; extra-4.webp=variant-pearl-champagne.webp; extra-2.webp=variant-champagne-gold.webp; extra-3.webp=variant-classic-black.webp; extra-5.webp=variant-wine-red.webp |
| **P587** | MJ-522 | Satin Long Tail Bow Hair Clip | 4 | extra-2.webp=variant-lilac-shimmer.webp; extra-1.webp=main.webp; extra-4.webp=variant-cream-shimmer.webp; extra-3.webp=variant-antique-gold.webp |
| **P590** | MJ-392 | Layered Satin Bow Hair Clip | 3 | extra-1.webp=variant-white.webp; extra-3.webp=variant-pink.webp; extra-2.webp=variant-black.webp |

## Appendix — all 72 hash groups in full

Every product in every group, per the task's completeness requirement. Groups sorted
cross-product first, then internal; `hash` is the first 12 hex chars of the SHA-256.

| Group | Hash | Kind | Product | SKU | Original Odoo title | Ref. price | Category | Matching file(s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `e57b58789e5b` | cross-product | **P106** **[published]** | MJ-504 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 1 | `e57b58789e5b` | cross-product | **P120** **[published]** | MJ-501 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 1 | `e57b58789e5b` | cross-product | **P160** | MJ-252 | Floral Cluster CZ Gold-Plated Adjustable Ring | ₹59 | rings | main.webp |
| 2 | `5bf653e67f2f` | cross-product | **P108** **[published]** | MJ-508 | Rose Gold Plated American Diamond Ring | ₹59 | rings | extra-1.webp |
| 2 | `5bf653e67f2f` | cross-product | **P135** | MJ-159 | DC Jewelry Butterfly Duo Ring – Rosegold Finish &#124; Adjustable CZ Ring | ₹59 | rings | extra-1.webp |
| 3 | `c77ab9aea310` | cross-product | **P108** **[published]** | MJ-508 | Rose Gold Plated American Diamond Ring | ₹59 | rings | extra-2.webp |
| 3 | `c77ab9aea310` | cross-product | **P135** | MJ-159 | DC Jewelry Butterfly Duo Ring – Rosegold Finish &#124; Adjustable CZ Ring | ₹59 | rings | extra-2.webp |
| 4 | `65cc9c9c0f75` | cross-product | **P108** **[published]** | MJ-508 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 4 | `65cc9c9c0f75` | cross-product | **P135** | MJ-159 | DC Jewelry Butterfly Duo Ring – Rosegold Finish &#124; Adjustable CZ Ring | ₹59 | rings | main.webp |
| 5 | `6bdb4922c7d8` | cross-product | **P109** **[published]** | MJ-500 | Rose Gold Plated American Diamond Ring | ₹99 | rings | main.webp |
| 5 | `6bdb4922c7d8` | cross-product | **P159** | MJ-448 | Oval Halo Swirl CZ Gold-Plated Ring | ₹99 | rings | main.webp |
| 6 | `00f5bb206b4c` | cross-product | **P110** **[published]** | MJ-499 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 6 | `00f5bb206b4c` | cross-product | **P146** | MJ-195 | DC Jewelry X-Shape Rose Gold Ring | ₹59 | rings | main.webp |
| 7 | `592ee08d01dc` | cross-product | **P114** | MJ-216 | Double Butterfly Wing Silver-Plated Ring | ₹59 | rings | main.webp |
| 7 | `592ee08d01dc` | cross-product | **P142** | MJ-186 | DC Jewelry Silver Dolphin Tail & Heart Ring | ₹59 | rings | main.webp |
| 8 | `403e42f4c3d2` | cross-product | **P115** **[published]** | MJ-505 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 8 | `403e42f4c3d2` | cross-product | **P141** | MJ-183 | DC Jewelry Rose Gold Band CZ Adjustable Ring | ₹59 | rings | main.webp |
| 8 | `403e42f4c3d2` | cross-product | **P167** | MJ-138 | Classic Eternity Band CZ Gold-Plated Ring | ₹59 | rings | main.webp |
| 9 | `c16deeb9da73` | cross-product | **P116** | MJ-163 | DC Jewelry Dainty Flower Adjustable Ring | ₹59 | rings | main.webp |
| 9 | `c16deeb9da73` | cross-product | **P128** | MJ-181 | DC Jewelry Petal Shine Finger Ring – Rosegold &#124; Adjustable American Diamond Ring | ₹59 | rings | main.webp |
| 10 | `bcc9a87f2f70` | cross-product | **P118** **[published]** | MJ-506 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 10 | `bcc9a87f2f70` | cross-product | **P144** | MJ-184 | DC Jewelry Rose Gold Heart Ring | ₹59 | rings | main.webp |
| 11 | `75e905b0c8a0` | cross-product | **P119** **[published]** | MJ-502 | Rose Gold Plated American Diamond Ring | ₹99 | rings | main.webp |
| 11 | `75e905b0c8a0` | cross-product | **P148** | MJ-185 | DC Jewelry Round Stone Adjustable Ring | ₹59 | rings | main.webp |
| 12 | `e8e9fe7aa0a9` | cross-product | **P121** **[published]** | MJ-509 | Rose Gold Plated American Diamond Ring | ₹99 | *(null)* | main.webp |
| 12 | `e8e9fe7aa0a9` | cross-product | **P177** | MJ-196 | DC Jewelry butterfly adjustable ring | ₹59 | rings | main.webp |
| 13 | `0b1a0cbccb13` | cross-product | **P122** **[published]** | MJ-503 | Rose Gold Plated American Diamond Ring | ₹59 | rings | main.webp |
| 13 | `0b1a0cbccb13` | cross-product | **P149** | MJ-160 | DC Jewelry Classic Round Solitaire Ring | ₹59 | rings | main.webp |
| 14 | `fc0b6c949b98` | cross-product | **P136** | MJ-188 | DC Jewelry Sparkling Criss-Cross Ring – Rosegold Polish &#124; Adjustable AD Finger Ring | ₹59 | rings | main.webp |
| 14 | `fc0b6c949b98` | cross-product | **P168** | MJ-262 | Geometric T-Bar CZ Gold-Plated Adjustable Ring | ₹59 | rings | main.webp |
| 15 | `cfbf3f0f9290` | cross-product | **P138** | MJ-176 | DC Jewelry Mirror Drop Oval Ring – Designer Statement Ring with CZ & Bead Charm | ₹59 | rings | main.webp |
| 15 | `cfbf3f0f9290` | cross-product | **P157** | MJ-149 | Cowrie Shell CZ Gold-Plated Ring | ₹59 | rings | main.webp |
| 16 | `420a9c6854eb` | cross-product | **P150** | MJ-175 | DC Jewelry Minimalist Open Bar Ring | ₹59 | rings | main.webp |
| 16 | `420a9c6854eb` | cross-product | **P171** | MJ-116 | Bar & Pebble CZ Gold-Plated Minimalist Ring | ₹59 | rings | main.webp |
| 17 | `182e7d073dc6` | cross-product | **P169** | MJ-606 | Twin Rose Design Gold-Plated Adjustable Ring | ₹59 | rings | main.webp |
| 17 | `182e7d073dc6` | cross-product | **P179** | MJ-197 | DC Jewelry double rose adjustable ring | ₹59 | rings | main.webp |
| 18 | `28f1171ceb78` | cross-product | **P219** | MJ-045 | Anti Tarnish Lover Ring | ₹249 | rings | extra-1.webp |
| 18 | `28f1171ceb78` | cross-product | **P231** | MJ-039 | Anti Tarnish Infinity Glam Ring | ₹249 | rings | extra-1.webp |
| 19 | `16250095e30b` | cross-product | **P219** | MJ-045 | Anti Tarnish Lover Ring | ₹249 | rings | main.webp |
| 19 | `16250095e30b` | cross-product | **P231** | MJ-039 | Anti Tarnish Infinity Glam Ring | ₹249 | rings | main.webp |
| 20 | `1bc3845e22f3` | cross-product | **P225** | MJ-073 | Anti-Tarnish Infinity Link Ring | ₹249 | rings | extra-1.webp |
| 20 | `1bc3845e22f3` | cross-product | **P237** | MJ-075 | Anti-Tarnish Linked Infinity Ring | ₹249 | rings | extra-1.webp |
| 21 | `c9a458350b40` | cross-product | **P225** | MJ-073 | Anti-Tarnish Infinity Link Ring | ₹249 | rings | extra-2.webp |
| 21 | `c9a458350b40` | cross-product | **P237** | MJ-075 | Anti-Tarnish Linked Infinity Ring | ₹249 | rings | extra-2.webp |
| 22 | `a445753e8bba` | cross-product | **P267** | MJ-090 | Anti-Tarnish Pink Diamond Pattern Kada | ₹299 | bracelets | extra-1.webp |
| 22 | `a445753e8bba` | cross-product | **P268** | MJ-089 | Anti-Tarnish Pink Diamond Pattern Kada | ₹299 | bracelets | extra-1.webp |
| 23 | `38dd272ec10b` | cross-product | **P294** | MJ-157 | Cute Multi-Charm Necklace | ₹259 | necklaces | main.webp |
| 23 | `38dd272ec10b` | cross-product | **P309** | MJ-256 | Floral Heart Locket Necklace | ₹218 | necklaces | main.webp |
| 24 | `eb37f7ab1a38` | cross-product | **P354** | MJ-419 | Minimal Watch Design Adjustable Ring for Girls | ₹199 | rings | main.webp |
| 24 | `eb37f7ab1a38` | cross-product | **P360** | MJ-420 | Minimal Watch Design Adjustable Ring for Girls (Pack of 1) | ₹199 | rings | extra-1.webp |
| 25 | `f879d193b201` | cross-product | **P354** | MJ-419 | Minimal Watch Design Adjustable Ring for Girls | ₹199 | rings | extra-1.webp |
| 25 | `f879d193b201` | cross-product | **P360** | MJ-420 | Minimal Watch Design Adjustable Ring for Girls (Pack of 1) | ₹199 | rings | extra-3.webp |
| 26 | `3ac4b57469a0` | cross-product | **P371** | MJ-251 | Floating Teardrop Locket (Without Charm) | ₹450 | necklaces | extra-1.webp |
| 26 | `3ac4b57469a0` | cross-product | **P514** | MJ-281 | Gold Heart Locket Personalized Necklace | ₹450 | necklaces | extra-1.webp |
| 26 | `3ac4b57469a0` | cross-product | **P515** | MJ-291 | Gold Oval Locket Personalized Necklace | ₹450 | necklaces | extra-1.webp |
| 27 | `41b344bf4457` | cross-product | **P371** | MJ-251 | Floating Teardrop Locket (Without Charm) | ₹450 | necklaces | extra-2.webp |
| 27 | `41b344bf4457` | cross-product | **P514** | MJ-281 | Gold Heart Locket Personalized Necklace | ₹450 | necklaces | extra-2.webp |
| 27 | `41b344bf4457` | cross-product | **P515** | MJ-291 | Gold Oval Locket Personalized Necklace | ₹450 | necklaces | extra-2.webp |
| 28 | `5221a99506b3` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-1.webp |
| 28 | `5221a99506b3` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-1.webp |
| 28 | `5221a99506b3` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-1.webp |
| 28 | `5221a99506b3` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-1.webp |
| 29 | `2e3dbaca8cc6` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-3.webp |
| 29 | `2e3dbaca8cc6` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-3.webp |
| 29 | `2e3dbaca8cc6` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-3.webp |
| 29 | `2e3dbaca8cc6` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-3.webp |
| 30 | `65dd6113dc67` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-10.webp |
| 30 | `65dd6113dc67` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-10.webp |
| 30 | `65dd6113dc67` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-10.webp |
| 30 | `65dd6113dc67` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-10.webp |
| 31 | `6db7d9bc2a19` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-2.webp |
| 31 | `6db7d9bc2a19` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-2.webp |
| 31 | `6db7d9bc2a19` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-2.webp |
| 31 | `6db7d9bc2a19` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-2.webp |
| 32 | `6a1dfe0510fc` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-7.webp |
| 32 | `6a1dfe0510fc` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-7.webp |
| 32 | `6a1dfe0510fc` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-7.webp |
| 32 | `6a1dfe0510fc` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-7.webp |
| 33 | `16c0f02116f6` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-4.webp, extra-5.webp |
| 33 | `16c0f02116f6` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-4.webp, extra-5.webp |
| 33 | `16c0f02116f6` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-4.webp, extra-5.webp |
| 33 | `16c0f02116f6` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-4.webp, extra-5.webp |
| 34 | `94246533c658` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-9.webp |
| 34 | `94246533c658` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-9.webp |
| 34 | `94246533c658` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-9.webp |
| 34 | `94246533c658` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-9.webp |
| 35 | `de8c332251c2` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-8.webp |
| 35 | `de8c332251c2` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-8.webp |
| 35 | `de8c332251c2` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-8.webp |
| 35 | `de8c332251c2` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-8.webp |
| 36 | `be2fd870413f` | cross-product | **P400** | MJ-428 | Minimalist Stainless Steel Ring with Green Crystal Stone | ₹210 | rings | extra-6.webp |
| 36 | `be2fd870413f` | cross-product | **P401** | MJ-431 | Minimalist Stainless Steel Ring with White Crystal Stone | ₹210 | rings | extra-6.webp |
| 36 | `be2fd870413f` | cross-product | **P402** | MJ-430 | Minimalist Stainless Steel Ring with White Crystal Red | ₹210 | rings | extra-6.webp |
| 36 | `be2fd870413f` | cross-product | **P403** | MJ-429 | Minimalist Stainless Steel Ring with White Crystal Pink | ₹210 | rings | extra-6.webp |
| 37 | `d0e7440e35e9` | cross-product | **P405** | MJ-433 | Minimalist Vintage Square Synthetic Gemstone Ring | ₹349 | rings | extra-1.webp |
| 37 | `d0e7440e35e9` | cross-product | **P406** | MJ-432 | Minimalist Vintage Square Synthetic Gemstone Ring | ₹349 | rings | extra-1.webp |
| 38 | `2b42bbda2cb3` | cross-product | **P551** | MJ-035 | Anti Tarnish Gold CZ Tennis Bracelet for Women | ₹249 | bracelets | extra-1.webp |
| 38 | `2b42bbda2cb3` | cross-product | **P556** | MJ-030 | Anti Tarnish Dainty Gold CZ Tennis Bracelet | ₹289 | bracelets | extra-1.webp |
| 39 | `60771d654022` | internal | **P253** | MJ-084 | Anti-Tarnish Orange Floral Enamel Kada | ₹299 | bracelets | extra-3.webp, main.webp |
| 40 | `52a9ba036fa1` | internal | **P255** | MJ-088 | Anti-Tarnish Pink Bamboo Style Kada | ₹299 | bracelets | extra-3.webp, main.webp |
| 41 | `f33880aecb7f` | internal | **P265** | MJ-093 | Anti-Tarnish Pink Leaf Pattern Kada | ₹299 | bracelets | extra-1.webp, main.webp |
| 42 | `cba5013bce77` | internal | **P268** | MJ-089 | Anti-Tarnish Pink Diamond Pattern Kada | ₹299 | bracelets | extra-3.webp, main.webp |
| 43 | `5385fe6166be` | internal | **P273** | MJ-076 | Anti-Tarnish Maroon Chevron Enamel Kada | ₹299 | bracelets | extra-1.webp, main.webp |
| 44 | `29447810d74b` | internal | **P285** | MJ-395 | Light Golden Transparent Glass Bangles | ₹189 | bangles | extra-1.webp, extra-2.webp, main.webp |
| 45 | `480126b65680` | internal | **P285** | MJ-395 | Light Golden Transparent Glass Bangles | ₹189 | bangles | extra-3.webp, extra-4.webp |
| 46 | `b376cb7480f1` | internal | **P286** | MJ-598 | Transparent Golden Glass Stone Bangles | ₹189 | bangles | extra-1.webp, main.webp |
| 47 | `fd87ddd75791` | internal | **P287** | MJ-444 | Olive Green Glass Stone Bangles | ₹189 | bangles | extra-1.webp, main.webp |
| 48 | `c809acf405df` | internal | **P288** | MJ-222 | Dual-Tone Glass Stone Bangles | ₹149 | bangles | extra-1.webp, main.webp |
| 49 | `8b228430a91e` | internal | **P289** | MJ-450 | Pastel Green Antique Glass Bangle Set | ₹149 | bangles | extra-1.webp, main.webp |
| 50 | `c1933086dd19` | internal | **P304** | MJ-616 | Vintage-Inspired Key Pendant Necklace | ₹214 | pendants | extra-1.webp, main.webp |
| 51 | `0f20d2499080` | internal | **P326** | MJ-568 | Silver-Plated Pink Drop Earrings with CZ Stones | ₹150 | earrings | extra-1.webp, main.webp |
| 52 | `908206791d8b` | internal | **P361** | MJ-240 | Elegant Silver Knot Adjustable Ring for Women & Girls | ₹210 | rings | extra-2.webp, main.webp |
| 53 | `b744b16c7bf9` | internal | **P365** | MJ-347 | Infinity Necklace Bracelet Ring Set | ₹250 | necklaces | extra-1.webp, main.webp |
| 54 | `f6374d7a2c9e` | internal | **P370** | MJ-293 | Gold Plated Anti Tarnish Nail Bracelet For Women | ₹175 | *(null)* | extra-2.webp, extra-3.webp |
| 55 | `eb3673f8f794` | internal | **P371** | MJ-251 | Floating Teardrop Locket (Without Charm) | ₹450 | necklaces | extra-5.webp, extra-6.webp |
| 56 | `6eef0f15dc99` | internal | **P407** | — | Brass Initial Letter adjustable ring | ₹210 | *(null)* | extra-18.webp, variant-s.webp |
| 57 | `47b483070d1f` | internal | **P408** | — | Brass Initial Letter adjustable ring (Silver) | ₹199 | *(null)* | extra-1.webp, main.webp |
| 58 | `b389781403fa` | internal | **P408** | — | Brass Initial Letter adjustable ring (Silver) | ₹199 | *(null)* | extra-2.webp, variant-b.webp |
| 59 | `87a1be7712aa` | internal | **P544** | MJ-126 | Blush Crystal Vine Bracelet | ₹299 | bracelets | extra-1.webp, main.webp |
| 60 | `5bfe415259e0` | internal | **P579** | MJ-142 | Clover Charm Gold Anti-Tarnish Anklet | ₹220 | anklets | extra-1.webp, main.webp |
| 61 | `bce2a4eb7ef3` | internal | **P586** | MJ-523 | Satin Rose Flower Hair Tie | ₹69 | hair-accessories | extra-1.webp, variant-dusty-mauve.webp |
| 62 | `c12c980608d1` | internal | **P586** | MJ-523 | Satin Rose Flower Hair Tie | ₹69 | hair-accessories | extra-4.webp, variant-pearl-champagne.webp |
| 63 | `73a6962d4e09` | internal | **P586** | MJ-523 | Satin Rose Flower Hair Tie | ₹69 | hair-accessories | extra-2.webp, variant-champagne-gold.webp |
| 64 | `bbde3bd41ccd` | internal | **P586** | MJ-523 | Satin Rose Flower Hair Tie | ₹69 | hair-accessories | extra-3.webp, variant-classic-black.webp |
| 65 | `01810e67d1ec` | internal | **P586** | MJ-523 | Satin Rose Flower Hair Tie | ₹69 | hair-accessories | extra-5.webp, variant-wine-red.webp |
| 66 | `cbf0408e6fd7` | internal | **P587** | MJ-522 | Satin Long Tail Bow Hair Clip | ₹129 | hair-accessories | extra-2.webp, variant-lilac-shimmer.webp |
| 67 | `be14ba5ae4f3` | internal | **P587** | MJ-522 | Satin Long Tail Bow Hair Clip | ₹129 | hair-accessories | extra-1.webp, main.webp |
| 68 | `d147aa6c35c5` | internal | **P587** | MJ-522 | Satin Long Tail Bow Hair Clip | ₹129 | hair-accessories | extra-4.webp, variant-cream-shimmer.webp |
| 69 | `37ff2028bc76` | internal | **P587** | MJ-522 | Satin Long Tail Bow Hair Clip | ₹129 | hair-accessories | extra-3.webp, variant-antique-gold.webp |
| 70 | `c86b874ca0ca` | internal | **P590** | MJ-392 | Layered Satin Bow Hair Clip | ₹79 | hair-accessories | extra-1.webp, variant-white.webp |
| 71 | `8bc9ec5fc556` | internal | **P590** | MJ-392 | Layered Satin Bow Hair Clip | ₹79 | hair-accessories | extra-3.webp, variant-pink.webp |
| 72 | `fa997a5326fc` | internal | **P590** | MJ-392 | Layered Satin Bow Hair Clip | ₹79 | hair-accessories | extra-2.webp, variant-black.webp |
