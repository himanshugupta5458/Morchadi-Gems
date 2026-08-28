# Eight tests fail after one product's `minPrepaidAmount` moved from 0 to 49

- **Date:** 2026-08-28
- **Prompt:** 101
- **Severity:** Major
- **Status:** Resolved

## Symptom

`data/products.json` changed P001's `pricing.minPrepaidAmount` from `0` to `49` — a
one-line, deliberate, correct data edit. The full gate then came back with **8 failures
across 4 files**, four of which looked nothing like a stale assertion:

| Test | Expected | Got |
| --- | --- | --- |
| `lib/cod.test.ts` — "reports the whole catalogue as cash-on-delivery eligible today" | `true` | `false` |
| `lib/cod.test.ts` — "designates no product as requiring prepayment yet" | `[]` | `['P001']` |
| `lib/payment-paths.test.ts` — "agrees with isCartCodEligible about the real catalogue as it reads today" | `minimumPrepayment: 0` | `49` |
| `lib/checkout-payment-paths.test.ts` — "is refused on a cart that has no floor to part-pay" | `400` | `200` |
| `lib/checkout-database-failure.test.ts` — "fails the checkout rather than confirming an order that exists nowhere" | `503` | `400` |
| `lib/checkout-payment-paths.test.ts` — "makes no request to Cashfree at all, and writes the whole total as owing" | `200` | `400` |
| `lib/checkout-payment-paths.test.ts` — "mints a reference the payment-verification route refuses before it can call Cashfree" | `COD_ORDER_NOT_VERIFIABLE` | `ORDER_ID_MALFORMED` |
| `lib/checkout-payment-paths.test.ts` — "is readable back by its own route, which names the order and what is owed" | `200` | `400` |

The last four are the dangerous ones. Read as status codes alone they describe a
cash-on-delivery path that has stopped working — including one that appears to have broken
the ADR-042 database-failure contract by answering `400` where the contract says `503`.

## Investigation

The four suspicious failures were **not** diagnosed from their status codes. A throwaway
probe test was written to print the response *body* the route actually returns, since a
`400` from `/api/create-order` could equally be `ITEMS_INVALID`, `PAYMENT_PATH_UNAVAILABLE`
or an address rejection, and only the first would have been a regression.

Cash on delivery, P001 × 2, against the real catalogue:

```
COD P001 -> 400 {"error":"PAYMENT_PATH_UNAVAILABLE","message":"That payment option is not
available for what is in your cart. Go back a step and choose another one.",
"retryable":false} | fetch calls: 0
```

The same request with Postgres mocked to reject everything, which is the exact fixture of
`lib/checkout-database-failure.test.ts`:

```
COD-under-db-failure P001 -> 400 {"error":"PAYMENT_PATH_UNAVAILABLE", ...} | fetch calls: 0
```

And the summary the route computes for that cart:

```
P001 qty1 summary -> {"isCodEligible":false,"minimumPrepayment":49} | priced total: 309
```

Three things follow. The refusal is `PAYMENT_PATH_UNAVAILABLE`, which is the eligibility
gate. It happens with `fetch` never called, so nothing reached Cashfree. And it happens
*before* any database call, which is why the database-failure test never got as far as the
`503` it was waiting for — the order was refused for being ineligible, not for being
unwritable. The `ORDER_ID_MALFORMED` failure is the same event one step downstream: the
refused checkout returned no `codOrderReference`, so the verification route was handed
`undefined` and correctly rejected its shape.

The fourth, "is refused on a cart that has no floor to part-pay", is the same cause
inverted. Its cart is P001, chosen when P001 had no floor. P001 now has one, at ₹49 against
a priced total of ₹309, so `resolvePaymentPlan` correctly *permits* part payment and the
route answers `200`. The test's name still described its intent; its fixture no longer
matched it.

## Root cause

One cause for all eight: **`data/products.json` is data, and eight assertions had encoded
the current state of that data as though it were a property of the code.**

Two forms of the same mistake:

- Assertions that pinned a catalogue-wide fact — "every product is COD-eligible", "no
  product requires prepayment", "the catalogue's total floor is 0". These were true facts,
  correctly pinned, and the edit made them false.
- Fixtures that named `P001` as their COD-eligible product. A cash-on-delivery test whose
  cart is barred from cash on delivery does not fail loudly as a fixture problem; it
  quietly becomes a test of the refusal path, wearing the name of the path it no longer
  reaches.

**No production code was at fault.** `lib/cod.ts`, `lib/payment-paths.ts`,
`app/api/create-order/route.ts` and `app/api/verify-order/route.ts` were not touched, and
every one of them behaved exactly as ADR-058 and ADR-059 specify. `data/products.json` was
not touched either.

## Fix

- `lib/cod.test.ts` — the two catalogue-wide assertions now state the new fact rather than
  the old one, and state it more strongly than a flipped boolean: the whole catalogue is
  ineligible **and** the subset reading `minPrepaidAmount: 0` is eligible, which pins the
  cause and not just the outcome. The second now expects `["P001"]`.
- `lib/payment-paths.test.ts` — the whole-catalogue expectation is computed from the
  catalogue instead of hardcoded, with `expect(everyFloorOnce).toBeGreaterThan(0)` in front
  of it so it cannot pass vacuously if every floor returns to zero.
- `lib/checkout-payment-paths.test.ts` and `lib/checkout-database-failure.test.ts` — the
  COD fixtures no longer name a product. `firstPieceTakenOnDelivery()` finds the first
  catalogue entry reading `minPrepaidAmount: 0` (448 of 449 qualify) and throws with an
  explanatory message if none does. The prepaid cases in `checkout-database-failure.test.ts`
  stay on `P001` deliberately — they assert against its own options and pricing, and no
  floor changes what a prepaid checkout does.

## Verification

`npm run test:run` — **1841 passed (1841)**, 91 files, the same total as before the data
edit, so nothing was deleted or skipped to reach green. `typecheck`, `lint`,
`validate:products` and `build` all pass.

The route behaviour that produced the four alarming failures is still asserted, and now by
tests that reach it: the cash-on-delivery cases run against a piece the catalogue really
does take on delivery, and the refusal they were accidentally testing has its own case
("is refused outright when the cart holds a piece that requires prepayment") which was
already present and passing throughout.

## Prevention

The rule this cost us is that **a test may pin a fact about the catalogue, but a fixture
must not depend on one.** Pinning is what `lib/cod.test.ts` does, and it is valuable: it is
why the edit was visible at all rather than silently changing what the shop offers. A
fixture depending on one is different, because its failure mode is a test that still passes
while testing something else.

`PLAN-checkout-payment-paths.md` now states that no case names the piece it buys, and why.
