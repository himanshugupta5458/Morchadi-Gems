# Test Plan: The order detail screen, and the admin layout split

- **Scope:** `/admin/orders/{id}` — the full order view, the status control and its lifecycle
  rules, the forced refund decision, the reason capture, the address-editing window, the RTO and
  COD receipt toggles, and the three route handlers behind them. Plus the layout split: the
  storefront's chrome must be absent from every rendered admin page, and ADR-041's hostname
  rewrite, `robots.txt` exclusions and sitemap must be unchanged by it. **Not covered:** the
  analytics dashboard, the customer-facing tracking page, and transactional email — none of
  those exist yet.
- **Prerequisites:** local Postgres up (`docker compose up -d`) with migrations applied, an
  admin row (`npm run seed:admin`), and orders in varying states. The manual cases below use
  fixture orders created directly through Prisma and then walked with the real endpoints.

## Cases

### Part A — the admin layout shell

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The storefront still has all of its chrome | Render `app/(storefront)/layout.tsx` to static markup | `wa.me`, the footer's copyright line and the `site-schema` script are all present | Automated |
| TC-02 | An admin page has none of it | Render the root layout wrapping `app/admin/layout.tsx` | None of the three markers appears anywhere in the HTML | Automated |
| TC-03 | An admin page still has a document and a nav | Same render | `<html>`, `<body>`, "Morchadi Gems admin", and the page's own content | Automated |
| TC-04 | The login page loses the chrome by the same mechanism | Render the root layout wrapping the admin layout wrapping `/admin/login` | "Admin sign in" present; no storefront marker | Automated |
| TC-05 | The storefront's 404 is not in the panel's payload | Assert the file layout: no `app/not-found.tsx`, a 404 and a catch-all inside `(storefront)`, and one under `app/admin` | All four hold | Automated |
| TC-06 | The root layout imports no storefront component | Read `app/layout.tsx` | No `Header`, `Footer`, `WhatsAppButton`, `CartProvider` or `JsonLd` | Automated |
| TC-07 | **A rendered admin page really contains none of it** | `curl` a signed-in `/admin/orders/{id}` against a production build | No `wa.me`, `site-schema`, `gtag` or footer text in the response body | Manual |
| TC-08 | An unmatched storefront URL still gets the shop's 404 | `curl /definitely-not-a-page` | 404, with the shop header, footer and WhatsApp button | Manual |
| TC-09 | `notFound()` from a real page still resolves | `curl /product/BOGUS` | 404 with the shop chrome | Manual |
| TC-10 | Existing hostname routing is unchanged | `curl` with `Host: admin.morchadigems.com` for `/`, `/login`, `/robots.txt` | Redirect to `/login`; 200; the deny-all admin `robots.txt` | Manual |
| TC-11 | Storefront `robots.txt` and `sitemap.xml` are unchanged | `curl` both | `Disallow: /admin` present; sitemap lists the same routes | Manual |
| TC-12 | ADR-041's own suite still passes untouched | `lib/admin-routing.test.ts`, `lib/robots.test.ts`, `lib/sitemap.test.ts`, `lib/admin-orders-access.test.ts` | All pass with no edits to their assertions | Automated |

### Part B — the lifecycle

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-13 | The table names every status and invents none | Compare against the Prisma enum | Exhaustive, and no destination outside it | Automated |
| TC-14 | No status can transition to itself | All seven | Never in its own list | Automated |
| TC-15 | The parcel moves one step at a time | `placed→shipped`, `placed→delivered`, `packed→delivered` | All refused | Automated |
| TC-16 | **Cancellation is reachable from placed, packed *and* shipped** | Each edge | All three allowed | Automated |
| TC-17 | A finished order cannot be cancelled | `delivered`, `rto`, `returned`, `cancelled` → `cancelled` | All refused | Automated |
| TC-18 | `returned` is reachable only from `delivered` | All seven sources | Only `delivered` | Automated |
| TC-19 | `rto` is reachable only from `shipped` | All seven sources | Only `shipped` | Automated |
| TC-20 | The three bad endings are final | `rto`, `returned`, `cancelled` | No next status | Automated |
| TC-21 | Nothing returns an order to `placed` | All seven sources | Refused | Automated |
| TC-22 | Every status is reachable from `placed` | Breadth-first walk of the table | All seven reached | Automated |
| TC-23 | The validator agrees with the table on all 49 pairs | `planOrderStatusChange` for every ordered pair | Accepts exactly the table's edges | Automated |
| TC-24 | An unrecognised status is refused before the transition is judged | `""`, `"shipping"`, `"PACKED"` | `UNKNOWN_STATUS` | Automated |

### Part C — reason and refund

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-25 | A reason is required for `rto`, `returned` and `cancelled` | Submit each with a blank reason | `REASON_REQUIRED` | Automated |
| TC-26 | …and optional and absent for the other four | `packed`, `shipped`, `delivered` with no reason | Accepted, `reason: null` | Automated |
| TC-27 | A reason offered on an ordinary status is kept | `packed` with a reason | Trimmed and stored | Automated |
| TC-28 | An over-long reason is refused server-side | 301 characters | `REASON_TOO_LONG` | Automated |
| TC-29 | A COD order forces the no-refund path | `cancelled` on a `cod` order without the acknowledgement | `REFUND_NOT_ACKNOWLEDGED` | Automated |
| TC-30 | …and accepts the acknowledgement alone | Same with `refundAcknowledged: true` | `isRefunded: false`, `refundAmount: 0` | Automated |
| TC-31 | …ignoring any amount such a submission carried | COD with `refundAmount: "9999"` | Still `0` | Automated |
| TC-32 | A prepaid order requires an amount, not an acknowledgement | `cancelled` with only `refundAcknowledged` | `REFUND_AMOUNT_REQUIRED` | Automated |
| TC-33 | An amount that is not money is refused | `"half"`, `"1.005"`, `"-1"`, `"1,200"` | `REFUND_AMOUNT_INVALID` | Automated |
| TC-34 | More than was collected cannot go back | `amountPrepaid + 1` | `REFUND_AMOUNT_TOO_HIGH` | Automated |
| TC-35 | A partial-COD refund is capped at the advance, not the total | Advance 300, order 900 | 300 accepted, 301 refused | Automated |
| TC-36 | `isRefunded` is derived at the boundary | `"0"`, `"0.00"`, `"0.01"`, full | `false, false, true, true` with matching amounts | Automated |
| TC-37 | No other status asks the refund question | `packed`, `shipped`, `delivered` | `refund: null` | Automated |
| TC-38 | A real refund writes all three columns | Cancel a prepaid order with a full amount | `is_refunded`, `refund_amount`, `refunded_at` all set | Automated |
| TC-39 | **A zero decision records the amount but claims no refund** | RTO with `"0"` | `refund_amount = 0`, `is_refunded = false`, `refunded_at = NULL` | Automated |
| TC-40 | An ordinary step leaves the refund columns untouched | `packed → shipped` | All three unchanged | Automated |

### Part D — writes, audit and atomicity

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-41 | A status change updates the order and appends one history row | `placed → packed` | `status = packed`; two history rows; the second names the session admin | Automated |
| TC-42 | A refused change writes nothing at all | Invalid transition, then a missing reason | Status unchanged, still one history row | Automated |
| TC-43 | An unknown order is reported, not created | `applyAdminOrderStatusChange` on a nonexistent id | `NOT_FOUND` | Automated |
| TC-44 | The status change and its audit row are one transaction | Read the handler | Both writes inside `prisma.$transaction` | Manual |
| TC-45 | A concurrent change is refused rather than silently applied | Status-guarded `updateMany` returns 0 | `CONCURRENT_CHANGE`, no history row | Manual |

### Part E — the address window

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-46 | Editable while `placed` and while `packed` | Correct the address in both states | `UPDATED`, address stored, status unchanged | Automated |
| TC-47 | The edit is audited without being a status change | Same | One extra history row, same status, reason `Address updated (line2, pincode)` | Automated |
| TC-48 | **Blocked from `shipped` onwards and in every terminal state** | Five states | `ADDRESS_LOCKED`; stored address unchanged; no history row | Automated |
| TC-49 | An unchanged submission writes nothing | Resubmit the stored address | `UNCHANGED`, no history row | Automated |
| TC-50 | A corrected address is held to the checkout validator | PIN code `012345` | `ADDRESS_INVALID`, stored address unchanged | Automated |
| TC-51 | Only what moved is named | `findChangedAddressFields` with whitespace-only differences | Empty; and exactly the changed fields otherwise | Automated |
| TC-52 | The panel offers the edit before dispatch | Render the panel with `isEditable` | "Edit address" button, no locked note | Automated |
| TC-53 | …and renders read-only text after, with no control | `isEditable={false}` | Locked note; no button, no input | Automated |
| TC-54 | The form is the storefront's own, prefilled | Open the editor | PIN code field carries the stored value | Automated |
| TC-55 | The browser refuses what the server would refuse | Bad PIN code in the form | Message shown, no request sent | Automated |

### Part F — the receipt toggles

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-56 | Each flag stamps and clears its own timestamp | Tick, tick the other, untick the first | Timestamps set and cleared independently | Automated |
| TC-57 | Neither writes a history row | Tick `itemReceivedBack` on a returned order | History unchanged | Automated |
| TC-58 | `itemReceivedBack` is refused where nothing is coming back | On a `shipped` order | `ITEM_RETURN_NOT_EXPECTED` | Automated |
| TC-59 | `codAmountCollected` is refused on a prepaid order | Prepaid | `NO_COD_TO_COLLECT` | Automated |
| TC-60 | **Toggling is independent of the status change** | `shipped → rto`, then tick later | Flag false right after the change; true after the toggle; status untouched | Automated |
| TC-61 | The UI posts only the field that was toggled | Click one checkbox | Body names one field | Automated |
| TC-62 | …including when unticking | Untick | `{ field: false }` | Automated |
| TC-63 | The recorded moment is shown, not only the flag | Render with a timestamp | "Recorded {date}" | Automated |

### Part G — access to the three endpoints

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-64 | Middleware gates all three on both hostnames | `decideAdminRoute` with and without a cookie | Redirect to login without; rewrite with | Automated |
| TC-65 | Each handler refuses a request with no session | Call all three | 401 `UNAUTHENTICATED` | Automated |
| TC-66 | …and a forged cookie that got past middleware | Unknown token | 401 | Automated |
| TC-67 | The action URLs drop `/admin` on the admin hostname | `resolveAdminOrderActionHref` | `/api/orders/{id}/{action}` vs `/admin/api/...` | Automated |
| TC-68 | **A real signed-in `curl` walks an order end to end** | `placed → packed → shipped → delivered` over HTTP | Four 200s; history and status correct in `psql` | Manual |
| TC-69 | …and a real invalid move is refused over HTTP | `placed → delivered` | 422 `INVALID_TRANSITION` | Manual |
| TC-70 | An unknown order number 404s the endpoint | `ZZZZZZZZZZ` | 404 `NOT_FOUND` | Manual |
| TC-71 | A lowercased order number in the URL still resolves | Lowercase id | 200 | Manual |

### Part H — the rendered detail page

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-72 | A mid-lifecycle order renders completely | Open a `placed` COD order | Line items with snapshot names and prices, totals, customer, address, editable; status control offering Packed and Cancelled; COD toggle; money block; Cashfree ids in fine print | Manual |
| TC-73 | A terminal order renders its refund and its story | Open a `returned` order | "This order is Returned…" in place of the control; refund amount and date; item-received-back ticked with its moment; five history rows including the reason | Manual |
| TC-74 | The timeline shows address edits in place | Order with a corrected address | A row carrying the unchanged status and `Address updated (…)` | Manual |
| TC-75 | The page carries no cost figure | Inspect the serialised props | No `unitCost`, no `totalCost` | Automated |
| TC-76 | An unknown order number lands on the panel's own 404 | `/admin/orders/ZZZZZZZZZZ` signed in | The admin 404, not the shop's | Manual |

## Gate

`npm run typecheck && npm run lint && npm run test:run && npm run validate:products && npm run build`
