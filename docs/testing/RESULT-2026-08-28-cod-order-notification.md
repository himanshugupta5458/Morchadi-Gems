# Test Result: Cash-on-delivery order notification — 2026-08-28

- **Plan:** [PLAN-cod-order-notification.md](PLAN-cod-order-notification.md)
- **Commit:** `a5f634e` plus the working tree of prompt 102
- **Environment:** local. Node 24, Postgres 16 from `docker-compose.yml`. Automated cases under
  Vitest against that Postgres. TC-25 against `next dev`. **No request reached the real
  CallMeBot in any case below**; every send was intercepted.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | |
| TC-02 | Pass | Asserts the absence of `*Paid:*` and of "payment received" in both casings |
| TC-03 | Pass | |
| TC-04 | Pass | |
| TC-05 | Pass | Option line asserted by its position, directly under the item it belongs to |
| TC-06 | Pass | |
| TC-07 | Pass | |
| TC-08 | Pass | "Cashfree" absent from the whole message, not only from the closing line |
| TC-09 | Pass | Heading asserted to fall between the order block and `*Items*` |
| TC-10 | Pass | `undefined`, `null`, and a `utm` carrying only `term` |
| TC-11 | Pass | |
| TC-12 | Pass | `text` compared against the composed message in full, not by substring |
| TC-13 | Pass | |
| TC-14 | Pass | |
| TC-15 | Pass | |
| TC-16 | Pass | |
| TC-17 | Pass | |
| TC-18 | Pass | Zero Cashfree requests, one CallMeBot request. Amount asserted as `formatRupees(body.amountDue)`, so the test cannot pass by printing some other figure |
| TC-19 | Pass | `200` and a real `trackingId` while every `fetch` throws `TimeoutError`; the row is present with `amountDue = total` |
| TC-20 | Pass | |
| TC-21 | Pass | Keys configured, and `/api/create-order` still sends nothing |
| TC-22 | Pass | Same, for `partial_cod` |
| TC-23 | Pass | `lib/notify-boundary.test.ts` green with the new module in the graph; `grep` over `.next/static` after `npm run build` finds no occurrence of `callmebot` or `CALLMEBOT` |
| TC-24 | **Pass** | The `notifyOwnerOfCodOrder` call was removed from the route and TC-18 failed on `expect(sent).toHaveLength(1)`; restoring it returned all 17 cases in that file to green |
| TC-25 | Pass | Below |

## TC-25 — one real cash-on-delivery order, end to end

`next dev`, real Postgres, `curl` to `/api/create-order` with `paymentPath: "cod"`, two products
and a `utm`. Run twice.

**First run, with `CALLMEBOT_PHONE` and `CALLMEBOT_APIKEY` unset** — the deployment state of this
repository, and of any deployment that never configured the feature:

```
[create-order] COD_1787936908380_q0744cud captured as cash-on-delivery order Q79RMPVPQH for a new customer
[notify-cod] COD_1787936908380_q0744cud was placed but CALLMEBOT_PHONE or CALLMEBOT_APIKEY is not set
 POST /api/create-order 200 in 611ms
```

**Second run, with the keys set and `globalThis.fetch` patched by a `--require` preload** that
answers `api.callmebot.com` locally and prints what would have been sent. The message below is
what the running server actually produced, not a reconstruction:

```
*New Cash on Delivery Order - Morchadi Gems*

*Order:* 34T3UVBF6P
*Reference:* COD_1787936951399_ha3lzhvx
*Payment:* Cash on delivery. Nothing has been paid yet.
*Due on delivery:* ₹1,350

*Came from*
Source: instagram
Medium: paid_social
Campaign: cod_trace

*Items*
1. Teardrop Glass Locket Necklace x2
2. Heart Floating Locket with Birthstone Charms x1

*Subtotal:* ₹1,350
*Shipping:* ₹0
*Total:* ₹1,350

*Deliver to*
COD Trace
9 Johari Bazaar
Near the clock tower
Jaipur, Rajasthan 302003
Phone: 9812340001
Email: cod.trace@example.com

Dispatch within 2 business days. Collect ₹1,350 in cash at delivery, then mark the cash collected on order 34T3UVBF6P in the admin panel.
```

followed by `[notify-cod] COD_1787936951399_ha3lzhvx notified the owner of order 34T3UVBF6P` and
`POST /api/create-order 200 in 708ms`. The response body was
`{"paymentType":"cod","codOrderReference":"COD_1787936951399_ha3lzhvx","trackingId":"34T3UVBF6P","amountPrepaid":0,"amountDue":1350}`,
so the `*Order:*`, `*Reference:*` and `*Due on delivery:*` lines all agree with what the shopper
was told. Both trace orders and the customer row they created were deleted afterwards.

## Gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass, no output |
| `npm run lint` | `✔ No ESLint warnings or errors` |
| `npm run test:run` | **92 files, 1864 passed, 0 failed, 0 skipped** |
| `npm run validate:products` | `PASS — all checks green` (unchanged advisories only) |
| `npm run build` | Pass, 447 product pages prerendered |

The suite was 1841 passing before this change and is 1864 after: 18 new cases in
`lib/notify-cod.test.ts` and 5 in `lib/checkout-payment-paths.test.ts`. `next lint` invalidates
`.next`, which makes `lib/track-build-output.test.ts` skip its 9 cases, so the run recorded above
is the one taken **after** `npm run build`.

## Noted, not fixed

One unrelated pre-existing flake surfaced during a full-suite run and did not reproduce in four
subsequent runs, including on a clean checkout of `a5f634e`:
`lib/admin-order-detail.test.ts > carries no cost figure of any kind` failed. The assertions are
`expect(JSON.stringify(detail)).not.toContain("126")` and `…not.toContain("252")`, checked
against a blob that includes a randomly generated order id and real timestamps. Any fixture whose
id or `changed_at` happens to contain those digit runs fails the test, regardless of whether a
cost figure is present. It is a real latent flake in an assertion unrelated to this change, and
fixing it belongs to whoever next touches that file.
