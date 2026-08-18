# Test Result: Funnel UI polish — 2026-08-18

- **Plan:** none. This prompt is cosmetic and content-only, so no `PLAN-` file was written;
  the two new suites are regression guards for decisions made in
  [ADR-024](../decisions/ADR-024-funnel-ui-polish.md), not a feature under test.
- **Commit:** `9d21a8e` plus this prompt's working tree
- **Environment:** local — Vitest 4.1.10 on Node. No network, no Cashfree credentials.

## Suites

| Suite | Tests | Covers |
| --- | --- | --- |
| `lib/copy-dashes.test.ts` | 2 (new) | The em-dash sweep, enforced from both ends: catalogue strings, and every non-test `.ts`/`.tsx` under `app`, `components`, `lib`, `config`, `types` with comments stripped |
| `lib/button-styles.test.ts` | 4 (new) | The two button scales by their literal padding and type classes, and that only the box differs between them |
| `lib/wordmark.test.tsx` | 7 (edited) | The logo height assertion moved `h-9`/`lg:h-12` → `h-11`/`lg:h-16` |
| `lib/catalogue-ia.test.ts` | 15 (edited) | Collection count 5 → 4; the `source.kind` table and the label case lost their `under-999` row |
| `lib/shop.test.ts` | 71 (edited) | The `under-999`-as-a-collection case is replaced by its inverse: the slug is no longer a collection and parses to nothing |

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | No em dash in any catalogue string a shopper reads: `name`, `shortDescription`, every `details` value, every review name and body, every option name and value, across all 49 products |
| TC-02 | Pass | No em dash in rendered source outside `components/OrderTotals.tsx`. Comments are stripped before the scan — JSDoc is source, not content |
| TC-03 – TC-06 | Pass | `md` is `px-12 py-[1.375rem] text-label`; `sm` is `px-4 py-2.5 text-[0.6875rem] leading-4`; both carry the same border, fill, case and tracking; `w-full` only on `fullWidth` |
| TC-07 | Pass | The logo renders `h-11 w-auto lg:h-16`, both dimensions still constrained |
| TC-08 | Pass | `COLLECTIONS` holds four, `COLLECTION_MENU` links four, `under-999` is absent from `COLLECTION_SLUGS` |
| TC-09 | Pass | `?collection=under-999` parses to `[]` — the existing unknown-slug path, so a stale link widens to an unfiltered shop rather than 404ing |
| TC-10 | Pass | All 474 tests written before this prompt still pass. No behavioural assertion was changed; the five edits are a class string, two counts, one table row and one case inverted |

## Verified against the build output, not source

Read out of `.next/server/app/*.html` after a cleared-cache build:

| Check | Result |
| --- | --- |
| Em dashes in all rendered HTML | **1**, and it is the `OrderTotals` placeholder in the style guide's shipping row — the exempted case |
| En dashes in all rendered HTML | `7–10 business days`, `₹1,000 – ₹4,999`, `Showing 1–20 of 49` — numeric ranges only |
| Hero CTAs | Both carry `px-12 py-[1.375rem] text-label` |
| Card buttons | Carry `py-2.5 text-[0.6875rem] leading-4` |
| Card names | 32 on the home page carry `line-clamp-2 min-h-[2.75rem]` |
| Header | `flex h-16 items-center justify-between gap-4 lg:h-24`, logo `h-11 w-auto lg:h-16`, `sizes="(min-width: 1024px) 106px, 73px"` |
| Collection links | Exactly four: `gifting`, `anti-tarnish`, `best-sellers`, `new-arrivals` |
| Product page order | `Buy now` at offset 20239, `Details` at 20770, `Customer Reviews` at 21802 — the specs are inside the buy column, and the old full-width "The Details" heading is gone |

## Full gate

| Step | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm run test:run` | **480 passing across 19 files** (was 474 across 17) |
| `node scripts/validate-products.mjs` | `PASS — all checks green` |
| `npm run build` | 68/68 static pages from a cleared `.next` |

## Failures

None.

## Not covered

**No browser.** Every claim about how this looks is read out of the rendered markup and the
computed box heights, not from a screenshot. The button heights (64px and 38px) are arithmetic
on the declared padding and line box, not a measurement.

## Summary

480 passed, 0 failed, 0 skipped. Shippable.
