# Test Plan: Home page, product detail, and the tracking redesign

- **Scope:** the home page's composition (category cap, new-arrivals cap, promise copy and
  placement, collection covers, hover photograph, search, social band, vertical rhythm); the
  floating WhatsApp button's clearance on **both** the home page and the shop listing; the
  product page's zoom, description truncation, tax line, COD line, trust strip, share control
  and stock badge; and `/track`'s horizontal timeline, timestamp granularity, non-linear status
  treatment and new order-detail panels.
  **Not covered:** the shop listing's filter, sort and pagination mechanics (prompt 114's work,
  untouched here except for the `q` facet); the cart, address, payment and confirmation pages;
  star ratings, which do not exist; the variant/add-to-cart mechanics, which are reused for
  display only.
- **Prerequisites:** `DATABASE_URL` reachable for the `/track` cases. `playwright-core` and the
  cached Chromium for the measured cases (TC-11 through TC-14) — installed for the run and
  removed after it, so `package.json` is untouched.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The category grid is capped at ten | Read `HOME_CATEGORIES`; render `CategoryGrid` | Exactly ten tiles, none linking to `?category=gift-hampers` | Automated |
| TC-02 | The cap does not withdraw the category | Read `SURFACED_CATEGORIES` and gift hampers' `status` | Still eleven, still `surfaced` — nav, facets and sitemap unaffected | Automated |
| TC-03 | The exclusion and the cap are separable rules | Apply `selectHomeCategories` to twelve invented categories | Capped at `HOME_CATEGORY_LIMIT`; a custom limit is honoured | Automated |
| TC-04 | New arrivals preview eight | Read `HOME_NEW_ARRIVALS_COUNT`; call `getNewArrivals` with it | 8, and 8 products returned from a pool of 408 | Automated |
| TC-05 | The promise band claims nothing untrue | Render `TrustStrip` | "Top notch quality" present, "Anti-Tarnish Quality" absent | Automated |
| TC-06 | The compact strip is a rendering, not a copy | Render both; compare the four promises; locate both in the page source | Same four labels; compact above the category grid, full below it | Automated |
| TC-07 | Every collection tile shows a piece it holds | For each cover, find the product owning that image and ask `isProductInCollection` | True for all four; every tile links at the collection it depicts | Automated |
| TC-08 | The hover photograph exists only where a second photograph does | Read `getSecondaryImage` over the catalogue | Non-null exactly for the 13 multi-image records; null elsewhere | Automated |
| TC-09 | The social band is empty and renders nothing | Read `data/social-proof.json`; render the section with it | Empty array; `container.innerHTML === ""` | Automated |
| TC-10 | The two flagged gaps are tightened by roughly a third | Read the padding constants and their uses | `py-7 sm:py-11 lg:py-16` applied at exactly two places | Automated |
| TC-11 | The button's clearance arithmetic | Drive `liftClearingObstacles` with the rectangles measured in prompt 114 | Clears the obstacle, leaves `CONTACT_CLEARANCE_GAP` above it | Automated |
| TC-12 | A clear position exists at every scroll offset | Walk a six-row grid past the button one pixel at a time across a card height, at five card heights | No overlap at any offset | Automated |
| TC-13 | **The measured invariant** — no call to action is covered | `scripts/measure-floating-contact.mjs`: 5 widths × 2 pages × 5 scroll offsets | 0 overlaps in 50 positions, including the prompt-114 fixture URL | **Manual (measured)** |
| TC-14 | **The control** — the same positions without the avoidance | Measure the button's resting rectangle instead of its lifted one | Overlaps appear, including "Choose Your Options" at 1024 and 1440 | **Manual (measured)** |
| TC-15 | Search matches name and category, AND across words | Drive `searchProducts` with four fixtures | AND semantics; prefix outranks word-start outranks substring | Automated |
| TC-16 | The dropdown and `/shop?q=` agree | Compare `searchProducts` over the catalogue with `matchesSearchTerm` | Identical id sets | Automated |
| TC-17 | `q` is a facet, not a mode | Parse, build and clear a searched query; combine with a category | AND-ed, capped at 64 chars, cleared by its own chip, resets to page 1 | Automated |
| TC-18 | A searched listing is not indexable | `generateMetadata({ q: "ring" })` | `robots: noindex, follow` | Manual |
| TC-19 | The autocomplete works on a real product name | Type "Clover Charm" on `/`; then "ring"; follow "See all" | Two ranked rows; 157 results; lands on `/shop?q=ring` with the chip present | **Manual** |
| TC-20 | The description truncates at the house floor and expands | Split fixtures of known length; click the control | Cut at a paragraph boundary past 150 words; every paragraph stays in the DOM; "See more" ↔ "See less" | Automated |
| TC-21 | The stock indicator is the card's cascade, not a second one | Render `ProductBadgeTag` for every catalogue product; compare with `selectProductBadge` | Identical for all 449; nothing rendered when the cascade chooses nothing | Automated |
| TC-22 | The COD line agrees with the eligibility rule | `describeProductCodAvailability` over every product | Promises COD exactly when `minPrepaidAmount === 0` | Automated |
| TC-23 | Zoom, tax line and share render on a real product page | Load `/product/P408` | Dialog opens and closes on Escape; tax + COD line present; share control present | **Manual** |
| TC-24 | `collapseRepeatedStatuses` is unchanged | Feed a run containing an address-edit row | The duplicate is dropped; the earliest date survives | Automated |
| TC-25 | `changedBy` and `reason` are still unreachable | Inspect `PublicOrderStatusEvent`'s keys and the rendered timeline | Two keys only; nothing matching /reason/i or /changed by/i | Automated |
| TC-26 | The empty-history fallback survives the redesign | Render with `history: []` | The fallback sentence, no steps | Automated |
| TC-27 | Timestamps carry the clock, and the day-only format is untouched | `formatTrackingDateTime` and `formatTrackingDate` | Two same-day events differ; `formatTrackingDate` still "1 May 2026" | Automated |
| TC-28 | Non-linear statuses use the admin panel's own class string | Compare `OrderStatusBadge`'s class attribute with the timeline chip's, for all seven statuses | Byte-identical; three distinct hues for the three non-linear statuses; customer wording | Automated |
| TC-29 | The new panels show items and money and nothing else | Render `/track` for a fixture order | Product name, chosen option and the three amounts present | Automated |
| TC-30 | **The address is still withheld** | Same render; search for the fixture's address tokens | Address lines, city, pincode, name, phone and email all absent | Automated |
| TC-31 | The timeline is genuinely horizontal on a real order | Load `/track` for a real multi-step order at 375 and 1440 | All steps share one `top`; four steps from five history rows | **Manual (measured)** |

## Gate

`npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run validate:products`,
`npm run build` — all must pass before any manual case is recorded.
