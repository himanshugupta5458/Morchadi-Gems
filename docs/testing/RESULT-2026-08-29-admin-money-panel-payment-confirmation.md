# Test Result: Admin Money panel payment confirmation — 2026-08-29

- **Plan:** *(no plan — a scoped display-only bug fix on the existing admin order detail screen,
  [PLAN-admin-order-detail.md](PLAN-admin-order-detail.md))*
- **Commit:** working tree of prompt 108
- **Environment:** local. `npx vitest run` for the new suite; full gate below.

## What was wrong

The Money panel's "Prepaid" row showed `formatRupees(order.amountPrepaid)` unconditionally, with
`cashfreePaymentStatus` reported separately, several lines further down, as plain text with no
visual link back to the figure above it. Per ADR-042, `captureOrder` writes `amountPrepaid` the
moment Cashfree mints a checkout session — before the customer has paid anything — so an operator
glancing at "PAYMENT TYPE: Prepaid" and "PREPAID: ₹431" could read a payment as collected while
`CASHFREE PAYMENT STATUS: PENDING` sat unread below it.

## Fix

`app/admin/(protected)/orders/[id]/page.tsx` — new `isPrepaidAmountConfirmed(paymentType,
cashfreePaymentStatus)` helper. The "Prepaid" row now renders the rupee figure only when the
order never went to the gateway (`cod`) or Cashfree's own status is `PAID`; otherwise it renders
"Awaiting payment confirmation" in `text-sale` (the alert colour already used for admin form
errors and the database-down banner). No change to `captureOrder`, the Postgres schema, or any
other field on the page — display only.

## Cases

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| TC-1 | `prepaid` / `PENDING` | Pass | No `₹431` in the rendered markup; "Awaiting payment confirmation" present |
| TC-2 | `prepaid` / `FAILED` | Pass | Same as TC-1 |
| TC-3 | `prepaid` / `PAID` | Pass | `₹431` shown; no "Awaiting payment confirmation" text |
| TC-4 | `cod` / `NOT_APPLICABLE` | Pass | Unaffected — no gateway payment to confirm |

All four in `lib/admin-order-money-panel.test.tsx`, rendering the real
`AdminOrderDetailPage` server component via `renderToStaticMarkup` against a mocked
`prisma.order.findUnique`, the same pattern `lib/admin-page-database-failure.test.tsx` already
uses for this page.

## Failures

None.

## Gate

```
npx tsc --noEmit            PASS
npm run lint                 ✔ No ESLint warnings or errors
npx vitest run                95 files, 1915 passed, 9 skipped (1924 total)
npm run validate:products    PASS — all checks green
npm run build                 Compiled successfully — 475 static pages
```

1920 tests before this prompt, 1924 after: 4 added, none edited to pass, none skipped, nothing
existing weakened.

## Summary

4/4 new pass, full suite green, shippable.
