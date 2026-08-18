# Test Result: Product catalogue after the real-product import — 2026-08-18

- **Plan:** [PLAN-product-catalogue.md](PLAN-product-catalogue.md)
- **Commit:** `3fa3687` plus the prompt-15 working tree
- **Environment:** local. `node scripts/validate-products.mjs` for TC-01 to TC-26; Vitest
  4.1.10 for the surrounding suite; the Home and product-page checks read from the
  `next build` output in `.next/server/app/*.html`. No network calls.

## Cases

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | Parses; top level is an array |
| TC-02 | Pass | Exactly 100 after adding 21 and removing 21 |
| TC-03 | Pass | 100 distinct ids across two schemes |
| TC-04 | Pass | 21 P-codes, 79 `{prefix}-NNN`; no `rg-*` rows remain |
| TC-05 | Pass | All eight slugs valid |
| TC-06 | Pass | All eight categories non-empty; smallest is 11 |
| TC-07 | Pass | `name` and `shortDescription` present on all 100 |
| TC-08 | Pass | Whole rupees; lowest is ₹130 (P020), highest ₹22,400 (`nk-006`) |
| TC-09 | Pass | Zero out-of-band against the widened ₹100–₹25,000 floor |
| TC-10 | Pass | 100/100 `images[0]` match `/products/{id}.webp` |
| TC-11 | Pass | `material` on all 100; no `weight` on the 21 P-codes, present on all 79 placeholders |
| TC-12 | Pass | No stray `details` keys; `stone` on 11 rows, `size` on 18 |
| TC-13 | Pass | Ratings 4.0–4.9, one decimal |
| TC-14 | Pass | All `reviewCount` non-negative integers |
| TC-15 | Pass | 2–3 reviews per product; the 21 new rows carry 3 each |
| TC-16 | Pass | Review shape valid throughout |
| TC-17 | Pass | No product repeats a review text (asserted by the import script too, before writing) |
| TC-18 | Pass | Exactly 8 featured: `P002 P003 P004 P010 P013 P021 er-006 bn-005` |
| TC-19 | Pass | Exactly 8 new: `P001 P007 P014 P020 br-011 pd-008 ak-008 np-005` |
| TC-20 | Pass | 7 sold out in total, of which **3 are placeholders** (`nk-006` ₹22,400 necklace, `er-004` ₹11,500 earrings, `bn-006` ₹499 bangles) — the coverage the rule protects |
| TC-21 | Pass | Flags are booleans on all 100 |
| TC-22 | Pass | No stray product keys; `options` now allowed |
| TC-23 | Pass | Highest implied discount 78.3% (P020, ₹130 against ₹599), inside the 80% ceiling for the owner's rows; placeholders unchanged under 60% |
| TC-24 | Pass | 4 products carry options: P001 `Letter` (25), P005 `Letter` (22), P006 `Shape` (4), P010 `Colour` (2) |
| TC-25 | Pass | No duplicate values within an option, no duplicate option names |
| TC-26 | Pass | All 21 `public/products/P0NN.webp` resolve on disk; `product files 100/100` |

## Consistency checks beyond the plan

| Check | Result | Notes |
| --- | --- | --- |
| Home Best Sellers / New Arrivals populate with real products | Pass | Built `/` links `/product/P001 P002 P003 P004 P007 P010 P013 P014 P020 P021` — 10 of the 16 Home slots are the owner's |
| Related products still fill | Pass | `/product/P013` offers `P001 P004 P005 P007` — all rings, self excluded |
| Shop filters, sorts and pagination | Pass | `lib/shop.test.ts` reads catalogue size and bands from the data; all three price bands stay non-empty, the three-band partition still sums to 100 |
| Product page renders the new detail keys | Pass | `/product/P013` shows Material "Rose gold plated brass", Stone "Pink cubic zirconia baguette", Size "Free size"; no Weight row |
| Options are inert | Pass | No selector on any product page; `CatalogueEntry` unchanged; cart lines still keyed by product id alone |
| Static generation | Pass | `next build` prerenders 100 `/product/[id]` pages |

## Failures

None. No existing test needed changing — every catalogue-dependent assertion in the suite
derives its expectations from the data rather than hardcoding counts or ids, so the import
was absorbed without edits. The three validator rules that *did* change are documented in
[ADR-016](../decisions/ADR-016-real-product-import.md) §4.

## Summary

26 plan cases passed, 0 failed. Full gate: `typecheck` clean, `lint` clean, **337 passing
across 12 files** (unchanged from prompt 14), `validate:products` green, `next build`
successful.

Two things this run deliberately does not cover, both by design this prompt:

- **The four option sets are unreachable.** Nothing renders them and nothing carries them
  into a cart line, so a buyer adding P001 today gets a ring with no letter recorded. The
  selector and the cart keying land in the next prompt and need their own plan.
- **The ratings and reviews on the owner's 21 products are invented**, drawn from the same
  pool as the placeholders. The validator checks their shape, not their truth. See
  ADR-016 §7 — this is a launch blocker, not a test gap.
