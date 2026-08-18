# Test Result: Product catalogue — 2026-08-17

- **Plan:** [PLAN-product-catalogue.md](PLAN-product-catalogue.md)
- **Commit:** working tree, uncommitted (base `d2f4f96`)
- **Environment:** local, Node v24.14.0. No env vars or network required.
- **Command:** `npm run validate:products`

## Positive cases

All 22 automated cases passed in a single run. Validator output:

```
Morchadi Gems — product catalogue validation

Products            100
Unique ids          100
Featured            8
New arrivals        8
Out of stock        3

Category distribution
  necklaces         13
  earrings          13
  rings             13
  bracelets         12
  bangles           13
  pendants          12
  anklets           12
  nose-pins         12

Price bands
  budget  299-999    27
  mid     1000-4999  43
  premium 5000-25000 30

PASS — all checks green.
```

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | Parses as an array |
| TC-02 | Pass | 100 products |
| TC-03 | Pass | 100 distinct ids |
| TC-04 | Pass | All ids match their category prefix |
| TC-05 | Pass | No unknown category slug |
| TC-06 | Pass | All 8 categories populated, 12–13 each |
| TC-07 | Pass | — |
| TC-08 | Pass | All prices positive integers |
| TC-09 | Pass | 0 products outside ₹299–₹25,000 |
| TC-10 | Pass | Every `images` is an array |
| TC-11 | Pass | — |
| TC-12 | Pass | — |
| TC-13 | Pass | Ratings 4.0–4.9 observed, all within 3.5–5.0 |
| TC-14 | Pass | — |
| TC-15 | Pass | 2–3 reviews per product |
| TC-16 | Pass | — |
| TC-17 | Pass | No product repeats a review text |
| TC-18 | Pass | Exactly 8 featured |
| TC-19 | Pass | Exactly 8 isNew |
| TC-20 | Pass | 3 out of stock: `nk-006`, `er-004`, `bn-006` |
| TC-21 | Pass | — |
| TC-22 | Pass | — |

## Negative cases

Each fault was injected into a copy of the catalogue in a scratch directory and the
validator run against it. The real `data/products.json` was not modified.

| ID | Injected fault | Exit code | Reported |
| --- | --- | --- | --- |
| TC-N1 | `p[5].id = p[0].id` | 1 | `nk-001: duplicate id` and `ids are not unique: 100 products but 99 distinct ids` |
| TC-N2 | `p[3].category = "neckalces"` | 1 | `nk-004: category "neckalces" is not a known slug` |
| TC-N3 | `p[7].rating = 7.4` | 1 | `nk-008: rating must be one decimal between 3.5 and 5` |
| TC-N4 | `p[9].price = "1200"` | 1 | `nk-010: price must be a positive whole number of rupees` |
| TC-N5 | Ninth product flagged `featured` | 1 | `expected 8 featured products, found 9` |

TC-N2 produced one message rather than the two the plan predicted; the id-prefix check is
guarded by a valid category, so an unknown slug is reported once. The plan has been
corrected to match.

## Other checks run this prompt

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass — clean under `strict: true` |
| `npm run build` | Pass — compiled, static export of `/` and `/_not-found` |

## Failures

None.

## Summary

22 of 22 positive cases passed, 5 of 5 negative cases correctly detected and exited
non-zero, 0 failed, 0 skipped. The catalogue is shippable as a data layer.

Caveat carried forward: `lib/products.ts` has no unit tests, because no test runner is
installed yet. Its six accessors are exercised only by the compiler at this point. See
Gaps in the plan.
