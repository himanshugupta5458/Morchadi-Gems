# Test Result: The admin order list, and the order number made visible — 2026-08-20

- **Plan:** [PLAN-admin-orders-list.md](PLAN-admin-orders-list.md)
- **Commit:** `c9b1fa8` plus this prompt's working tree
- **Environment:** local dev server on `localhost:3000`, local Postgres from
  `docker-compose.yml`, Cashfree **sandbox**, Chromium driven headless for every manual case

## Gate

```
npm run typecheck        → tsc --noEmit, clean
npm run lint             → ✔ No ESLint warnings or errors
npm run test:run         → Test Files 56 passed (56) · Tests 1080 passed (1080)
                           (was 981 across 52 — 99 new)
npm run validate:products→ PASS
npm run build            → ✓ Compiled successfully, /admin/orders listed as ƒ (Dynamic)
```

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `lib/checkout-database-failure.test.ts` asserts the key set is exactly `cashfreeOrderId`, `mode`, `paymentSessionId`, `trackingId` |
| TC-02 | Pass | `lib/checkout-capture-route.test.ts`: `body.trackingId === written.id`, and `written.id !== body.cashfreeOrderId` |
| TC-03 | Pass | Postgres unreachable → 200, `trackingId: null`, same four keys |
| TC-04 | Pass | `lib/payment.test.ts` — a prompt-48 body is rejected |
| TC-05 | Pass | `""` and a missing key rejected; `null` accepted |
| TC-06 | Pass | `lib/checkout.test.ts` — both ids survive the `sessionStorage` round trip |
| TC-07 | Pass | Unusable `trackingId` costs the stamp, not the bundle |
| TC-08 | Pass | `lib/verify.test.ts` — a bundle stamped to another order yields `null` |
| TC-09 | Pass | Resolves for `PAID`, `PENDING` and `FAILED` alike |
| TC-10 | Pass | `lib/order-confirmation.test.tsx` — `<strong>` at `text-heading` under "Your order number" |
| TC-11 | Pass | "Payment reference {MG_…}" present; no bare "Order number" label |
| TC-12 | Pass | Both non-paid footnotes name the ten-character id |
| TC-13 | Pass | No bundle → "Payment reference"; no order number claimed |
| TC-14 | Pass | A leftover bundle's order number never appears |
| TC-15 | Pass | Evidence below |
| TC-16 | Pass | `lib/order-status.test.ts` — disjoint, exhaustive, equal to `OrderStatus` |
| TC-17 | Pass | Exactly placed, packed, shipped |
| TC-18 | Pass | Exactly delivered, rto, returned, cancelled |
| TC-19 | Pass | `{view: "active", status: null, search: "", from: "", to: "", sort: "newest", page: 1}` |
| TC-20 | Pass | `?view=active&status=delivered` → `status: null` |
| TC-21 | Pass | Nonsense in every field → every default |
| TC-22 | Pass | 500 characters → 60 |
| TC-23 | Pass | Full order number → that row only |
| TC-24 | Pass | `zztfind23` → `ZZTFIND23A` |
| TC-25 | Pass | Full phone → that customer's rows |
| TC-26 | Pass | Last four digits → includes the row |
| TC-27 | Pass | `meenakshi` → that row |
| TC-28 | Pass | **The bug found in TC-53 and fixed.** Failure and fix below |
| TC-29 | Pass | Empty result, `totalCount: 0` |
| TC-30 | Pass | `createdAt` descending |
| TC-31 | Pass | `[1499, 749, 149]` and `[149, 749, 1499]` |
| TC-32 | Pass | Every sort's last clause is `id` |
| TC-33 | Pass | 30 June 23:00 UTC files under 1 July IST, and is excluded from a 30 June range |
| TC-34 | Pass | `endOfIstDayUtc("2026-07-01") === 2026-07-01T18:30:00.000Z` |
| TC-35 | Pass | `2026-02-30`, `2026-13-01`, `01-07-2026`, `""` all `null` |
| TC-36 | Pass | 30 seeded rows → 25 shown, `totalCount: 30`, `pageCount: 2` |
| TC-37 | Pass | 5 on page two, 30 distinct ids across both |
| TC-38 | Pass | `page=99` → page 2, non-empty |
| TC-39 | Pass | Row keys are exactly the seven the list renders |
| TC-40 | Pass | `/admin/orders` for defaults; page reset on filter change, kept on page change |
| TC-41 | Pass | `lib/admin-orders-access.test.ts` — redirect to `/admin/login` |
| TC-42 | Pass | `/orders` on the admin host → `/login` |
| TC-43 | Pass | `/admin/orders/W2ACEHACUU` → redirect |
| TC-44 | Pass | With a cookie → rewrite to `/admin/orders` |
| TC-45 | Pass | Production `NODE_ENV`, shop hostname → redirect to `/` |
| TC-46 | Pass | Protected layout redirects a cookieless render |
| TC-47 | Pass | A forged token redirects |
| TC-48 | Pass | A live session renders |
| TC-49 | Pass | Evidence below |
| TC-50 | Pass | Evidence below |
| TC-51 | Pass | Evidence below |
| TC-52 | Pass | Active 5 + Resolved 2 = 7, none in both |
| TC-53 | **Fail, then Pass** | Found the search bug. See below |
| TC-54 | Pass | `/admin/orders/32QBZYJQU3`. **404s — expected until the next prompt** |
| TC-55 | Pass | "No orders match these filters. Clear them to see the whole list." |

## TC-15 — a real sandbox order, end to end

Driven in a headless Chromium through the real storefront: `/product/P001` → Add to cart →
`/address` (form filled and submitted) → `/payment` → **Pay ₹309 with Cashfree** → real
`POST /api/create-order` → real sandbox `payment_session_id` → Cashfree hosted checkout →
`POST /pg/orders/sessions` and `POST /pg/view/simulate` with `payment_status: SUCCESS` →
return URL.

```
POST /api/create-order
→ {"cashfreeOrderId":"MG_1787218963985_f70yi9mi",
   "trackingId":"32QBZYJQU3",
   "paymentSessionId":"session_XaoFVvUl-ZaTN-BR6fVn…",
   "mode":"sandbox"}

POST /pg/orders/sessions   → cf_payment_id 1443899909568901632
POST /pg/view/simulate     → {"simulation_id":"sim_111006693IAsyy2TcCwQCUFMsyfDiFIc4xQ",
                              "entity":"PAYMENTS","entity_id":"1443899909568901632",
                              "entity_simulation":{"payment_status":"SUCCESS","payment_error_code":""}}
```

`/order-confirmation?order_id=MG_1787218963985_f70yi9mi`, as rendered in the browser:

```
Your order is confirmed
Your payment went through and your order is with us. Nothing more is needed from you.

YOUR ORDER NUMBER
32QBZYJQU3
Keep this. It is what we will ask for if you message us about this order.

AMOUNT PAID                                                              ₹309

Dispatch within 2 business days · Delivery within 7 business days
Payment reference MG_1787218963985_f70yi9mi
```

`32QBZYJQU3` is `orders.id` for that row. The Cashfree id appears once, as fine print, and
nowhere as the order's name.

## TC-49 — the guard, in a real browser

```
GET http://localhost:3000/admin/orders   (no session cookie)
→ landed on http://localhost:3000/admin/login   http 200
```

## TC-50, TC-51, TC-52 — the real list

Signed in, `/admin/orders`. The database, read straight out of `psql`:

```
     id     |      placed (IST)     |    name     |   phone    | total  | payment_type |  status
------------+-----------------------+-------------+------------+--------+--------------+-----------
 32QBZYJQU3 | 20 Aug 2026, 03:12 pm | Ananya Iyer | 9876543210 | 309.00 | prepaid      | placed
 H2H9MX7NP4 | 20 Aug 2026, 03:11 pm | Ananya Iyer | 9876543210 | 309.00 | prepaid      | rto
 HJUFUE7A82 | 20 Aug 2026, 03:11 pm | Ananya Iyer | 9876543210 | 309.00 | prepaid      | delivered
 76EPDV92AV | 20 Aug 2026, 03:10 pm | Ananya Iyer | 9876543210 | 309.00 | prepaid      | shipped
 UZ5HW6EE5U | 20 Aug 2026, 03:10 pm | Ananya Iyer | 9876543210 | 309.00 | prepaid      | packed
 2669RD8XFG | 20 Aug 2026, 02:31 pm | Ananya Iyer | 9876543210 | 549.00 | prepaid      | placed
 W2ACEHACUU | 20 Aug 2026, 02:29 pm | Ananya Iyer | 9876543210 | 718.00 | prepaid      | placed
```

**Active** (the default view), as the page renders it:

```
ACTIVE *  RESOLVED

ORDER      | PLACED                | CUSTOMER    | PHONE      | TOTAL | PAYMENT | STATUS
32QBZYJQU3 | 20 Aug 2026, 03:12 pm | Ananya Iyer | 9876543210 | ₹309  | Prepaid | PLACED
76EPDV92AV | 20 Aug 2026, 03:10 pm | Ananya Iyer | 9876543210 | ₹309  | Prepaid | SHIPPED
UZ5HW6EE5U | 20 Aug 2026, 03:10 pm | Ananya Iyer | 9876543210 | ₹309  | Prepaid | PACKED
2669RD8XFG | 20 Aug 2026, 02:31 pm | Ananya Iyer | 9876543210 | ₹549  | Prepaid | PLACED
W2ACEHACUU | 20 Aug 2026, 02:29 pm | Ananya Iyer | 9876543210 | ₹718  | Prepaid | PLACED

Showing 1–5 of 5          first row links to /admin/orders/32QBZYJQU3
```

**Resolved**:

```
ACTIVE  RESOLVED *

ORDER      | PLACED                | CUSTOMER    | PHONE      | TOTAL | PAYMENT | STATUS
H2H9MX7NP4 | 20 Aug 2026, 03:11 pm | Ananya Iyer | 9876543210 | ₹309  | Prepaid | RTO
HJUFUE7A82 | 20 Aug 2026, 03:11 pm | Ananya Iyer | 9876543210 | ₹309  | Prepaid | DELIVERED

Showing 1–2 of 2          first row links to /admin/orders/H2H9MX7NP4
```

Every cell matches the database. Timestamps render in IST from UTC columns. The five statuses
present each render in their own hue: `PLACED` grey, `PACKED` gold, `SHIPPED` blue, `DELIVERED`
green, `RTO` maroon. All seven badges are on `/style-guide`.

### Seed note

Two of these orders are the previous prompt's and were left untouched. The other five were
placed through this prompt's real sandbox runs; four of them had their status moved by hand in
`psql`, with matching `order_status_history` rows, so that the Resolved tab and the badge set
had real rows to render. Nothing else in the database was edited.

## TC-53 — the filters, and one failure

Every filter exercised through the URL against the real rows:

| URL | Rows |
| --- | --- |
| `?status=packed` | `UZ5HW6EE5U` only |
| `?search=32QBZ` | `32QBZYJQU3` only |
| `?search=9876543210` | all 5 Active |
| `?search=ananya` | all 5 Active |
| `?sort=total-high` | ₹718, ₹549, ₹309, ₹309, ₹309 |
| `?from=2026-08-20&to=2026-08-20` | all 5 Active |
| `?from=2026-08-19&to=2026-08-19` | none, with the empty-state message |
| `?view=resolved&search=zzz-no-such-thing` | none, with the empty-state message |

### Failure: a partial order number matched five unrelated orders

`?search=32QBZ` returned **all five** Active orders rather than the one whose id starts
`32QBZ`.

**Root cause.** The search built its phone clause from the term's digits, so that a number
written `+91 98765-43210` would still find `9876543210`. An order number is alphanumeric, so
`32QBZ` reduced to `32` — and `32` is a substring of `9876543210`. Every order belonging to
that phone matched. At a real catalogue's volume this turns a search for one order into the
whole list, and it would have got worse as orders accumulated.

**Fix.** A term containing a letter is not a phone number, and its digits are no longer
extracted:

```ts
const digits = /[a-z]/i.test(term) ? "" : term.replace(/\D/g, "");
```

Nothing a person types as a phone number contains a letter, so no real phone search is lost.

**Verified.** `?search=32QBZ` now returns one row. TC-28 covers it at both layers — the clause
shape, and a real query against a seeded customer whose phone contains the term's digits.
Reverting the one line above fails both, which is the point of the test.

**Found by looking at the real rendered list, not by a test.** Every automated case had passed:
the seeded fixtures happened not to contain a phone whose digits overlapped an order number.
Part C of the plan existed precisely to catch what fixtures agree with each other about.

## Known and expected

- **`/admin/orders/{id}` 404s.** The rows link to a route the next prompt builds. This is
  expected, is stated on the page component, and is not a defect.
- **The order number does not survive a refresh of the confirmation page.** The bundle is
  cleared on a confirmed payment by design; the page degrades to the Cashfree reference, which
  is what it showed before this prompt. Argued and scoped in
  [ADR-043](../decisions/ADR-043-order-id-as-primary-identifier.md).
- **The storefront header, footer and floating WhatsApp button still wrap the admin panel**,
  and the WhatsApp button overlaps the right-hand end of the table. Pre-existing: separating
  the two shells means a second root layout and moving every storefront route into a route
  group, which `app/admin/layout.tsx` has deferred since ADR-041. It is now visibly worth
  doing.

## Summary

55 planned cases: **55 passed, 0 failed, 0 skipped.** One case (TC-53) failed on first run,
found a real search defect, and passed after the fix, which is now covered by TC-28.

1080 automated tests pass, 99 of them new. Shippable.
