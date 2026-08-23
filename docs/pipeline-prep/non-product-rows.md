# Rows set aside as non-product

Source: `Latest.xlsx`, sheet `Sheet1`, column **eCommerce Description**. Row numbers are
spreadsheet row numbers — the header is row 1, so the first description is row 2.

These rows were **excluded** from the phrase extraction in
[`material-phrase-candidates.md`](material-phrase-candidates.md). They are recorded here in
full rather than dropped, so nothing leaves the file unaccounted for. Nothing here has been
deleted from, or edited in, the source workbook.

| Rows excluded | 52 |
| --- | --- |
| — policy notices | 2 |
| — empty after HTML stripping | 50 |

## 1. Policy notices — not product descriptions

Two rows carry only a payment-policy notice. Neither describes a product, and neither was
treated as product content.

| Row | Cleaned text |
| --- | --- |
| 5 | Due to the fragile nature of glass bangles, Cash on Delivery (COD) is not available for this product. Kindly place prepaid orders only |
| 407 | Due to the fragile nature of glass bangles, Cash on Delivery (COD) is not available for this product. Kindly place prepaid orders only |

They are byte-identical to each other after cleaning. The same notice also appears **inside**
30 other rows that *are* product descriptions (hampers, mystery jars and glass-bangle sets);
those rows were kept and scanned normally. See
[`source-data-notes.md`](source-data-notes.md) for that list.

## 2. Empty rows

50 rows are empty once HTML is stripped — rows 496–545, a contiguous
block at the end of the sheet. Each was empty in the source cell as well, not emptied by the
cleaning step. Whether the export was truncated, or whether these products simply have no
description yet, is not something this extraction can tell — it is worth a look before the
export is treated as complete.

## 3. Rows kept, but flagged for review

These rows **were** scanned as product descriptions and their phrases (if any) are in the
candidate table. They are listed here only because they read as product *names* or variant
labels rather than descriptions, and the owner may want to classify them differently. None
of them was judged, shortened, or reinterpreted.

| Row | Cleaned text | Chars |
| --- | --- | --- |
| 95 | Cherry | 6 |
| 102 | Clover charm | 12 |
| 103 | Coconut tree Charm | 18 |
| 201 | Floating Teardrop Locket (Without Charm) | 40 |
| 297 | Large Tree | 10 |
| 305 | Love | 4 |
| 311 | Male doll | 9 |
| 312 | Mama | 4 |
| 341 | Peace Dove | 10 |
| 356 | Pink doll | 9 |
| 492 | Wine | 4 |

The flag is a length cut-off (under 45 characters), not a judgement. Row 350 —
`Fashion Pink Petal Cherry Blossom Spring Pendant Necklace for Women`, 67 characters — sits on
the same boundary, a product title in the description column, but is long enough to fall
outside it. Mentioned so the cut-off is visible rather than implied.

