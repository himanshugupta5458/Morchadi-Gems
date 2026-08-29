# Test Result: Customer order-confirmation email — 2026-08-29

- **Plan:** [PLAN-customer-order-confirmation-email.md](PLAN-customer-order-confirmation-email.md)
- **Commit:** `69e8d73` plus the working tree of prompt 103
- **Environment:** local. Node, Postgres from `docker-compose.yml` reachable at the configured
  `DATABASE_URL` (route-level cases ran for real, not skipped). Automated cases under Vitest.
  **No request reached the real Resend API in any automated case**; every send was either an
  injected `sendImpl` or an intercepted `fetch` to `RESEND_API_ENDPOINT`. `RESEND_API_KEY` was
  not present in `.env.local` in this environment despite the task's setup notes, and this
  sandbox has no outbound internet access — see TC-31.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | |
| TC-02 | Pass | |
| TC-03 | Pass | |
| TC-04 | Pass | |
| TC-05 | Pass | |
| TC-06 | Pass | |
| TC-07 | Pass | |
| TC-08 | Pass | Caught a real bug during development: the first draft only printed the Cashfree-verified `amountPaid` when a balance was due, so a fully-paid order's email showed only the bundle's own (untrusted) total and never the authoritative figure. Fixed to print `Amount paid` unconditionally, mirroring `composeAdminOrderMessage`'s unconditional `*Paid:*` line |
| TC-09 | Pass | |
| TC-10 | Pass | |
| TC-11 | Pass | Regression test for the TC-08 bug |
| TC-12 | Pass | |
| TC-13 | Pass | |
| TC-14 | Pass | |
| TC-15 | Pass | |
| TC-16 | Pass | |
| TC-17 | Pass | Both `""` and `"   "` |
| TC-18 | Pass | |
| TC-19 | Pass | |
| TC-20 | Pass | `vi.useFakeTimers()` plus a promise that never resolves, advanced past `RESEND_TIMEOUT_MS` |
| TC-21 | Pass | |
| TC-22 | Pass | |
| TC-23 | Pass | All three non-`PAID` states checked in one case, plus `PAID` |
| TC-24 | Pass | |
| TC-25 | Pass | Zero Cashfree requests, one Resend request; amount asserted as `formatRupees(body.amountDue)`, so the test cannot pass by printing some other figure |
| TC-26 | Pass | `200`, `paymentType: "cod"`, real `trackingId`, row present, while `fetch` throws for every call |
| TC-27 | Pass | |
| TC-28 | Pass | Confirmed by inspection of every other `describe` block in `lib/checkout-payment-paths.test.ts`: none sets `RESEND_API_KEY`, and `resendRequests()` was never called against their `outboundFetch` mocks because no such request was ever made — the module short-circuits at `SKIPPED_NOT_CONFIGURED` before touching `fetch` |
| TC-29 | Pass | Extended `lib/notify-boundary.test.ts` with a second `describe` reusing its existing reachability walk for `RESEND_API_KEY` / `lib/notify-customer-email.ts` |
| TC-30 | Pass | `lib/notify.test.ts` and `lib/notify-cod.test.ts` untouched and green; the pre-existing WhatsApp `describe` blocks in `lib/checkout-payment-paths.test.ts` pass unmodified alongside the two new blocks |
| TC-31 | Substituted | See below |

## TC-31 — traced through the real composers and dispatchers, all three order types

No `RESEND_API_KEY` in this environment's `.env.local` and no outbound internet access, so a
genuine Resend send could not be attempted or its delivery confirmed. Instead, a temporary test
(`lib/__manual-trace.test.ts`, deleted after the run — not part of the shipped diff) called the
real `sendCodOrderConfirmationEmail` and `dispatchOrderConfirmationEmail` with a `sendImpl` that
logs the exact payload instead of calling Resend, exercising every line of composition and
dispatch code a real send would.

**Cash-on-delivery** — `to: ananya@example.com`, `from: Morchadi Gems <orders@updates.morchadijewels.com>`,
`subject: Your Morchadi Gems cash-on-delivery order is placed`. Body: "This is a
cash-on-delivery order. **Nothing has been paid yet.** Have ₹746 ready in cash when it
arrives.", the two items with their chosen option, Subtotal/Shipping/Total/Due on delivery all
₹746 where applicable, the full delivery address, "Dispatch within 2 business days.", and
"Track your order: https://morchadigems.com/track?order_id=K7M2QPX9RJ".

**Fully prepaid** — `subject: Your Morchadi Gems order is confirmed`. Body: "Your payment went
through and your order **K7M2QPX9RJ** is confirmed. Nothing more is needed from you.",
Subtotal ₹647 / Shipping ₹99 / Amount paid ₹746, delivery address, tracking link. No mention of
a balance due.

**Partial payment** — `subject: Your Morchadi Gems order is confirmed: balance due at
delivery`. Body: "Your payment went through and your order **K7M2QPX9RJ** is confirmed. ₹300
has been paid online, and the remaining ₹446 is due in cash when it is delivered.", Subtotal
₹647 / Shipping ₹99 / Paid online ₹300 / Due on delivery ₹446, delivery address, tracking link.

All three logged `[notify-customer-email] K7M2QPX9RJ sent the customer a confirmation email`
after the traced send resolved, confirming the outcome-logging path that a real send would also
exercise.

## Cost/margin seal

TC-07 and TC-14 assert directly on the composed output, the same way `lib/money-path.test.ts`
asserts on the client cart bundle: `expect(html.toLowerCase()).not.toContain("cost")`, checked
across every `amountDue` state a paid/partial email can render in. Structurally, neither composer
is ever given a value carrying `unitCost` or `pricing.cost` in the first place — `AdminMessageItem`
and `CodOrderMessageInput["items"]` have no such field, and `CheckoutData` (the paid/partial
bundle) is the client's own untrusted summary, which was never able to carry margin data. The
direct assertion exists so that changes to either input shape in the future would fail this test
rather than rely on that structural fact being noticed by review.

## Gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass, no output |
| `npm run lint` | `✔ No ESLint warnings or errors` |
| `npm run test:run` | **94 files, 1904 passed, 0 failed, 0 skipped** |
| `npm run validate:products` | `PASS — all checks green` (unchanged advisories only) |
| `npm run build` | Pass, 475 pages, no `RESEND_API_KEY` or Resend key material in `.next/static` |

The suite was 1869 passing before this change and is 1904 after: 15 new cases in
`lib/customer-email-message.test.ts`, 14 in `lib/notify-customer-email.test.ts`, 3 in the
extended `lib/notify-boundary.test.ts`, and 3 route-level cases added to
`lib/checkout-payment-paths.test.ts` (1869 + 35 = 1904).
