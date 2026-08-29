# Test Result: Admin panel sidebar, product export, and the variant photograph picker — 2026-08-29

- **Plan:** [PLAN-admin-panel-sidebar-export-and-picker.md](PLAN-admin-panel-sidebar-export-and-picker.md)
- **Commit:** d262f6a (working tree)
- **Environment:** local — `next dev` on port 3001, Postgres in Docker, the real 449-record catalogue

## Summary

| | |
| --- | --- |
| Automated cases (TC-01 … TC-44) | **44 / 44 passed** |
| Manual cases (TC-45 … TC-50) | **6 / 6 passed** |
| Full suite | 104 files, 2107 passed, 10 skipped |
| `typecheck` / `lint` / `validate:products` / `build` | all green |

New test files: `lib/admin-sidebar.test.tsx` (7), `lib/admin-product-export.test.ts` (18), and
20 cases added to `lib/admin-product-form.test.tsx` (40 total).

## Automated

All 44 automated cases passed. Three are worth naming.

**TC-30 — an untouched record saves its mappings unchanged.** This is the regression the whole
picker was designed around. All seven variant-image mappings in the catalogue point at files that
are **not** in `media.images`, so a picker built over that array alone would have shown every one
as unassigned and deleted them on the first save of an unrelated field. The case opens P586's
Variants tab, saves without touching anything, and asserts the submitted map equals
`media.variantImages` exactly.

**TC-31 — the payload is byte-identical to the typed-path form's.** The old transform is
reimplemented inside the test rather than imported, because importing today's helper and comparing
it with itself proves nothing. One choice is made through the new picker and the submitted bytes
are compared with `JSON.stringify` equality, key order included.

**TC-36 — a removed value takes its mapping with it.** This case **failed on first run** and found
a latent bug in ADR-064's form: `toProductEdit` read `draft.variantImages` rather than the rows
the options imply, so deleting an option value left a mapping for a value the record no longer
offered. `variantImageRowsFor` is now what the save is derived from. Verified across all 449
records that none already violates the invariant, so nothing existing changes shape (TC-44).

## Manual

Run against `next dev` with a real session, on the real catalogue.

| ID | Result | Notes |
| --- | --- | --- |
| TC-45 | Pass | `/admin/orders` renders `aria-current="page"` on the Orders anchor and none on Products; `/admin/products` the reverse |
| TC-46 | Pass | Unfiltered: `live-products-export-2026-08-29.xlsx`, 1,276,178 bytes, `X-Product-Export-Count: 449`. Filtered to Out of stock: `products-export-filtered-2026-08-29.xlsx`, 33,118 bytes, count 6. Both open as *Microsoft Excel 2007+*, one `Live Products` sheet each, the same 25 columns in the same order, P586's `media.variantImages` intact as JSON, and the filtered file holding exactly P006, P008, P011, P015, P039, P040 with `stock.inStock` false on every row |
| TC-47 | Pass | Pairing `Color:Combo` with `/products/P586-2.webp` produced a **one-line diff**, inserted in option-value order at the head of the map, and the reloaded page showed it |
| TC-48 | Pass | A stale token was refused `409 CONCURRENT_CHANGE` with the file byte-identical either side |
| TC-49 | Pass | An invalid meta title was refused `422 VALIDATION_FAILED` quoting `P586: seo.metaTitle is 9 characters, outside the 50-60 range a search result renders`, and nothing was written |
| TC-50 | Pass | Reverted through the panel; `git status` clean and the version hash back to its original `643cdcbad5128b3b` |

## One defect found by the manual pass and nothing else

`lib/product-export.ts` used `import XLSX from "xlsx"`. Vitest's esbuild transform synthesises a
default export for a CommonJS module and webpack does not, so **every automated export case passed
while the running dev server answered 500** with `Cannot read properties of undefined (reading
'write')`. Fixed to `import * as XLSX from "xlsx"`, which both agree on, and the reason is
recorded beside the import.

This is the class of defect a jsdom suite cannot reach: the code under test was correct and the
bundler it would actually run under was not asked. It is the argument for the manual pass being
part of the gate rather than a courtesy.
