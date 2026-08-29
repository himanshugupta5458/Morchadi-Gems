# Test Plan: Customer order-confirmation email

- **Scope:** the transactional email a shopper receives via Resend for all three checkout
  paths — its content, the conditions under which it is sent, its inability to affect the
  checkout or the confirmation screen it is triggered from, and the balance-due honesty it adds
  beyond what the equivalent WhatsApp message states. Covers `lib/customer-email-message.ts`,
  `lib/notify-customer-email.ts`, the COD branch of `/api/create-order`, and the paid/partial
  branch of `/api/notify-admin`.

  Explicitly **not** covered, because it is unchanged: `composeAdminOrderMessage`,
  `composeCodOrderMessage`, `sendOwnerWhatsApp`, `dispatchAdminNotification` and
  `notifyOwnerOfCodOrder`. Cases below exist only to prove the email is genuinely additive —
  the existing WhatsApp assertions in `lib/notify.test.ts`, `lib/notify-cod.test.ts` and the
  rest of `lib/checkout-payment-paths.test.ts` still pass unmodified.
- **Prerequisites:** local Postgres from `docker-compose.yml` and a `DATABASE_URL` that reaches
  it, for the route-level cases. `RESEND_API_KEY` is set **per test**, never globally — the
  default state of this repository is unset, which is itself the subject of one case. No test
  may reach the real Resend API: every send is either an injected `sendImpl` or a stubbed
  global `fetch` intercepting `RESEND_API_ENDPOINT`.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The COD email has an honest, specific subject | Compose | `Your Morchadi Gems cash-on-delivery order is placed`; never contains "confirmed" | Automated |
| TC-02 | It says plainly that nothing has been paid | Compose | Contains "Nothing has been paid yet"; never "Payment received" in either casing | Automated |
| TC-03 | It gives the amount due, the order number and the items | Compose | Contains the formatted amount, `trackingId`, item names and chosen options | Automated |
| TC-04 | It gives the full delivery address | Compose | Name, both address lines, city/state/pincode | Automated |
| TC-05 | The tracking link is prominent when present, absent when not | Compose with and without a `trackingUrl` | `Track your order: {url}` present/absent accordingly | Automated |
| TC-06 | Address and item text is escaped, not trusted as markup | Compose with `<script>` in the name | No raw `<script>` tag in the output; escaped entity present | Automated |
| TC-07 | Never mentions cost or margin data | Compose | `html.toLowerCase()` and `subject.toLowerCase()` do not contain `"cost"` | Automated |
| TC-08 | The fully-paid email is honest and complete | Compose with `amountDue: 0` | Subject `…order is confirmed`; contains "Nothing more is needed"; no "Due on delivery" | Automated |
| TC-09 | The partial-payment email states the balance due | Compose with `amountDue > 0` | Subject `…confirmed: balance due at delivery`; contains both the paid and due figures and "Due on delivery" | Automated |
| TC-10 | An unreadable balance is treated as nothing owing | Compose with `amountDue: null` | Renders as the fully-paid case, mirroring `OrderConfirmation.tsx`'s own precedent | Automated |
| TC-11 | Prints Cashfree's own amount, never the bundle's total | Compose with `amountPaid: 999`, `bundle.total: 1` | Contains ₹999 | Automated |
| TC-12 | Falls back to the Cashfree reference with no order number | Compose with `trackingId: null` | Contains the `cashfreeOrderId` | Automated |
| TC-13 | Degrades gracefully with no summary | Compose with `bundle: null` | Still names the order; no "Deliver to" section | Automated |
| TC-14 | Never mentions cost or margin data, across every `amountDue` state | Compose for `0`, a positive number, and `null` | No occurrence of `"cost"` in any | Automated |
| TC-15 | A send makes exactly one attempt, from the shop's address | `sendCustomerEmail` with a mock `sendImpl` | `SENT`; one call; correct `to`; `from` contains the verified domain | Automated |
| TC-16 | Skips silently with no Resend key | `sendCustomerEmail` with `apiKey: null` | `SKIPPED_NOT_CONFIGURED`; no call | Automated |
| TC-17 | Skips, not errors, with no address | `sendCustomerEmail` with `to: ""` and `"   "` | `SKIPPED_NO_EMAIL`; no call | Automated |
| TC-18 | An error Resend reports is a failure, not a throw | Mock resolves `{ data: null, error: {...} }` | Resolves `FAILED` | Automated |
| TC-19 | A rejected send is not a throw | Mock rejects | Resolves `FAILED` | Automated |
| TC-20 | A hung send gives up on a short, finite leash | Mock never resolves; fake timers advanced past `RESEND_TIMEOUT_MS` | Resolves `FAILED` | Automated |
| TC-21 | The COD orchestration sends once, addressed to the shopper | `sendCodOrderConfirmationEmail` | `SENT`; `to` is `order.address.email` | Automated |
| TC-22 | The COD orchestration skips gracefully with no address | Same, `address.email: ""` | `SKIPPED_NO_EMAIL`; no call | Automated |
| TC-23 | The paid/partial dispatch sends only when the server verified `PAID` | `dispatchOrderConfirmationEmail` for `PENDING`, `FAILED`, `NOT_FOUND`, `PAID` | `SKIPPED_NOT_PAID` for the first three; `SENT` for `PAID` | Automated |
| TC-24 | The paid/partial dispatch skips gracefully with no summary | Same, `bundle: null` | `SKIPPED_NO_EMAIL`; no call | Automated |
| TC-25 | A real COD checkout emails the shopper once, correctly | `POST /api/create-order` with `paymentPath: "cod"`, `RESEND_API_KEY` set, global `fetch` stubbed | Zero Cashfree requests; exactly one to `RESEND_API_ENDPOINT`; addressed to the test address; says nothing paid; names the real `trackingId` and amount due | Automated |
| TC-26 | Resend failing cannot fail the checkout | Same, with `fetch` throwing | `200`, `paymentType: "cod"`, a real `trackingId`, the order row present | Automated |
| TC-27 | A refused COD path sends no email | `paymentPath: "cod"` on a cart with a barred piece | `400`; no request to `RESEND_API_ENDPOINT` | Automated |
| TC-28 | The unset-key deployment state is proved incidentally | Every other case in `lib/checkout-payment-paths.test.ts` | No request to `RESEND_API_ENDPOINT` anywhere `RESEND_API_KEY` was not explicitly set for the test | Automated |
| TC-29 | The key still cannot reach the browser | `lib/notify-boundary.test.ts` after the new modules are added | No `"use client"` module reaches `lib/notify-customer-email.ts` at any depth; `RESEND` named in no client file | Automated |
| TC-30 | The existing WhatsApp suites are unaffected | `lib/notify.test.ts`, `lib/notify-cod.test.ts`, the WhatsApp describe blocks in `lib/checkout-payment-paths.test.ts` | All pass unmodified | Automated |
| TC-31 | End to end against a running server, all three order types | `npm run dev`, place a COD order, a fully prepaid order, and a partial order by `curl`, read the server log | An email send is attempted for each, with the correct, honest content per type | Manual |

TC-31 could not be run against the real Resend API in this environment (no `RESEND_API_KEY` was
present in `.env.local`, and this sandbox has no outbound internet access to verify delivery).
Substituted with a traced run of the real composers and dispatchers through an injected
`sendImpl` that logs the outgoing payload — see the result file for the transcript.

## Cases added for the branded visual template (prompt 106)

Scope addition only: the HTML structure and design tokens of the same two composers. TC-01
through TC-31 above still apply unmodified to the new markup — several of their assertions were
adapted for the new tag structure (a bordered `<table>` button in place of a plain link, the
literal `href="…"` checked instead of a `Track your order: {url}` sentence) without weakening
what they check, per this file's own convention that a plan is a living document.

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-32 | The order journey shows exactly one highlighted step, for every order type | Compose the COD email, a fully-paid email, a partial-payment email and a no-bundle degraded email; extract each `data-step="…" bgcolor="…"` pair from the `<!-- journey-start -->`/`<!-- journey-end -->` block | Four steps in order (`placed`, `packed`, `shipped`, `delivered`); exactly two distinct fill colours; `placed` is the odd one out | Automated |
| TC-33 | The order-placed timestamp appears when known, and the line is omitted (not blanked) when it is not | Compose with `createdAt` set, and again with `createdAt: null` | Contains the formatted date (`formatTrackingDate`, the same "20 August 2026" convention `/track` already uses) in the first case; no "Placed on" label at all in the second | Automated |
| TC-34 | The tracking link is a table-based button, prominent when present, wholly absent when not | Compose with and without `trackingUrl` | `href="{url}"` and the visible "Track your order" label present/absent accordingly; the raw URL never appears when there is no link | Automated |
| TC-35 | `orders.created_at` reaches both callers | `captureOrder`'s `CAPTURED` outcome and `lookupCapturedOrderForPaymentReference`'s `FOUND` result, against a real database | Both carry a `createdAt: Date` read from the same insert/`findUnique` that already ran — no second query | Automated (skips with no database, like its siblings) |
| TC-36 | Every honesty and content assertion from TC-01–TC-30 still passes against the new markup | Full existing suite, unmodified in substance | All pass | Automated |
| TC-37 | Full gate stays green after the template rewrite | `typecheck`, `lint`, `test:run`, `validate:products`, `build` | All green | Automated |
| TC-38 | The rendered HTML is visually reviewable without a real Resend send | Trace all three order types through the real composers, write each one's HTML to a file, open in a browser | Header, journey graphic, order details, payment box, address and tracking button all render as designed; alt text stands in for the logo when the image is blocked | Manual |
