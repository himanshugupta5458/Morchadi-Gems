# Test Plan: Public order tracking (`/track`)

- **Scope:** the four properties the customer-facing tracking surface has to hold that reading
  the source cannot establish — that no operator-only column reaches the rendered page, that a
  lookup is case-insensitive, that the lookup limiter really throttles, and that `/track` is
  absent from the sitemap and disallowed in `robots.txt` **in the bytes a build emits**.
  Explicitly **not** covered here: the copy in `lib/order-tracking-copy.ts`, the timeline's
  collapse rule, and the storefront chrome around the page — those are unit-level and covered
  by their own files.
- **Prerequisites:** a local Postgres reachable at `DATABASE_URL` with the migrations applied
  (`docs/DEV-DATABASE.md`), and a completed `npm run build` for the TC-30 block. Every case
  **skips rather than fails** when its prerequisite is missing, matching
  `lib/prisma-connection.test.ts`.

## Cases

### Nothing private reaches the page

The fixture is one committed order carrying twenty values a customer must never see: the
operator who moved it, two typed reasons, the phone number, the four address lines, the
pincode, the customer's name and email, the payment type, the Cashfree id, the campaign, the
product name, the recorded option, and five money figures including `total_cost`.

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The fixture genuinely holds all twenty values | Re-read the committed row with a wide `select`; search its JSON for each value | All twenty found — this is the control that makes TC-03 and TC-04 real absences rather than a broken search | Automated |
| TC-02 | `/track?order_id=…` renders that order | Render the page component with the fixture id; look for the shipped headline, two timeline labels and two dates | The order is rendered, not `ORDER_NOT_FOUND_MESSAGE` | Automated |
| TC-03 | None of the twenty appear in the HTML | `renderToStaticMarkup` the page; assert `not.toContain` for each value, each with its own failure label | Zero of twenty present, while the headline still is | Automated |
| TC-04 | None of the twenty appear in the page's data either | `JSON.stringify` what `findPublicOrderTracking` returns; same twenty assertions; assert the object's own key set | Zero present; keys are exactly `history, id, placedAt, refund, status`, and each history row exactly `changedAt, status` | Automated |
| TC-05 | An address correction shows its date and not its text | Fixture holds a second `placed` row written only to carry a reason | Timeline reads `placed, packed, shipped`; the first row keeps the *earlier* timestamp | Automated |

### An order number typed in the wrong case

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-10 | Lowercased id finds the same order | `findPublicOrderTracking` with the exact id and with `.toLowerCase()` | Deep-equal results; `id` comes back in the database's spelling | Automated |
| TC-11 | Mixed case and stray spaces | `"  trackPRV23  "` and `"TrAcKpRv23"` | Both deep-equal the exact-case result | Automated |
| TC-12 | Both spellings render the same page | Render for both; normalise the one echo of the typed text in the form's `defaultValue` | The two HTML strings are then byte-identical | Automated |
| TC-13 | Case-insensitivity does not invent orders | An id nobody was given, in both cases | `null`, and the page renders the single not-found message | Automated |

### The lookup limiter

Every case hands in its own store and its own clock, so window boundaries are asserted at the
millisecond rather than waited for.

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-20 | The threshold is what the module says | Read the two exported constants | 8 lookups, 60 000 ms | Automated |
| TC-21 | Throttles after the threshold | 12 lookups at one instant | First 8 `allowed`, remaining 4 `throttled` | Automated |
| TC-22 | The eight may be spent slowly | 8 lookups 6 s apart, then a 9th | The 9th is `throttled` | Automated |
| TC-23 | Clients are counted apart | Exhaust one client, then ask as another | The second is `allowed` | Automated |
| TC-24 | The window's edge | A 9th lookup at `t+59 999` and at `t+60 000` | `throttled`, then `allowed` | Automated |
| TC-25 | The window slides | 8 lookups 5 s apart; ask twice just after the first expires | `allowed`, then `throttled` — one released, not eight | Automated |
| TC-26 | A refused attempt is not recorded | Exhaust, then 1 000 refused attempts at `t+58 000`, then ask at `t+60 001` | `allowed` — the client's window was not pushed forward by hammering | Automated |
| TC-27 | The store stays bounded | Fill past `MAX_TRACKED_LOOKUP_CLIENTS` with stale, then with current, clients | Stale entries dropped; an all-current map is cleared outright | Automated |
| TC-28 | The **process** counter throttles | 9 lookups with no store argument — the counter `/track` actually calls | 9th is `throttled`, a different client still `allowed` | Automated |
| TC-29 | Who is asking | `x-forwarded-for` list, `x-real-ip` fallback, empty/absent | First forwarded entry, then the real IP, then `unattributed` — which is itself throttled | Automated |

### Sitemap and robots.txt, in real build output

Read from what `next build` emitted, not from `buildSitemap()` and `buildRobots()` — the same
method `pricing.cost` is held to in
[RESULT-2026-08-20-order-capture.md](RESULT-2026-08-20-order-capture.md) TC-31.

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-30 | The build under test knows about `/track` | Assert `.next/server/app/(storefront)/track/page.js` exists and carries the page's title | Present — otherwise TC-32 would pass for the wrong reason | Automated |
| TC-31 | The artefacts are the artefacts | `sitemap.xml.body` contains `<urlset`; `robots.txt.body` contains `User-Agent: *` | Both | Automated |
| TC-32 | `/track` is not in the emitted sitemap | Grep the emitted body for `/track`, case-insensitively | No match | Automated |
| TC-33 | Nor is any other non-indexable path | Match `<loc>…path</loc>` for each of `NON_INDEXABLE_PATHS` | No match | Automated |
| TC-34 | Control: the sitemap is not simply empty | Same regex for `/shop`, `/about`, `/contact`, `/refund`, `/shipping`, `/product/P010` | All six found | Automated |
| TC-35 | `/track` is disallowed in the emitted robots.txt | Parse every `Disallow:` line out of the body | `/track` among them | Automated |
| TC-36 | The full disallow list | Compare the parsed list to `NON_INDEXABLE_PATHS + /api/ + /admin` | Equal, in order | Automated |
| TC-37 | Control: the shop is not disallowed | Same parse; check `/`, `/shop`, `/about`, `/contact`, `/refund`, `/shipping` | None disallowed; `Allow: /` present | Automated |
| TC-38 | The standalone copy the container ships | Same two assertions against `.next/standalone/.next/server/app/` | Same answers | Automated |

### Adversarial checks on the tests themselves

A test that asserts an absence is worthless until it has been seen to fail.

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-40 | Leak a reason into the timeline | Add `reason` to the query, the type and the rendered row; run TC-03 and TC-04 | Both fail, naming the leaked value | Manual |
| TC-41 | Drop `/track` from `NON_INDEXABLE_PATHS` | Remove it, `npm run build`, run TC-35 | Fails | Manual |
| TC-42 | Publish `/track` in the sitemap | Add it to `CONTENT_ROUTES`, `npm run build`, run TC-32 | Fails | Manual |
