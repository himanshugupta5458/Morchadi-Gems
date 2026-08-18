# ADR-008: Shop page architecture

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 7

## Context

The Shop page is the first page in this project with real business logic. Everything before
it was composition — read data, render it. This page filters, sorts, and paginates, and it
has to honour a URL vocabulary that two earlier prompts already shipped links against:
`category` and the three `price` bands from [ADR-005](ADR-005-navigation-and-chrome.md), and
`sort=newest` / `sort=rating-desc` from [ADR-007](ADR-007-home-composition.md). Forty-three
links across the chrome and the home page point here. They are a contract, not a suggestion.

Logic that can be wrong quietly needs tests, which makes this also the prompt that
introduces a unit-test runner.

## Decision

**1. The URL is the single source of truth.**

There is no client-side filter state. The server reads `searchParams`, computes results, and
renders; the controls are Client Components whose only job is to compute the *next* URL and
call `router.push`. Every control's checked/selected state is derived from the normalized
query passed down as a prop.

This is the whole architecture in one sentence, and it is what makes the page's behaviour
testable without rendering it. There is no state that can desync from the URL because there
is no state. A filtered view is shareable, bookmarkable, and survives a refresh and the back
button for free.

**2. `getShopResults` is pure, and it is the thing under test.**

`lib/shop.ts` exports one function that takes raw search params — possibly invalid, possibly
arrays, possibly nonsense — and returns `{ items, total, totalPages, page, rangeStart,
rangeEnd, query, appliedFilters }`. It reads the catalogue through `lib/products.ts`,
mutates nothing, and touches no framework API. Given the same params it returns the same
result.

That purity is why 53 tests can cover the page's behaviour without a browser, a DOM, or a
render. The page component itself is then thin enough to be obviously correct by reading it.

**3. Two modules, because one of them ships to the browser.**

`lib/shop-query.ts` holds the vocabulary — `PRICE_BANDS`, `SORT_OPTIONS`, `PER_PAGE`,
parsing, URL building, the query mutators, pagination range. It imports no product data.
`lib/shop.ts` adds `getShopResults` and re-exports the whole of `shop-query`.

The split is load-bearing rather than tidiness. The filter panel and sort select are Client
Components and need `buildShopHref` and the constants; had those lived alongside
`getShopResults`, importing them would have pulled `data/products.json` — the entire 100-item
catalogue — into the client bundle. **Client components import `@/lib/shop-query`; server
code imports `@/lib/shop`.** Verified after building: no client chunk contains catalogue
data, and `/shop` costs 1 kB more first-load JS than the home page.

**4. Facets are multi-select, comma-separated. Selections OR within a facet, AND across.**

`?category=necklaces,earrings&price=under-999` means *(necklaces OR earrings) AND under
₹999*. Repeated params (`?category=a&category=b`) parse identically.

The alternative was single-category, which is less code. It was rejected because the filter
UI is checkboxes, and checkboxes that deselect each other are a lie about what the control
does. Making the data model match the control was cheaper than explaining why the control
misbehaves. Single-category URLs from the mega-nav are simply the one-element case, so
ADR-005's links keep working untouched.

Parsing is deliberately forgiving — case-insensitive, whitespace-tolerant, de-duplicating —
and **unknown tokens are dropped rather than raising**. `?category=tiaras` returns the full
catalogue, not a 404 or an error. A hand-edited or stale URL should degrade to something
sensible; nobody should reach an error page by mistyping a query string.

**5. Price bands, not a free min/max range.**

Three fixed bands with inclusive bounds, already public URL surface from ADR-005. A free
range (`?min=1200&max=3800`) is more expressive and was rejected: it needs a slider or two
number inputs, it produces unbounded URL variety for crawlers, and with 100 products it
answers a question nobody is asking. Bands map to how people actually shop — a budget, a
mid-range, a splurge.

The bands partition the catalogue exactly, which the test suite asserts: the three band
totals sum to 100. That is a property worth holding onto, because a gap between bands would
make products unreachable through the filter UI.

**6. Default sort is `newest`, which is a flag and not a date.**

`data/products.json` has no timestamp ([ADR-002](ADR-002-product-data-model.md)), so a true
recency sort is not available. `newest` means *`isNew` first, then rating descending, then
id* — the 8 flagged arrivals, then the best-rated of the rest. This is honest about what the
data supports and it makes a good default first page.

**Every comparator ends on `id`.** Without a total order, two products that tie on price
could swap positions between the request for page 1 and the request for page 2, and a
product could be shown twice or skipped entirely. The suite asserts that paging through the
whole catalogue yields exactly 100 distinct products.

**7. Out-of-range pages clamp; they do not 404.**

`page=0`, `page=-1`, `page=abc`, and `page=` all resolve to page 1. `page=9999` returns the
last page. `totalPages` is `max(1, ceil(total / 12))`, so an empty result set is page 1 of 1
rather than page 1 of 0 — which keeps `page` always within `[1, totalPages]` and means no
caller has to special-case zero.

A 404 for `page=9999` would be defensible, but the failure it guards against — a stale
bookmark after the catalogue shrinks — is better served by showing the last page of real
products than by an error.

**8. Pagination is numbered links, not infinite scroll.**

`1 … 4 [5] 6 … 9`, plain `<a>` elements that change only `page`. Prev and Next are omitted
rather than disabled at the ends. Numbered pages are crawlable, linkable, and restore
position on back-navigation; infinite scroll does none of that and needs client state, which
decision (1) exists to avoid.

## Alternatives considered

**Client-side filtering of the whole catalogue.** Ship all 100 products and filter in the
browser — instant, no round-trip. Rejected: it puts the catalogue in the client bundle,
duplicates the filtering logic in a place tests do not reach, and does not scale past a
catalogue that fits in a bundle. The server round-trip on a static-ish page is cheap.

**Storing filter state in React state and syncing it to the URL.** The common pattern, and
the one that produces desync bugs — two sources of truth that agree until they do not
(back button, shared link, hard refresh). Rejected on principle: derive, do not sync.

**`useSearchParams()` in the control components** instead of passing the query down. Rejected:
it forces a Suspense boundary and opts the subtree into client-side rendering, for
information the server already has and can hand over as a prop.

**A `sort=featured` default** (featured first). Tempting because it makes a curated first
page. Rejected: `featured` is not in the shipped `SORT_OPTIONS` vocabulary, so it would
either need a fifth visible option or produce a select with no matching value on first load.

**Facet counts next to each checkbox** ("Necklaces (13)"). Genuinely useful and deliberately
skipped — done properly the counts must reflect the *other* facet's current selection, which
is a real chunk of logic and its own test surface. Worth adding later; not worth smuggling
into this prompt.

## Consequences

`/shop` is `ƒ (Dynamic)` in the build output rather than static. This is inherent to reading
`searchParams` and is the correct trade for a page whose entire purpose is to respond to
them. There is no data fetch behind it — results come from an in-memory array — so the
render is cheap.

The URL vocabulary is now firmly public: 8 categories × 4 quick filters from the mega-nav,
plus 2 sort links from home, all verified to return 200. Changing a band key or a sort slug
breaks bookmarks and shared links, so those constants should be treated as an API.

`lib/shop-query.ts` must stay free of product imports. A future contributor adding a
convenience helper that reads the catalogue would silently ship 100 products to every visitor
of `/shop`. The two-module split is documented here and in `docs/testing/PLAN-shop-logic.md`
precisely because the failure is invisible.

Product cards link to `/product/{id}`, which 404s until the next prompt.

Vitest now coexists with `scripts/validate-products.mjs`. They answer different questions —
the script validates the *data* at authoring time, the suite validates the *logic* — and
neither replaces the other. Both must stay green.

What would force a revisit: a catalogue large enough that filtering an in-memory array per
request stops being free, or a real requirement for facet counts or free-range price
filtering.
