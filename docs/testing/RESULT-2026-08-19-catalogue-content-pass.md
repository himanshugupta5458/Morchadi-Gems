# Test Result: Catalogue content pass — 2026-08-19

- **Plan:** *(no plan — content and data correction, guarded by new regression tests)*
- **Decision:** [ADR-035](../decisions/ADR-035-catalogue-content-pass.md)
- **Commit:** working tree on `36a4bf4`
- **Environment:** local Codespace, Node 20, cleared-cache production build

## Scope

Writing 45 approved long-form descriptions into `data/products.json`, correcting the false and
misleading catalogue data the copy pass surfaced, rendering descriptions as paragraphs, and
deferring every missing value to [`docs/CATALOGUE-DATA-TODO.md`](../CATALOGUE-DATA-TODO.md).

Explicitly **not** covered: any missing measurement, size option or product fact. None was
added, and none was estimated.

## Cases

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| TC-01 | 45 approved descriptions land verbatim in the catalogue | Pass | Extracted programmatically from `descriptions.md`; 162 to 232 words each |
| TC-02 | No hook annotation or merchandiser note reaches a `description` field | Pass | Asserted in `lib/product-copy.test.ts` and failed hard by `validate-products.mjs` |
| TC-03 | Paragraph breaks survive into the JSON string | Pass | Every approved description stores 4 to 6 paragraphs separated by `\n\n` |
| TC-04 | The product page renders paragraphs, not one block | Pass | Verified in emitted HTML: `/product/P043` renders **5** `<p>` elements in the description column |
| TC-05 | P001, P022, P032, P042 keep their original one-liners | Pass | No approved copy exists for them; nothing was written |
| TC-06 | Every `18K` karat figure leaves the catalogue | Pass | 14 `specs.material` values corrected; **0** occurrences of `18K` across all 70 built HTML pages |
| TC-07 | A karat, `916`, hallmark or sterling-silver claim cannot return | Pass | Hard failure in `validate-products.mjs` over name, description, specs and options; mirrored in `lib/product-copy.test.ts` |
| TC-08 | No cubic-zirconia product is called crystal in its name | Pass | P019, P024, P028 renamed; asserted by test |
| TC-09 | Ten misleading names corrected | Pass | Each verified present in the built HTML under its new name |
| TC-10 | Every product name beginning "Silver" is qualified | Pass | Asserted to match `^Silver-(Tone\|Plated)` |
| TC-11 | Meta description fits a search result | Pass | ≤155 characters on all 49; 4 fall back to word-boundary clipping, 45 end on a sentence |
| TC-12 | The full description still reaches `Product` JSON-LD | Pass | `lib/structured-data.test.ts` unchanged and green |
| TC-13 | No em dash entered the catalogue with the new copy | Pass | `lib/copy-dashes.test.ts` green over all 49 descriptions |
| TC-14 | Long descriptions do not fail any validator rule | Pass | `validate:products` PASS; word range reported as an advisory, naming exactly the 4 awaiting copy |
| TC-15 | Every merchandiser-raised gap is recorded | Pass | 41 notes compiled into `docs/CATALOGUE-DATA-TODO.md`, grouped by product id |

## Corrections applied

**Karat removed from 14 specs** (P001, P002, P003, P004, P006, P007, P011, P012, P015, P016,
P017, P018, P020, P021). The copy pass estimated nine; a grep found fourteen.

**Names corrected (10):** P005, P008, P031, P035, P044 (silver qualified), P014 (emerald to
emerald-green), P019, P024, P028 (crystal to CZ), P025 (drop to studs).

**Stone naming aligned (2 copy edits):** P019 dropped "crystal" from one clause where the same
description already names the stone as cubic zirconia; P025 dropped the clause referring to the
old title.

## Nothing invented

No ring diameter, chain length, anklet length, bracelet length, hoop diameter, post gauge,
bangle size, hoop-fitting answer, pierced-ears notice, battery type or water-resistance rating
was added. Prices, ids, images, options, collections, stock and flags were not touched.

## Gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm run lint` | No ESLint warnings or errors |
| `npm run test:run` | **747 passed** across 37 files, up from 735 across 36 |
| `npm run validate:products` | **PASS** — 2 advisory blocks (9 pre-existing discount advisories, 4 descriptions awaiting copy) |
| `npm run build` | Green, cleared cache, 70 pages, all 49 product routes prerendered |

## Summary

15 passed, 0 failed. Shippable. The catalogue no longer makes a claim it cannot support, and
the values it is still missing are listed rather than guessed.
