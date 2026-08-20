# Test Result: Public order tracking (`/track`) — 2026-08-20

- **Plan:** [PLAN-public-order-tracking.md](PLAN-public-order-tracking.md)
- **Commit:** `6fa800f` plus the uncommitted tracking surface in the working tree
- **Environment:** local — Docker Postgres 16 (`morchadi-gems-postgres`, healthy) with all
  migrations applied, and a clean `npm run build` taken immediately before the run
- **Files added:** `lib/order-tracking-page.test.tsx`, `lib/tracking-lookup-limit.test.ts`,
  `lib/track-build-output.test.ts` — 32 tests

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | The control found all twenty values in the committed row. It also **failed twice while being written** — the wide `select` had omitted `utm_source`, `subtotal` and `selected_options`, so three of the twenty could not have been found on the page either. Both gaps were in the control, not in the page |
| TC-02 | Pass | Shipped headline, `Order placed`, `Packed`, `1 May 2026`, `3 May 2026` all present; the not-found message absent |
| TC-03 | Pass | 0 of 20 present in `renderToStaticMarkup` output |
| TC-04 | Pass | 0 of 20 in the serialised tracking object; keys exactly `history, id, placedAt, refund, status`, history rows exactly `changedAt, status` |
| TC-05 | Pass | Two `placed` rows collapse to one dated `2026-05-01T06:00:00.000Z` — the earlier of the run, so the date is when the status was reached rather than when the address was corrected |
| TC-10 | Pass | `trackprv23` deep-equals `TRACKPRV23`; `id` returns as `TRACKPRV23` |
| TC-11 | Pass | `"  trackPRV23  "` and `"TrAcKpRv23"` both deep-equal |
| TC-12 | Pass | The two rendered pages are byte-identical once the form's echo of the typed text is normalised |
| TC-13 | Pass | `TRACKPRV24` and `trackprv24` both `null`; the page renders the one not-found message |
| TC-20–TC-29 | Pass | 14 tests. TC-24 corrected the plan's first draft: a lookup at `t` is counted until `t + 60 000` **exclusive**, so the 9th is throttled at `t+59 999` and allowed at `t+60 000` |
| TC-30–TC-38 | Pass | Read out of `.next/server/app/` and `.next/standalone/.next/server/app/` after a clean build |
| TC-40 | Pass (fails as required) | Adding `reason` to `PublicOrderStatusEvent`, to the `statusHistory` select and to the rendered timeline row made TC-03 and TC-04 fail, each naming *the reason typed beside a status change*. Reverted |
| TC-41 | Pass (fails as required) | Removing `/track` from `NON_INDEXABLE_PATHS` and rebuilding made TC-35 fail. **TC-32 did not fail** — see below. Reverted |
| TC-42 | Pass (fails as required) | Adding `/track` to `CONTENT_ROUTES` and rebuilding made TC-32 fail. Reverted |

## What TC-41 revealed

Removing `/track` from `NON_INDEXABLE_PATHS` broke `robots.txt` but left the sitemap correct,
because `buildSitemap` publishes from `CONTENT_ROUTES` — an allowlist — rather than filtering an
everything-list by `NON_INDEXABLE_PATHS`. `/track`'s absence from the sitemap is therefore
structural: it is out because nothing put it in, and `NON_INDEXABLE_PATHS` is what keeps a
crawler from fetching it anyway.

That is a stronger position than a filter, but it means the two exclusions fail independently,
which is why the build-output file asserts each against a literal `/track` rather than against
the shared constant, and why TC-42 exists as a separate mutation. Only TC-42 can move TC-32.

## The values the fixture carries

Twenty tokens, each shaped so it cannot appear in markup by accident — `QQZCITYTOKEN` rather
than `Mumbai`. An assertion that the page omits `Mumbai` would pass on a page rendering no
address at all *and* on a page rendering a different customer's, which is the failure mode this
naming removes.

The fixture is committed and deleted in `afterAll`, not wrapped in a rolled-back transaction as
the admin read tests are: the page reaches Postgres through the module-level `prisma` client, so
a row inside an open transaction is a row `/track` cannot see.

## Failures

None outstanding. The three failures encountered while writing (the incomplete control in TC-01,
twice, and the window-boundary assertion in TC-24) were errors in the tests, each corrected and
recorded above.

## Summary

32 passed, 0 failed, 0 skipped in the three new files.
**1202 passed, 0 failed** across the whole suite (67 files, 58.14s). `npx tsc --noEmit` clean.

Shippable. The one open item is documentation rather than test coverage: `lib/order-tracking.ts`,
`lib/tracking-lookup-limit.ts` and `app/(storefront)/track/page.tsx` all cite
`docs/decisions/ADR-045-public-order-tracking.md`, which does not exist yet.
