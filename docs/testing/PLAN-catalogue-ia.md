# Test Plan: Two-tier catalogue IA — categories and collections

- **Scope:** the two-tier information architecture introduced in
  [ADR-020](../decisions/ADR-020-two-tier-catalogue-ia.md) — the ten-member `Category`
  union and its guard, the five-member collection tier and its two guards, the collection
  filter in `lib/shop.ts`, and the two nav menus derived in `lib/navigation.ts`.
  **Not** covered: rendering of `PrimaryNav`, `MobileNav`, `CollectionStrip` or the
  Collections facet in `ShopFilterPanel` — dropdown hover, the mobile accordion and focus
  management are verified by hand and by the served HTML, as they were before.
  Also **not** covered here: the catalogue *data*, which
  `scripts/validate-products.mjs` checks separately and which gains no collection tags
  until the product import in the next prompt.
- **Prerequisites:** none. No network, no env var, no seed data. Collection membership is
  exercised through fixtures because no shipped product carries a tag yet.
- **Runner:** Vitest — `npm run test:run`.

## What must be true

1. **The category tier partitions.** Exactly ten categories, unique slugs and labels, and
   every product in `data/products.json` carries one of them.
2. **Two tiers, two vocabularies.** `gifting` and `anti-tarnish` are tags a product may
   carry; `best-sellers`, `new-arrivals` and `under-999` are not, and the guards say so.
3. **A derived collection reads the field it is derived from.** Never a tag, never a
   parallel copy that could disagree.
4. **`under-999` agrees with the price facet.** Same bound, inclusive at ₹999.
5. **Facet semantics are unchanged by the new facet.** Collections OR within themselves and
   AND against category and price.
6. **Graceful degradation.** An unknown collection slug is dropped, not fatal, and does not
   silently filter everything out.
7. **The nav cannot drift.** Both dropdowns are derived from the constants, and every entry
   is a single query param the shop can parse back.

## Cases

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-01 | `CATEGORIES` size and uniqueness | Ten entries, ten distinct slugs, ten distinct labels | Automated |
| TC-02 | The two new labels | `watches` → "Watches", `hair-accessories` → "Hair Accessories" | Automated |
| TC-03 | `isCategory` over all ten, plus `"nath"` and `""` | True for the ten, false for both others — nath is not a category | Automated |
| TC-04 | Every shipped product's category | Passes `isCategory`; the existing catalogue still validates against the widened union | Automated |
| TC-05 | `COLLECTIONS` size, and which are tags | Five entries; `COLLECTION_TAGS` is exactly `["gifting", "anti-tarnish"]` | Automated |
| TC-06 | Each collection's `source.kind` | tag, tag, featured-flag, new-flag, price-band — in nav order | Automated |
| TC-07 | Tag guard vs tier guard | `isCollectionTag("best-sellers")` false while `isCollectionFilterSlug("best-sellers")` true; both reject `"wedding-season"` | Automated |
| TC-08 | Labels, and an unknown slug | `getCollectionLabel` resolves; `getCollection("wedding-season")` throws rather than returning a silent default | Automated |
| TC-09 | Tagged product matches its collection | Fixture tagged `gifting` matches `?collection=gifting` | Automated |
| TC-10 | Untagged product matches nothing tagged | Fixture with `collections` absent does not match `?collection=gifting` | Automated |
| TC-11 | Wrong tag | Fixture tagged `gifting` does not match `?collection=anti-tarnish` | Automated |
| TC-12 | Product in several collections | Fixture tagged both matches either one | Automated |
| TC-13 | Multi-select | `?collection=gifting,anti-tarnish` matches both fixtures, still not the untagged one | Automated |
| TC-14 | `best-sellers` source | Reads `featured`; a featured fixture with no `collections` field matches | Automated |
| TC-15 | `new-arrivals` source | Reads `isNew`; an `isNew` fixture with no `collections` field matches | Automated |
| TC-16 | `under-999` boundary | ₹998 in, ₹999 **in**, ₹1000 out — the price band's inclusive bound | Automated |
| TC-17 | Collection AND category | `?collection=gifting&category=rings` takes the gifted ring, rejects the gifted earring and the plain ring | Automated |
| TC-18 | Collection AND price | `?collection=gifting&price=under-999` rejects a gifted ₹4,999 piece | Automated |
| TC-19 | Unknown collection | Dropped to `[]`; the query then matches everything rather than nothing | Automated |
| TC-20 | Mixed valid/invalid list | `wedding-season,gifting` keeps `gifting` alone | Automated |
| TC-21 | Selection order | Normalised to `COLLECTIONS` order, not URL order | Automated |
| TC-22 | Derived collections over the real catalogue | `?collection=best-sellers` totals the featured count, `new-arrivals` the isNew count, `under-999` the ≤999 count | Automated |
| TC-23 | Applied-filter chip | `?collection=anti-tarnish` yields one chip, `kind: "collection"`, label "Anti-Tarnish" | Automated |
| TC-24 | Toggle resets pagination | `toggleCollection` returns page 1, keeps the category facet, and toggling twice clears | Automated |
| TC-25 | Active filter count | Category + two collections counts 3 | Automated |
| TC-26 | Parser accepts every constant | Every `COLLECTIONS` slug round-trips through `parseShopQuery` | Automated |
| TC-27 | The two menus | `NAV_MENUS` is exactly "Shop by Category" then "Collections" | Automated |
| TC-28 | Category menu contents | Ten items, hrefs equal to `buildCategoryHref` over the slugs | Automated |
| TC-29 | Collection menu contents | Five items, hrefs equal to `buildCollectionHref` over the slugs | Automated |
| TC-30 | Every nav href is one param | Starts `/shop?`, contains no `&` — so the facet the shopper clicked is the facet that shows as checked | Automated |
| TC-31 | Category image paths | `/categories/watches.webp` and `/categories/hair-accessories.webp` derive from the slug | Automated |
| TC-32 | No product is tagged yet | Zero products carry a non-empty `collections` — the import lands next prompt | Automated |
| TC-33 | URL canonicalisation with all three facets | `buildShopHref` emits `category`, `collection`, `price`, `sort`, `page` in that order and round-trips | Automated |
| TC-34 | Nothing regressed | Every test written before this prompt passes unmodified except the two that construct a `ShopQuery` literal, which gain the new `collections` field | Automated |
| TC-35 | Manual — nav and home | Desktop: two dropdowns, ten and five entries, About and Contact top-level. Mobile: both groups as accordions. Home: ten tiles as 5×2, collection strip beneath | Manual |
