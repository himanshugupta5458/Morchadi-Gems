# Test Result: the payment-path suite after P001 acquired a prepayment floor

- **Date:** 2026-08-28
- **Plan:** [PLAN-checkout-payment-paths.md](PLAN-checkout-payment-paths.md)
- **Prompt:** 101
- **Trigger:** `data/products.json` set P001's `pricing.minPrepaidAmount` to `49`, the first
  non-zero floor in the catalogue. No production code changed in this run.

## What was run

The full gate, before and after the test changes.

| Command | Before | After |
| --- | --- | --- |
| `npm run typecheck` | pass | pass |
| `npm run lint` | pass | pass |
| `npm run test:run` | **8 failed**, 1833 passed (1841) | **1841 passed (1841)**, 91 files |
| `npm run validate:products` | `PASS — all checks green` | `PASS — all checks green` |
| `npm run build` | pass | pass |

The total is unchanged at 1841. Nothing was skipped or removed to reach green, and none of
the four `checkout-payment-paths` cases skipped for a missing database — local Postgres was
up for both runs.

## Classification of the eight failures

All eight were **test-side**, and all eight had one cause. None was a regression.

| # | Test | Kind | What changed |
| --- | --- | --- | --- |
| 1 | `cod.test.ts` — whole catalogue COD-eligible | Stale assertion | Now asserts the catalogue is ineligible **and** that its zero-floor subset is eligible |
| 2 | `cod.test.ts` — no product requires prepayment | Stale assertion | Expects `["P001"]`; renamed to "designates exactly the products flagged for prepayment" |
| 3 | `payment-paths.test.ts` — real-catalogue summary | Stale assertion | Expected floor computed from the catalogue, guarded by `toBeGreaterThan(0)` |
| 4 | `checkout-payment-paths.test.ts` — partial refused with no floor | Stale fixture | Buys a piece that genuinely has no floor |
| 5 | `checkout-database-failure.test.ts` — COD under database failure | Stale fixture | Same |
| 6 | `checkout-payment-paths.test.ts` — COD calls Cashfree zero times | Stale fixture | Same |
| 7 | `checkout-payment-paths.test.ts` — COD reference refused by verify | Stale fixture | Same |
| 8 | `checkout-payment-paths.test.ts` — COD readable at its own route | Stale fixture | Same |

## Evidence for 5–8, which presented as route failures

These four returned `400` where `200` (or, for #5, `503`) was expected, which is the shape
of a broken cash-on-delivery path. They were diagnosed from response **bodies**, not status
codes, using a throwaway probe against the real route:

```
COD P001 -> 400 {"error":"PAYMENT_PATH_UNAVAILABLE", ...} | fetch calls: 0
COD-under-db-failure P001 -> 400 {"error":"PAYMENT_PATH_UNAVAILABLE", ...} | fetch calls: 0
PARTIAL P001 -> reaches the gateway | fetch calls: 1
P001 qty1 summary -> {"isCodEligible":false,"minimumPrepayment":49} | priced total: 309
```

`PAYMENT_PATH_UNAVAILABLE` with zero outbound `fetch` calls is the eligibility gate refusing
a cart that genuinely contains a piece requiring prepayment — ADR-058's unanimity rule doing
its job. For #5 it also explains the `503` that never came: the refusal happens before any
database call, so the ADR-042 contract was never reached, let alone broken. #7's
`ORDER_ID_MALFORMED` is one step downstream — a refused checkout returns no
`codOrderReference`, so the verification route was handed `undefined`.

Full diagnosis:
[`../logs/2026-08-28-eight-tests-fail-after-one-catalogue-price-edit.md`](../logs/2026-08-28-eight-tests-fail-after-one-catalogue-price-edit.md).

## Coverage check after the change

The concern with re-pointing a fixture is that it stops testing what it tested. It does not
here:

- The cash-on-delivery cases now buy a piece the catalogue really does take on delivery, so
  they exercise the COD path rather than the refusal — which is what their names claim.
- The refusal they had accidentally started testing has its own case, "is refused outright
  when the cart holds a piece that requires prepayment", which was present and passing
  throughout.
- TC-27 (part payment against a real catalogue floor) is now reachable from real data for
  the first time. It remains automated only; the manual walk-through against P001 is still
  outstanding and is recorded as item 10 of PROJECT-STATE §5.
