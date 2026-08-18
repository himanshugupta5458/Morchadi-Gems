# Test Result: Address validation and the checkout bridge — 2026-08-17

- **Plan:** [PLAN-address-validation.md](PLAN-address-validation.md)
- **Commit:** working tree on `main` at `d2f4f96` (prompts 9–10 uncommitted)
- **Environment:** local. `npm run test:run` (Vitest 4.1.10, node + jsdom), `npm run typecheck`,
  `npm run lint`, `npm run validate:products`, `npm run build`, and `next start` on port 3211
  for the served-HTML checks. No Cashfree involvement — there is no payment code yet.

## Automated cases

`lib/address.test.ts` — **50 passed**, covering TC-01 to TC-50.
`lib/checkout.test.ts` — **17 passed**, covering TC-51 to TC-67.
`lib/address-checkout.test.tsx` — **16 passed**, covering TC-68 to TC-83.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 – TC-03 | Pass | Valid address normalised; `line2` omitted rather than stored empty |
| TC-04 – TC-09 | Pass | Name bounds and trimming; hyphens and apostrophes accepted |
| TC-10 – TC-16 | Pass | 10 digits, leading 6–9, formatting stripped and stored normalised |
| TC-17 – TC-21 | Pass | 8 malformed shapes rejected, 3 real-world shapes accepted |
| TC-22 – TC-28 | Pass | Line 1 required, line 2 optional but bounded, all trimmed |
| TC-29 – TC-34 | Pass | 36 entries, no duplicates, case-exact, guard behaves |
| TC-35 – TC-39 | Pass | 6 digits, no leading zero, digits only |
| TC-40 – TC-50 | Pass | All errors at once, focus order, repopulation round-trip |
| TC-51 – TC-56 | Pass | Bundle shape, catalogue pricing, unavailable lines dropped |
| TC-57 – TC-67 | Pass | Hostile stored bundles; tampered amount deliberately accepted |
| TC-68 – TC-72 | Pass | Server render, guard states, no flash |
| TC-73 – TC-79 | Pass | Labels, 37 options, blur/submit validation, focus management |
| TC-80 – TC-83 | Pass | Handoff, storage-failure fallback, repopulation, corrupt bundle |

Four are worth stating in full.

**TC-40 — all errors at once.** An entirely empty form returns exactly seven errors: every
field except the optional second line. Not one error, and not eight.

**TC-54 — `mrp` is absent.** The serialised bundle is searched for the compare-at price and it
does not appear. Display-only stays display-only across the handoff.

**TC-67 — a tampered total is accepted.** `parseCheckoutData` passes `{ total: 1 }` through.
This is asserted deliberately: rejecting it would imply this layer is an authority on money,
and it is not. The server recompute is the authority, and it does not exist yet.

**TC-74 — the dropdown is the constant.** The `<select>` renders 37 options: the 36 entries of
`INDIAN_STATES` plus a placeholder whose value is `""`. There is no second list to drift.

## Adversarial check

**TC-84 — is the no-flash guarantee load-bearing?** Ran, and it changed the test suite.

The `isHydrated && isRestoreAttempted` wait was deleted from `AddressCheckout`, which is the
implementation ADR-011 rejects. Two cases failed — TC-68 (the server render now emits the
guard instead of the loading notice) and TC-70 (a seeded cart's server HTML now contains
"There is nothing to check out"). Both were restored and the suite re-run green.

**The finding worth recording: the fault produced no hydration mismatch at all.** Both
failures were served-HTML assertions; `console.error` was never called. That is correct
behaviour and it is the point — with the wait removed, the server render and the *first*
client render still agree (both show the guard, because the cart is empty until its effect
runs). The bug is the second render replacing the guard with the form: a **flash of wrong
content**, which React has no reason to warn about.

So the mismatch assertions inherited from prompt 9 would not have caught this. TC-70 was
strengthened during this run to assert on the server HTML rather than only on the
post-hydration DOM — as first written it checked the end state, which the faulted build also
satisfied. The strengthened version fails against the fault; the original did not.

## Other verification run alongside

| Check | Result |
| --- | --- |
| `npm run test:run` | 201 passed across 7 files |
| `npm run typecheck` | Clean |
| `npm run lint` | No ESLint warnings or errors |
| `npm run validate:products` | PASS — all checks green |
| `npm run build` | 109 static pages; `/address` prerendered; only `/shop` dynamic |
| Served `/address` | 200; `<title>Delivery Address · Morchadi Gems</title>`; `robots: noindex, follow` |
| Served `/address` body | Contains the loading notice exactly once and **zero** occurrences of the guard text, "Delivery details", "Full name" or "Order summary" |
| Route sweep | `/`, `/shop`, `/cart`, `/address`, `/style-guide` → 200; `/payment`, `/about`, `/contact`, `/terms` → 404 |
| `/style-guide` panel integrity | 23 panels render, including the three added this prompt — checked by extracting every panel heading from the served HTML, after prompt 8's regex-retrofit incident |

## Failures

None.

## Gaps this run does not cover

- **No visual verification.** No browser is available in this environment. Everything above is
  asserted on served HTML or a jsdom tree. Field spacing, the sticky summary at `lg`, and the
  focus ring on an errored input have not been *looked at*.
- **No real device or autofill test.** The `autoComplete` attributes are set per field but have
  not been exercised against a browser's saved-address autofill.
- **`/payment` handling a missing bundle is a requirement, not yet a test.** ADR-011 states it;
  prompt 11 owes the case.
- **No server-side price validation tests**, because there is still no server-side price
  validation. The `sessionStorage` bundle is explicitly not a substitute, and TC-67 exists to
  make that impossible to forget.

## Summary

**201 passed, 0 failed, 0 skipped** — 83 of them new this prompt (50 validation, 17 bundle,
16 page). Typecheck, lint, product validation and the production build are all green.

Shippable as checkout step 1. Not shippable as a checkout: nothing is charged yet, and when
something is, the amount must be recomputed server-side from ids and quantities regardless of
what this step stored.
