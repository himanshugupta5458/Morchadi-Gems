# Test Plan: The admin order list, and the order number made visible

- **Scope:** the ten-character order id surfaced end to end (create-order response →
  `/payment` stamp → `/order-confirmation` display), and `/admin/orders` — the Active/Resolved
  split, status and date filters, search, sort, pagination, and the two gates that stand in
  front of the route. **Not covered:** the order detail page, status changes, refund and RTO
  controls — all of those are the next prompt, and the row link that points at
  `/admin/orders/{id}` is expected to 404 until then.
- **Prerequisites:** local Postgres up (`docker compose up -d`) with migrations applied,
  `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` set to sandbox credentials in `.env.local`, an
  admin row (`npm run seed:admin`), and the dev server on `localhost:3000`.

## Cases

### Part A — the order number

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Create-order returns both ids under unambiguous names | Drive `POST /api/create-order` against real Postgres | 200 whose keys are exactly `cashfreeOrderId`, `trackingId`, `paymentSessionId`, `mode` | Automated |
| TC-02 | `trackingId` is the row that was written | Same call, then read `orders` by `cashfree_order_id` | `body.trackingId === written.id`, and it is not the Cashfree id | Automated |
| TC-03 | A capture failure returns a null order number, not a fabricated one | Force the Postgres write to fail | 200, `trackingId: null`, same four keys | Automated |
| TC-04 | The browser refuses the old response shape | Hand `isCreateOrderSuccess` a prompt-48 body | `false` | Automated |
| TC-05 | The browser refuses an empty or missing order number | `trackingId: ""` and key absent | `false` for both; `null` accepted | Automated |
| TC-06 | Both ids are stamped onto the checkout bundle | Stamp, then re-read through `parseCheckoutValue` | `orderId` and `trackingId` both survive | Automated |
| TC-07 | An unusable stored order number costs the stamp, not the bundle | Stamp `trackingId` as `""`, `12345`, `null`, an object | Bundle parses; `trackingId` absent | Automated |
| TC-08 | The order number is shown only for the order being confirmed | `readBundleTrackingId` with a bundle stamped to another Cashfree order | `null` | Automated |
| TC-09 | It is shown regardless of payment outcome | Same bundle, `PAID` / `PENDING` / `FAILED` | Order number resolves in all three | Automated |
| TC-10 | A confirmed order shows it prominently | Render `/order-confirmation` with a stamped bundle and a `PAID` verification | "Your order number" heading, the id in a `<strong>` at `text-heading` | Automated |
| TC-11 | The Cashfree id survives as fine print, not as the order's name | Same render | "Payment reference {MG_…}" present; no bare "Order number" label | Automated |
| TC-12 | A pending or failed payment names the order in its footnote | Render both states | `Order number {10-char}` in the footnote | Automated |
| TC-13 | No bundle degrades to the Cashfree reference | Render with no bundle (a refresh after the clear) | "Payment reference" shown; no order number claimed | Automated |
| TC-14 | A leftover bundle cannot label this order | Bundle stamped to a different order, `PAID` | Neither the other order number nor the heading appears | Automated |
| TC-15 | **A real sandbox order shows it on the real page** | Real browser: product → cart → address → pay → real Cashfree sandbox session → simulate SUCCESS → return URL | The confirmation page renders "YOUR ORDER NUMBER" and the ten-character id from `orders.id` | Manual |

### Part B — the list query

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-16 | Active and Resolved partition the statuses | Compare the two constants against the Prisma enum | Disjoint, exhaustive, and equal to `OrderStatus` | Automated |
| TC-17 | Active shows only placed/packed/shipped | Query against seeded rows in all seven statuses | Exactly those three | Automated |
| TC-18 | Resolved shows only delivered/rto/returned/cancelled | Same seed | Exactly those four | Automated |
| TC-19 | The default view is Active, newest first, page one | `parseAdminOrderQuery({})` | The documented defaults | Automated |
| TC-20 | A status from the other view is refused | `?view=active&status=delivered` | `status: null` — the tab's full range, not an empty list | Automated |
| TC-21 | A hand-edited URL falls back rather than erroring | Nonsense view, status, sort, page, dates | Every field at its default | Automated |
| TC-22 | A search term is bounded | 500-character term | Truncated to 60 | Automated |
| TC-23 | Search finds an order by its full order number | Seeded id | That row only | Automated |
| TC-24 | …and by a lowercase partial of it | Partial, lowercased | That row only | Automated |
| TC-25 | …and by the customer's phone | Full number | That customer's rows | Automated |
| TC-26 | …and by the last digits of it | Four digits | Includes the row | Automated |
| TC-27 | …and by part of the customer's name | Partial name, lowercased | That row | Automated |
| TC-28 | **A partial order number does not match unrelated phones** | Term with letters and digits whose digits appear inside another customer's phone | Only the order-number match | Automated |
| TC-29 | A term matching nothing returns nothing | Nonsense term | Empty, `totalCount: 0` | Automated |
| TC-30 | Sort is newest first by default | Seeded rows out of order | `createdAt` descending | Automated |
| TC-31 | Sort by total works both ways | `total-high`, `total-low` | Descending / ascending | Automated |
| TC-32 | Every sort breaks ties on the unique id | All four sorts | Last clause is `id` | Automated |
| TC-33 | Date ranges are Indian calendar days | Seed an order at 23:00 UTC on 30 June | Appears under 1 July, not 30 June | Automated |
| TC-34 | The upper bound is exclusive at the next day's start | `endOfIstDayUtc` | `+24h` from the day's start | Automated |
| TC-35 | A malformed date is dropped, not guessed | `2026-02-30`, `01-07-2026` | `null`, and the filter is absent | Automated |
| TC-36 | A full page reports the total that matched | Seed 30 rows | 25 rows, `totalCount: 30`, `pageCount: 2` | Automated |
| TC-37 | Page two is the remainder, with nothing on both pages | Pages 1 and 2 | 5 rows; 30 distinct ids across the two | Automated |
| TC-38 | A page past the end clamps rather than showing nothing | `page=99` | Last page, non-empty | Automated |
| TC-39 | The list selects no margin data | Inspect a row's keys | No `totalCost`, no `unitCost` | Automated |
| TC-40 | Links omit defaults and reset the page on a filter change | `buildAdminOrdersHref` | Clean `/orders` for defaults; `page` dropped when a filter changes and kept when the page changes | Automated |

### Part B — access

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-41 | Middleware turns away a cookieless browser | `decideAdminRoute` for `/admin/orders` | 307 to `/admin/login` | Automated |
| TC-42 | …and on the admin subdomain, in that host's URL space | `/orders` on `admin.morchadigems.com` | Redirect to `/login` | Automated |
| TC-43 | …and for the detail route the rows link to | `/admin/orders/{id}` | Redirect to login | Automated |
| TC-44 | The list is not a public admin path | With a cookie present | Rewrite to `/admin/orders` | Automated |
| TC-45 | The storefront domain does not serve it at all | Production `NODE_ENV`, shop hostname, cookie present | Redirect to `/` | Automated |
| TC-46 | The Node-side gate redirects a cookieless render | Render the protected layout with no cookie | Redirects to `/admin/login` | Automated |
| TC-47 | …a forged cookie that got past middleware | Unknown token | Redirects | Automated |
| TC-48 | …and renders for a live session | Real session row | No redirect | Automated |
| TC-49 | **A real browser is redirected** | `GET /admin/orders` signed out | Lands on `/admin/login` | Manual |

### Part C — the rendered list

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-50 | The real dev-database orders render correctly | Sign in, open `/admin/orders` | Every column correct against `psql` | Manual |
| TC-51 | Statuses are visually distinguishable | Same page across both tabs | One hue per status, label always written out | Manual |
| TC-52 | Both tabs partition the real rows | Active and Resolved | Active + Resolved = every order, none in both | Manual |
| TC-53 | Filters, search and sort behave on real data | Exercise each through the URL | As the automated cases predict | Manual |
| TC-54 | A row links to the detail page | Inspect the anchor | `/admin/orders/{10-char id}` — **404 until the next prompt, expected** | Manual |
| TC-55 | An empty result explains itself | Date range with no orders | "No orders match these filters" | Manual |

## Gate

`npm run typecheck && npm run lint && npm run test:run && npm run validate:products && npm run build`
