# Source data notes — `Latest.xlsx`

Observations made while extracting the material/plating/stone phrases in
[`material-phrase-candidates.md`](material-phrase-candidates.md). Everything here is
**flagged, not acted on**. The source text was not edited, normalised or corrected, and no
claim below has been judged for accuracy or for honesty-policy compliance.

## 1. Data-quality noise

| Row | What is in the text | Note |
| --- | --- | --- |
| 3 | `Adorned with Synthetic Synthetic Synthetic Zircon` | Word repeated three times. Captured verbatim as the phrase `Synthetic Synthetic Synthetic Zircon` rather than collapsed, so the noise stays visible in the candidate table. |
| 80 | `Rose Gold Gold-Tone Acrylic Bangle` | `Gold Gold` adjacency. Captured verbatim. |
| 165 | `Pink Pink` | Word repeated. |
| 236 | `Stainless Steel Gold Plated Stainless Steel Anti Tarnish Nail Bracelet` | The material is stated twice in one span, producing the longest phrase in the table. |

Beyond individual rows: the export mixes at least three copy formats — free prose, labelled
spec blocks (`Material:` / `Plating:` / `Stone Type:`), and emoji-bulleted highlight lists —
sometimes within the same row. Capitalisation is inconsistent across all of them
(`Gold-Plated`, `Gold-plated`, `gold-plated`, `gold plating` all occur), which is why the
candidate table has more rows than there are distinct ideas in it. Collapsing those is a
decision for the allow-list, not for the extraction.

## 2. Other honesty-relevant patterns noticed

These are **outside** the material-phrase question and no action was taken on any of them.
Counts are rows, not occurrences, and are taken over the 492 product rows only — the two
policy notices and the fifty empty rows are excluded.

| Pattern | Rows | Example rows | Note |
| --- | --- | --- | --- |
| Karat claims on plated items | 47 | 4, 10, 11, 22, 28, 29 | `18K gold-plated stainless steel` and `18K Gold-Plated` appear as *plating* values, not as gold content. A karat number next to a plated finish is the classic place where a listing reads as solid gold to a shopper. |
| Steel grade `316L` | 8 | 108, 109, 110, 169, 368, 432 | A specific alloy grade. Verifiable or not, it is a factual claim about the metal. |
| `real` / `genuine` / `authentic` | 5 | 92, 270, 335, 339, 342 | Includes at least one `real gold` phrase in the candidate table. |
| `natural` | 5 | 300, 301, 306, 398, 491 | Mostly `natural elegance` style copy rather than a stone claim, but it is the same word an allow-list would have to disambiguate. |
| `diamond` used for cubic zirconia | 58 | 32, 39, 59, 111, 115, 116 | Of these, most are `American Diamond` / `(AD)`, an Indian trade name for cubic zirconia rather than diamond. |
| `American Diamond` / `(AD)` | 51 | 115, 116, 117, 118, 119, 120 | The trade-name form specifically. |
| `skin-safe` / `skin-friendly` | 14 | 66, 108, 109, 110, 169, 296 | A wearer-safety claim. Note the catalogue has no supporting `nickel-free`, `lead-free` or `hypoallergenic` wording anywhere in this export — zero rows for all three. |
| `anti-tarnish` / `tarnish-resistant` | 141 | 2, 8, 9, 10, 12, 13 | The single most common durability claim in the file. |
| `waterproof` / `water-resistant` | 51 | 4, 30, 31, 32, 33, 34 | Applied to jewellery finishes, and separately to watches, where it means something quite different and is normally a rated figure. |
| `rust-proof` | 9 | 19, 108, 109, 110, 169, 368 | A durability claim. |
| `handmade` / `handcrafted` | 32 | 10, 11, 44, 45, 65, 68 | A provenance claim. |
| `synthetic` / `simulated` / `imitation` / `faux` | 12 | 3, 78, 104, 160, 199, 316 | The honest-disclosure vocabulary, present but rare relative to the 58 rows using `diamond`. |
| `luxury` / `luxurious` | 95 | 3, 14, 25, 30, 31, 32 | Marketing register rather than a factual claim, listed for completeness. |
| Prices written into the description text | 13 | 2, 98, 105, 106, 178, 209 | Prices in prose go stale independently of the catalogue and of `data/products.json`. |
| Brand name `Morchadi Jewels` | 5 | 79, 207, 360, 446, 465 | Not `Morchadi Gems`. Zero rows in the export use `Morchadi Gems`. |
| Third-party brand names | 49 | 80, 105, 106, 115, 116, 117 | Mostly confectionery inside gift-hamper contents; one row credits a jewellery brand, `DC Jewelry`. |
| COD / prepaid policy inside a product description | 30 | 79, 80, 81, 97, 98, 105 | Payment policy embedded in description copy, where it will not track a policy change. |
| Care / shipping instructions inside a product description | 144 | 19, 20, 22, 24, 28, 29 | Same shape of problem: boilerplate living inside per-product copy. |
| Photography disclaimer | 2 | 20, 24 | `Images may appear brighter than the actual product due to photographic effect.` |
| `certified` / `hallmark` / BIS | 0 | — | **Zero rows.** Recorded because its absence is as useful to know as its presence. |

## 3. Where the payment-policy notice appears inside product copy

Rows 5 and 407 are the notice on its own and were set aside as non-product. The same notice,
or a variant of it, is embedded inside 30 rows that are genuine product descriptions and
were scanned normally:

> 79, 80, 81, 97, 98, 105, 106, 163, 165, 178, 184, 207, 209, 270, 307, 308, 309, 357, 359, 360, 379, 390, 391, 398, 402, 446, 450, 465, 466, 468

