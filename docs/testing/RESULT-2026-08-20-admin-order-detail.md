# Test Result: The order detail screen, and the admin layout split — 2026-08-20

- **Plan:** [PLAN-admin-order-detail.md](PLAN-admin-order-detail.md)
- **Commit:** `0e6bf3f` plus this prompt's working tree
- **Environment:** production build (`npm run build && next start`) on `localhost:3111`, local
  Postgres from `docker-compose.yml`. Every manual case was run against that build with `curl`,
  signed in with a real `admin_sessions` row.

## Gate

```
npm run typecheck        → tsc --noEmit, clean
npm run lint             → ✔ No ESLint warnings or errors
npm run test:run         → Test Files 64 passed (64) · Tests 1169 passed (1169)
                           (was 1080 across 56 — 89 new tests in 8 new files)
npm run validate:products→ PASS — all checks green
npm run build            → ✓ Compiled successfully
                           /admin/orders/[id]                 ƒ (Dynamic)  6.49 kB
                           /admin/api/orders/[id]/status      ƒ (Dynamic)
                           /admin/api/orders/[id]/address     ƒ (Dynamic)
                           /admin/api/orders/[id]/receipt     ƒ (Dynamic)
```

The suite was run four times end to end. A snapshot of every `orders` row and the
`order_status_history` count taken immediately before and after a full run is byte-identical:
the database-backed tests write only inside transactions they roll back.

## Results

### Part A — the admin layout shell

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `lib/admin-layout-shell.test.tsx` — the positive control, so the absence assertions below cannot pass by matching nothing |
| TC-02 | Pass | No `wa.me`, no footer copyright, no `site-schema` in the rendered admin tree |
| TC-03 | Pass | `<html>`, `<body>`, "Morchadi Gems admin" and the page's own content all present |
| TC-04 | Pass | The login page loses the chrome through the same layout, not a second mechanism |
| TC-05 | Pass | No `app/not-found.tsx`; 404 and catch-all inside `(storefront)`; one under `app/admin` |
| TC-06 | Pass | `app/layout.tsx` mentions none of the five chrome components |
| TC-07 | Pass | Evidence below |
| TC-08 | Pass | `/definitely-not-a-page` → 404 carrying `site-schema` and `wa.me` |
| TC-09 | Pass | `/product/BOGUS` → 404 with the shop chrome |
| TC-10 | Pass | Evidence below |
| TC-11 | Pass | `Disallow: /admin` present; sitemap still lists 70 URLs |
| TC-12 | Pass | `lib/admin-routing.test.ts`, `lib/robots.test.ts`, `lib/sitemap.test.ts` and `lib/admin-orders-access.test.ts` pass with no assertion edited |

### Part B — the lifecycle

| ID | Result | Notes |
| --- | --- | --- |
| TC-13 – TC-24 | Pass | `lib/order-transitions.test.ts` (14 tests) and `lib/order-status-change.test.ts` (19). TC-23 walks all 49 ordered pairs through the validator and accepts exactly the table's ten edges |

### Part C — reason and refund

| ID | Result | Notes |
| --- | --- | --- |
| TC-25 – TC-37 | Pass | `lib/order-status-change.test.ts` |
| TC-38 | Pass | `lib/admin-order-updates.test.ts` — cancel with a full amount sets all three columns |
| TC-39 | Pass | `refund_amount = 0`, `is_refunded = false`, `refunded_at = NULL` |
| TC-40 | Pass | `packed → shipped` leaves all three untouched |

### Part D — writes, audit and atomicity

| ID | Result | Notes |
| --- | --- | --- |
| TC-41 | Pass | Two history rows; the second names the operator, `reason: null` |
| TC-42 | Pass | Invalid transition then a missing reason: status unchanged, one history row |
| TC-43 | Pass | `NOT_FOUND` |
| TC-44 | Pass | `app/admin/api/orders/[id]/status/route.ts` wraps the call in `prisma.$transaction` |
| TC-45 | Pass | The `updateMany` guard is `{ id, status: currentStatus }`; a zero count returns `CONCURRENT_CHANGE` before the history row is written |

### Part E — the address window

| ID | Result | Notes |
| --- | --- | --- |
| TC-46 – TC-51 | Pass | `lib/admin-order-updates.test.ts`. TC-48 covers all five closed states |
| TC-52 – TC-55 | Pass | `lib/admin-order-panels.test.tsx` |

### Part F — the receipt toggles

| ID | Result | Notes |
| --- | --- | --- |
| TC-56 – TC-60 | Pass | `lib/admin-order-updates.test.ts` |
| TC-61 – TC-63 | Pass | `lib/admin-order-panels.test.tsx` |

### Part G — access to the three endpoints

| ID | Result | Notes |
| --- | --- | --- |
| TC-64 – TC-67 | Pass | `lib/admin-order-action-routes.test.ts` |
| TC-68 – TC-71 | Pass | Evidence below |

### Part H — the rendered detail page

| ID | Result | Notes |
| --- | --- | --- |
| TC-72 | Pass | Evidence below |
| TC-73 | Pass | Evidence below |
| TC-74 | Pass | Visible in the COD order's timeline below |
| TC-75 | Pass | `lib/admin-order-detail.test.ts` — the serialised detail contains no `unitCost`, no `totalCost` and neither cost figure |
| TC-76 | Pass | `/admin/orders/ZZZZZZZZZZ` signed in → 404 rendering "Nothing at this address" and "Back to orders", with no shop chrome |

## Evidence

### TC-07, TC-08, TC-09 — chrome, measured against the response body

```
== signed in, against the production build ==
/admin/login                    10320 bytes   markers: []
/admin/orders                   38742 bytes   markers: []
/admin/orders/DZX2DS3U5N        36969 bytes   markers: []

== storefront positive control ==
/                          200  markers: [site-schema wa.me]
/shop                      200  markers: [site-schema wa.me]
/definitely-not-a-page     404  markers: [site-schema wa.me]
/product/BOGUS             404  markers: [site-schema wa.me]
```

Markers grepped for: `wa.me`, `site-schema`, `gtag`, `Crafted in India`, `Free shipping`.

`/admin/login` was **39,236 bytes** before the catch-all route moved the storefront's 404 out of
the root. 22 KB of that was the shop header, footer, WhatsApp button and the whole catalogue
index, serialised into the flight payload as the not-found fallback tree — invisible on screen,
and the reason a `grep` for `wa.me` still found the button after the layouts were split. It is
10,320 bytes now.

### TC-10, TC-11 — ADR-041's routing, unchanged

```
Host: admin.morchadigems.com
  GET /            (no cookie)  307 → http://admin.morchadigems.com/login
  GET /login                    200
  GET /robots.txt               User-agent: *  Disallow: /

storefront robots.txt           Disallow: /admin
sitemap.xml                     70 <url> entries
```

### TC-68, TC-69, TC-70, TC-71 — the endpoints over real HTTP

```
--- unauthenticated (no cookie) ---
307 → /admin/login                       (middleware, before the handler)
--- forged cookie ---
{"status":"REJECTED","error":"UNAUTHENTICATED",...}                        [401]
--- invalid transition: placed → delivered ---
{"status":"REJECTED","error":"INVALID_TRANSITION",
 "message":"An order that is Placed cannot become Delivered."}             [422]
--- full walk ---
{"status":"UPDATED"} × 3                 packed, shipped, delivered        [200]
--- cancelled with no reason ---
{"status":"REJECTED","error":"REASON_REQUIRED"}                            [422]
--- cancelled with no amount ---
{"status":"REJECTED","error":"REFUND_AMOUNT_REQUIRED"}                     [422]
--- cancelled refunding more than was collected ---
{"status":"REJECTED","error":"REFUND_AMOUNT_TOO_HIGH",
 "message":"Only ₹259 was collected up front, so no more than that can go back."} [422]
--- cancelled, full refund of ₹259 ---
{"status":"UPDATED"}                                                       [200]
--- rto from delivered ---
{"status":"REJECTED","error":"INVALID_TRANSITION",
 "message":"An order that is Delivered cannot become RTO."}                [422]
--- anything from returned ---
{"status":"REJECTED","error":"INVALID_TRANSITION",
 "message":"An order that is Returned cannot become Delivered."}           [422]
--- partial_cod: shipped → cancelled, ₹100 advance returned ---
{"status":"UPDATED"}                                                       [200]
--- item received back on a placed order ---
{"status":"REJECTED","error":"ITEM_RETURN_NOT_EXPECTED"}                   [422]
--- cod collected on a prepaid order ---
{"status":"REJECTED","error":"NO_COD_TO_COLLECT"}                          [422]
--- address edit, placed order ---
{"status":"UPDATED"}                                                       [200]
--- the same address again ---
{"status":"UNCHANGED"}                                                     [200]
--- address edit, delivered order ---
{"status":"REJECTED","error":"ADDRESS_LOCKED"}                             [422]
--- address edit, pincode 012345 ---
{"status":"REJECTED","error":"ADDRESS_INVALID",
 "message":"A PIN code does not start with 0"}                             [422]
--- lowercase order number in the URL ---
{"status":"UPDATED"}                                                       [200]
--- unknown order number ---
{"status":"REJECTED","error":"NOT_FOUND"}                                  [404]
```

`shipped → cancelled` succeeding is the owner's rule from ADR-044 exercised end to end, not
only in a unit test.

### TC-72 — a mid-lifecycle order, rendered

`/admin/orders/KVKF8R97YN`, a manually created `cod` order, walked to `packed`, with its address
corrected and its COD collection recorded. Tags stripped from the real response body:

```
Order KVKF8R97YN · Morchadi Gems admin
Morchadi Gems admin   Orders   Signed in as adminmorchadi2026   Sign out
← All orders
KVKF8R97YN   Packed
Placed 20 Aug 2026, 04:00 pm · last changed 20 Aug 2026, 04:09 pm

Items — 2 lines, priced as they were at checkout
  Rainbow Baguette Eternity Ring              P021   ₹398   2 × ₹199
  Heart Floating Locket with Birthstone Charms P003   ₹450   1 × ₹450
  Subtotal ₹848    Shipping ₹60    Total ₹908

Customer and delivery — 9822200022
  Rohit Malhotra, 44 Civil Lines, Near Ganpati Mandir, Jaipur, Rajasthan 302016
  9822200022   rohit@example.com
  [Edit address]

History — Every recorded change to this order, oldest first
  Placed     20 Aug 2026, 04:00 pm · system
  Placed     20 Aug 2026, 04:02 pm · adminmorchadi2026
             Address updated (line2, pincode)
  Packed     20 Aug 2026, 04:09 pm · adminmorchadi2026

Status — Currently Packed
  Move to:  · Choose a status   · Shipped   · Cancelled
  [Save status change]

Receipt tracking — Independent of the status above. Tick each when it actually happens
  [x] COD amount collected     Recorded 20 Aug 2026, 04:02 pm

Money
  Payment type        COD
  Prepaid             ₹0
  Due on delivery     ₹908
  Refund              No decision recorded
  Cashfree order              MG_FIXTURE_KVKF8R97YN
  Cashfree payment status     NOT_ATTEMPTED
```

Everything the plan asked for is in there: the dropdown offers Shipped and Cancelled and
nothing else, the address is editable because the order is `packed`, the COD toggle is present
because the payment type is `cod`, the item-received-back toggle is absent because nothing is
coming back, the refund reads "No decision recorded" rather than `₹0`, and the two Cashfree
identifiers are in fine print at the bottom while the ten-character number is the heading. The
second `Placed` row in the timeline is the address correction (TC-74) — same status, named
fields, operator's username.

### TC-73 — a terminal order with refund information, rendered

`/admin/orders/DZX2DS3U5N`, walked `placed → packed → shipped → delivered → returned` over HTTP
with a partial refund, then marked physically received back:

```
Order DZX2DS3U5N · Morchadi Gems admin
← All orders
DZX2DS3U5N   Returned
Placed 20 Aug 2026, 04:02 pm · last changed 20 Aug 2026, 04:03 pm

Items — 1 line, priced as they were at checkout
  Red Solitaire Thread Ring   P015   ₹210   1 × ₹210
  Subtotal ₹210    Shipping ₹60    Total ₹270

Customer and delivery — 9812300011
  Ananya Iyer, 12 Rose Villa, Bandra West, Mumbai, Maharashtra 400050
  9812300011   ananya@example.com
  This order has finished, so its address is the record of where it was sent rather than
  a field.

History — Every recorded change to this order, oldest first
  Placed     20 Aug 2026, 04:02 pm · system
  Packed     20 Aug 2026, 04:02 pm · adminmorchadi2026
  Shipped    20 Aug 2026, 04:02 pm · adminmorchadi2026
  Delivered  20 Aug 2026, 04:02 pm · adminmorchadi2026
  Returned   20 Aug 2026, 04:03 pm · adminmorchadi2026
             Chain clasp arrived bent. Item refunded, shipping retained.

Status — Currently Returned
  This order is Returned and has reached the end of its lifecycle. Nothing moves it from here.

Receipt tracking — Independent of the status above. Tick each when it actually happens
  [x] Item received back     Recorded 20 Aug 2026, 04:03 pm

Money
  Payment type        Prepaid
  Prepaid             ₹270
  Due on delivery     ₹0
  Refund              ₹210 on 20 Aug 2026, 04:03 pm
  Cashfree order              MG_FIXTURE_DZX2DS3U5N
  Cashfree payment status     PAID
```

The address is read-only with a sentence saying why, there is no status control at all because
`returned` is final, the refund shows the amount and the day it was recorded, and the reason the
operator typed is on the timeline beside their name. `₹210 of ₹270` is the partial refund: the
item came back, the shipping did not.

An `rto` fixture rendered the same way with `Refund ₹0: nothing was returned to the customer` —
the zero decision, distinguishable on the page from the COD order's "No decision recorded".

## Two things that were fixed during the run

**The WhatsApp button was still in the admin page's bytes after the layouts were split.** The
first split was structurally correct — the panel rendered no chrome — but a `grep` of the
response still found `wa.me`, `site-schema` and the whole catalogue index. The cause was
`app/not-found.tsx`: Next serialises a not-found tree into the payload of every route beneath
the segment it sits in. Fixed with the catch-all route described in
[ADR-044](../decisions/ADR-044-admin-order-detail-and-layout-split.md), and the fix is what
made TC-07 assert against the response body rather than against the rendered DOM.

**The locked-address note claimed a parcel had left when none had.** An order cancelled an hour
after it was placed showed "The parcel has left, so this address is now a record of where it was
sent". It never shipped. The note is now derived from the status: one sentence for `shipped`,
another for a finished order.

## Known and expected

- **The detail page's controls need JavaScript**, where the order list ships none. Argued in
  ADR-044: the reason and refund fields have to appear when an unhappy status is chosen, and
  the address form is the storefront's own live-validating component. The submit path is still
  one POST to a handler that re-validates everything.
- **The `[...unmatched]` catch-all is a route that exists for a framework reason.** It has a
  docstring saying so, and TC-05 fails if it is deleted.
- **The concurrency guard is not load-bearing yet.** One operator means the `CONCURRENT_CHANGE`
  path is nearly unreachable in practice. A second operator would want real optimistic locking.
- **No COD order can be created through checkout.** Part G's toggle was exercised against a
  manually created `cod` row and a `partial_cod` row, which is the only way it can be exercised
  until an operator-created order flow exists.

## Summary

76 planned cases: **76 passed, 0 failed, 0 skipped.** Two defects were found by looking at real
output rather than by a test — the flight-payload chrome and the untrue locked-address sentence
— and both are fixed and covered.

1169 automated tests pass, 89 of them new. Shippable.
