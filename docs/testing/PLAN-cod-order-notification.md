# Test Plan: Cash-on-delivery order notification

- **Scope:** the WhatsApp message the owner receives when a cash-on-delivery order is placed —
  its content, the conditions under which it is sent, and its inability to affect the checkout
  it is triggered from. Covers `composeCodOrderMessage`, `notifyOwnerOfCodOrder`, and the COD
  branch of `/api/create-order`.

  Explicitly **not** covered, because it is unchanged and has its own tests: the prepaid
  notification, its Cashfree `PAID` warrant in `dispatchAdminNotification`, and
  `/api/notify-admin`. Two cases below exist only to prove that neither online path acquired a
  notification from `/api/create-order`.
- **Prerequisites:** local Postgres from `docker-compose.yml` and a `DATABASE_URL` that reaches
  it. `CALLMEBOT_PHONE` and `CALLMEBOT_APIKEY` are set **per test**, never globally — the
  default state of this repository is unset, which is itself the subject of TC-13. No test may
  reach the real CallMeBot: every send is either a mocked `fetchImpl` or a stubbed global
  `fetch`.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The message names its kind first | Compose a COD message | First line is `*New Cash on Delivery Order - {brand}*` | Automated |
| TC-02 | It never claims money moved | Compose a COD message | No `*Paid:*`, no "payment received"; carries `*Payment:* Cash on delivery. Nothing has been paid yet.` | Automated |
| TC-03 | It states what is owed at the door | Compose with `amountDue: 746` | Contains `*Due on delivery:* ₹746` | Automated |
| TC-04 | Both identifiers are printed | Compose | Contains `*Order:* {trackingId}` and `*Reference:* {COD_…}` | Automated |
| TC-05 | Items carry quantity and chosen options | Compose with one optioned and one plain line | `1. … x2` with `Letter: A` on the next line; `2. … x1` | Automated |
| TC-06 | The delivery address is complete | Compose | Name, both address lines, city/state/pincode, phone, email | Automated |
| TC-07 | The money breakdown is the server's own | Compose | Subtotal, shipping and total all printed | Automated |
| TC-08 | The closing line asks for cash, not for a payment check | Compose | Dispatch window, "Collect ₹… in cash at delivery", the order number, and **no** mention of Cashfree | Automated |
| TC-09 | Campaign section, where the order has one | Compose with full `utm` | `*Came from*` between the order block and `*Items*`, source/medium/campaign in order | Automated |
| TC-10 | No campaign section otherwise | Compose with `undefined`, `null`, and a `utm` of only `term` | No "Came from" in any of the three | Automated |
| TC-11 | Real newlines, encodable | Compose | Contains `\n`; `encodeURIComponent` yields `%0A` | Automated |
| TC-12 | One send, carrying exactly that message | `notifyOwnerOfCodOrder` with credentials and a mock fetch | `SENT`; one call; URL is the CallMeBot endpoint; `text` equals the composed message | Automated |
| TC-13 | Unset keys switch the feature off | Same, credentials `null` | `SKIPPED_NOT_CONFIGURED`; no fetch | Automated |
| TC-14 | A non-2xx is not an exception | Mock resolves `{ ok: false }` | Resolves `FAILED` | Automated |
| TC-15 | A network error is not an exception | Mock rejects `ECONNREFUSED` | Resolves `FAILED` | Automated |
| TC-16 | A timeout is not an exception | Mock rejects `TimeoutError` | Resolves `FAILED` | Automated |
| TC-17 | Same short leash as the paid message | Inspect the request init | `GET`, and an abort `signal` is present | Automated |
| TC-18 | A real COD checkout notifies once, correctly | `POST /api/create-order` with `paymentPath: "cod"`, keys set, global `fetch` stubbed | Zero requests to Cashfree; exactly one to CallMeBot; its text names the response's `trackingId`, `codOrderReference` and `amountDue`, says nothing about being paid | Automated |
| TC-19 | CallMeBot failing cannot fail the checkout | Same, with `fetch` throwing `TimeoutError` | `200`, `paymentType: "cod"`, a real `trackingId`, and the order row present with `amountDue = total` | Automated |
| TC-20 | No row, no message | `paymentPath: "cod"` on a cart with a barred piece | `400 PAYMENT_PATH_UNAVAILABLE`; no CallMeBot request | Automated |
| TC-21 | A fully prepaid order is untouched | `POST` with no `paymentPath`, keys set | `200`; one Cashfree request; **no** CallMeBot request | Automated |
| TC-22 | A part-paid order is untouched | `paymentPath: "partial"` against a floor, keys set | `200`, `partial_cod`; one Cashfree request; **no** CallMeBot request | Automated |
| TC-23 | The key still cannot reach the browser | Existing `lib/notify-boundary.test.ts` after the new module is added | No `"use client"` module reaches `lib/notify.ts` at any depth | Automated |
| TC-24 | TC-18 genuinely discriminates | Remove the `notifyOwnerOfCodOrder` call from the route and re-run | TC-18 fails; restoring it passes | Manual |
| TC-25 | End to end against a running server | `npm run dev`, place a COD order by `curl`, read the server log | The notification is attempted, and its message is the one specified above | Manual |
