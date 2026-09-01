# Test Plan: GA4 analytics and UTM first-touch attribution

- **Scope:** the optional GA4 tag, the CSP origins it needs, first-touch UTM capture and
  expiry, and the two places a captured campaign travels to — the Cashfree `order_tags` on
  order creation and the admin WhatsApp message. Covered here: what can be asserted without a
  network. **Not covered:** whether Cashfree accepts and stores the new `utm_*` tags on a real
  order, whether a GA4 beacon actually fires against the live CSP, and whether a measurement id
  reports anything in the GA4 dashboard. All three need a live run, and all three are listed as
  manual cases below rather than claimed as passing.
- **Prerequisites:** none for the automated cases. The manual cases need
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` set to a real GA4 property and Cashfree sandbox credentials.
- **Decision:** [ADR-039](../decisions/ADR-039-analytics-and-utm-attribution.md).
- **Narrowed, prompt 120.** A captured campaign now travels to **one** place, not two:
  [ADR-075](../decisions/ADR-075-minimal-cashfree-customer-payload.md) stopped forwarding the
  `utm_*` tags to Cashfree, so the scope line above describes what this plan covered when it
  was written rather than what ships. The `orders` / `customers` write and the admin WhatsApp
  message are unchanged; `toUtmOrderTags` still exists and is still unit-tested here, and
  `lib/cashfree-order-payload.test.ts` now owns the assertion that its output does not reach
  the gateway. The manual case asking whether Cashfree stores the `utm_*` tags on a real order
  is **obsolete** — there are none to store.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | No measurement id set | Render `<GoogleAnalytics />` with `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset, then empty | No script element of any kind is rendered | Automated |
| TC-02 | Measurement id set | Render with an id | Two scripts: `gtag.js` from `googletagmanager.com` carrying the id, and a `config` call naming it | Automated |
| TC-03 | Loading strategy | Render with an id | Both scripts are `afterInteractive`, so measurement never precedes the pay button | Automated |
| TC-04 | Id escaping | Build the init script from an id containing quotes and parentheses | The id is emitted as a JSON string literal, not pasted between quotes | Automated |
| TC-05 | CSP allows the tag host | Read `script-src` | Contains `https://www.googletagmanager.com` | Automated |
| TC-06 | CSP allows the beacons | Read `connect-src` | Contains `https://www.google-analytics.com` and `https://region1.google-analytics.com` | Automated |
| TC-07 | CSP widened no further | Read `form-action`, `frame-src`, `img-src`, `default-src` | No Google host appears in any of them | Automated |
| TC-08 | Full campaign URL | Read all five `utm_*` params | All five captured, normalised | Automated |
| TC-09 | Partial campaign URL | Read a URL with only `utm_source` | Only `source` captured; the rest absent, not empty strings | Automated |
| TC-10 | No campaign at all | Visit with no `utm_*`, and with unrelated params | Nothing captured, nothing written to `localStorage` | Automated |
| TC-11 | Hostile campaign value | Capture a 500-character value, and one containing newlines and tabs | Truncated at 120 characters; control characters flattened to single spaces | Automated |
| TC-12 | First touch is not overwritten | Capture campaign A, then visit three days later with campaign B | Campaign A and its original `capturedAt` are still stored and returned | Automated |
| TC-13 | An uncampaigned return visit | Capture campaign A, then visit with no params | Campaign A survives | Automated |
| TC-14 | Storage refused | Capture with `setItem` throwing | No throw; the campaign is still returned to the caller | Automated |
| TC-15 | Window boundary | Read the record on day 90, then on day 91 | Returned on day 90, null on day 91 | Automated |
| TC-16 | The window rolls | Let a record expire, then arrive on a new campaign | The new campaign replaces the expired one | Automated |
| TC-17 | Corrupt stored record | Store non-JSON, a bare string, a record with no `capturedAt`, an unparseable date, a date with no campaign | Every one reads as no record | Automated |
| TC-18 | SSR safety | Call `captureUtmParams` and `getStoredUtmParams` in the `node` environment, where `window` does not exist | Both return null; neither throws | Automated |
| TC-19 | Order tags carry the three campaign fields | Build tags from a full five-field campaign | `utm_source`, `utm_medium`, `utm_campaign` only; `term` and `content` are not tagged | Automated |
| TC-20 | Untagged order is unchanged | Build tags with no campaign, with and without option choices | Identical to the map built before this feature existed; empty map on an order with neither | Automated |
| TC-21 | Tag count and length | Build tags from options plus a full campaign | At most 10 keys; no value above 255 characters | Automated |
| TC-22 | Pricing is unaffected | Price an order with `utm` present, absent, and as nonsense including price-shaped fields | Identical total every time; `parseUtmParams` yields nothing price-shaped | Automated |
| TC-23 | WhatsApp names the campaign | Compose the message with a full campaign | A `*Came from*` section sits between the order line and the items, listing source, medium and campaign | Automated |
| TC-24 | WhatsApp prints only what is present | Compose with `source` only | Source printed; no Medium or Campaign line | Automated |
| TC-25 | WhatsApp is unchanged without a campaign | Compose with `undefined`, `null`, and a campaign holding only untagged fields | Byte-identical to the message composed with no campaign argument at all | Automated |
| TC-26 | Campaign survives a lost summary | Compose with a campaign and a null bundle | Campaign section printed alongside the degraded no-summary message | Automated |
| TC-27 | The confirmation page forwards the campaign | Seed a first touch, reach `PAID` | The notify request body carries `utm` | Automated |
| TC-28 | No campaign, no field | Reach `PAID` with no stored campaign, and with an expired one | The notify body has no `utm` property at all | Automated |
| TC-29 | Cashfree accepts the tags | Place a sandbox order from a URL carrying `?utm_source=test&utm_medium=test&utm_campaign=test` | The order is created and the tags appear on it in the Cashfree dashboard | **Manual** |
| TC-30 | The beacon fires against the live CSP | Set a real measurement id, deploy, load a page, watch the network tab and the browser console | A `collect` request is sent; no CSP violation is logged | **Manual** |
| TC-31 | GA4 reports a campaign | Visit the deployed site through a UTM link and check GA4 real-time | The session is attributed to the campaign | **Manual** |
