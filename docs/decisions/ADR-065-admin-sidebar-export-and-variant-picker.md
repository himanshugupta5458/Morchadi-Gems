# ADR-065: Admin sidebar, in-app product export, and the variant photograph picker

- **Status:** Accepted
- **Date:** 2026-08-29
- **Prompt:** 110

## Context

[ADR-064](ADR-064-admin-product-management.md) built the product half of the admin panel: a
filtered list, a tabbed edit form, a version-token save path, and the repository boundary that
keeps the whole feature ignorant of where the catalogue is kept. It shipped the mechanics
correctly and left three things to use.

**The panel's chrome was a top bar with two links in it.** It was built for two sections and could
take a third only by getting wider. Nothing about it was wrong; it was simply the shape that stops
scaling first.

**Exporting the catalogue was a script.** `scripts/export-live-products.mjs` read
`data/products.json` off disk, wrote a workbook into the repository root, and printed instructions
for finding it in the Codespace file explorer. It required `npm install xlsx --no-save` first, and
it could only ever be run by somebody with a checkout and a terminal — which is not the person the
panel exists for.

**Variant photographs were paths typed into text boxes.** This is the finding that shaped the
work, and it was worse than it reads. The Variants tab listed one bare `<input type="text">` per
option value, and further down the same tab listed the product's photographs as unclickable
`<code>` elements. Pairing a photograph with a colour meant reading a path off one part of the
screen and retyping it into another. A typo produced a record pointing at a file that was not
there; the operator had no way to see it and the form had no way to prevent it.

Two facts about the data decided how the replacement had to work:

| Fact | Consequence |
| --- | --- |
| Two products carry `media.variantImages` at all, holding seven mappings between them | The feature is small, so it can be got right rather than approximated |
| **All seven point at files that are not in `media.images`** — `P010-golden.webp`, `P586-wine-red.webp` and so on sit beside the product's own photographs, not among them | A picker offering `media.images` alone could not name a single mapping the catalogue actually holds. It would show every one as unassigned, and the first save of any unrelated field would make that true |

The second row is the one that mattered. The obvious reading of "a visual picker over the existing
`media.images` array" would have silently deleted every variant photograph in the catalogue.

## Decision

### 1. The chrome is a sidebar, and it stays a Server Component

`AdminNav` is deleted. `AdminSidebar` renders down the left of every protected page: the shop
name, the sections, and the identity and sign-out at the bottom. The protected layout places it
in a two-column grid that collapses to one column below `lg`.

**The current section is still resolved from the `x-admin-internal-path` header** middleware sets,
exactly as before. `usePathname` is not introduced and the layout does not become a Client
Component: navigating this panel costs no JavaScript, and that property was worth more than the
convenience of a hook.

The sections are declared once. `resolveAdminSectionLinks` pairs each member of `ADMIN_SECTIONS`
with a label and an href resolver, so a third section is three lines in `lib/admin-routing.ts` and
nothing at all in the layout or the sidebar — which is the deficiency the top bar actually had.

Below `lg` the sidebar is a disclosure behind a hamburger, in `AdminSidebarShell`. That component
holds one boolean and a button; the sidebar's contents reach it as `children`, already rendered by
the server. `lg` is the breakpoint `ShopFilterDrawer` collapses at, for the same reason — the
width at which a fixed column beside the content stops costing the content its own.

### 2. The export is a route, and it exports the list on screen

`GET /admin/api/products/export` returns the workbook as a download.
`scripts/export-live-products.mjs` is **deleted**, and `xlsx` becomes a real dependency.

**It exports the currently filtered list, across every page — not a fixed set.** The alternative,
always exporting all active products, is what the script did and would have been defensible. It
was rejected because the button sits at the bottom of a page whose entire state is a filter: an
operator who has just narrowed the list to the six out-of-stock pieces and then presses Export
means those six. A button that quietly exported something else is a button that gets checked twice
every time it is used.

Two things make that choice safe rather than merely convenient:

- **The route and the list share one function.** `selectMatchingAdminProducts` is what the list
  slices for a page and what the export takes whole. They cannot disagree about what a filter
  means, because there is only one implementation of it.
- **The label says which of the two it is.** `Export all 449 products (.xlsx)` or
  `Export these 6 filtered products (.xlsx)`, with the count computed from the same query.

The unfiltered export is byte-for-byte the sheet the script produced — same columns, same order,
same sheet name, same `live-products-export-YYYY-MM-DD.xlsx` filename. A narrowed export is named
`products-export-filtered-YYYY-MM-DD.xlsx` instead, because a file called `live-products-export`
holding six rows will be mistaken for the catalogue by whoever opens it next month.

The flattening logic is ported into `lib/product-export.ts` unchanged and is now the only copy.
Keeping the script alive as a second caller was considered and rejected: an `.mjs` script cannot
import a TypeScript module, so "shared" would have meant duplicated, and a column list maintained
in two places is a column list that drifts.

The button is an `<a>`, not a `fetch`. The route is a `GET` that creates nothing, so the download
survives a new tab, a copied URL and a retry, and the product list still ships no client
JavaScript.

### 3. Variant photographs are chosen by looking at them

`AdminVariantImagePicker` replaces the text inputs. Each option value is a radio group over the
photographs the product has, rendered as thumbnails, with **"Default photo" as the first choice
rather than as the absence of one** — that is the state a blank input could not distinguish from
an unfinished edit, and it is the common case.

**The choices are `photographChoicesFor(product)`, which is the product's whole gallery**: its own
`media.images` first, then each already-mapped variant photograph the list does not already
contain. That is `buildGalleryImages` — the same set the storefront gallery builds from the same
record ([ADR-050](ADR-050-unified-gallery-strip.md)) — and it is the direct answer to the second
row of the table above. A mapping pointing at a photograph outside both lists still renders, as a
"Current photo" tile, so no record can be silently unmapped by a screen that could not name its
file.

Nothing here uploads, replaces or deletes an image. `media.images` remains read-only, as ADR-064
left it. The picker writes the same `media.variantImages` map the text boxes wrote, one path per
key, in the same order.

### 4. Option values are fields, and the default is a select

`ProductOptionDraft.values` changes from newline-separated text to `string[]`, and each value gets
its own input with its own Remove button. The textarea was simpler and it worked; it was replaced
because of what now sits beside it. Every value is a row in the photograph picker, keyed by its
exact text, and in a textarea a trailing space, a stray blank line or a duplicated value are all
invisible — each one either creates a picker row that pairs with nothing or drops a pairing the
operator already made.

The `default` field becomes a `<select>` over those values, which removes the entire class of
"default must be one of the values" failures rather than reporting them after a save.

The cost is roughly forty lines over a textarea, spent once, on the group of fields the rest of
the tab is keyed to.

### 5. Tabs stay; the save bar becomes sticky and the tabs carry error markers

The three-tab grouping is kept. A single scrolling page was considered and rejected for a specific
reason: it would put a refused rule an entire viewport away from the field it names.

What moved is the save button, into a sticky bar that carries the tabs, the button, and whether
anything is unsaved. "Unsaved" is computed by comparing the bytes a save would send — whitespace a
trim would remove is not an unsaved change, or the indicator trains an operator to ignore it.

A refused save marks the tabs holding the fields that were refused. `tabForProductFailure` reads
the field name the catalogue's own message opens with (`P001: pricing.price must be…`) and maps it
back to a tab. The save is one request across three tabs, so a rejection routinely names a field
that is not on screen; before this, the operator was told what was wrong and left to find it.

**None of the save mechanics changed.** The endpoint, the `ProductEdit` body, the version token,
the CONCURRENT_CHANGE refusal, the validation vocabulary and the writes-disabled gate are ADR-064's
unchanged. This is their presentation.

### 6. One latent bug fixed on the way

`toProductEdit` now derives `variantImages` from `variantImageRowsFor(draft)` rather than from
`draft.variantImages`. Deleting an option value used to leave its photograph in the draft, and the
save sent a mapping for a value the record no longer offered — ADR-064's own comment claimed
otherwise, and the structured value editor made it easy to reach. Every record in the catalogue
already satisfies the invariant, verified across all 449, so nothing existing changes shape.

## Alternatives considered

**`usePathname` and a Client Component layout for the sidebar.** Rejected. It is the obvious way
to highlight a nav and it would put JavaScript on every page of a panel that deliberately ships
none for navigation. The header mechanism already existed and already worked.

**A modal drawer for the mobile sidebar, matching `MobileNav` and `ShopFilterDrawer`.** Rejected.
A drawer earns its focus trap, its scroll lock and its backdrop by covering the page. This is two
links and a sign-out button; an in-flow disclosure is less code and less to get wrong, and both
existing drawers stay the pattern for things that genuinely cover content.

**Export all active products, as the script did.** Rejected, with the reasoning in decision 2. The
consequence worth naming: "every non-draft record" is not reachable in one click, because the list
partitions those into Live and Out of stock. Today the catalogue holds no drafts at all, so the
unfiltered export *is* every active product; the day a draft exists, an operator wanting exactly
the active set exports twice or filters. That is the price of the button meaning what the page
says.

**Installing `xlsx` from the SheetJS CDN rather than npm.** Rejected. The vendor publishes newer
builds only from `cdn.sheetjs.com`, and pinning a tarball URL would make every Docker build on the
Coolify VPS depend on a host outside npm. `xlsx@0.18.5` from the registry is what the script
already used, so the sheets are identical, and this route only ever *writes* workbooks — it parses
no untrusted file.

**Keeping `scripts/export-live-products.mjs` alongside the route.** Rejected, with the reasoning
in decision 2.

**A picker over `media.images` alone.** Rejected on the evidence: it cannot represent any of the
seven mappings the catalogue holds.

**Uploading images from the panel.** Out of scope, as in ADR-064. So is per-variant pricing: no
change is made to `Product` or `ProductOption` here.

## Consequences

**Easier.** Adding a fourth admin section is a row in `ADMIN_SECTION_LABELS` and a resolver beside
it. Exporting the catalogue is a click by somebody with no checkout, no terminal and no npm.
Pairing a photograph with a colour is a thing you look at rather than a path you copy, and a value
you delete takes its pairing with it.

**Harder.** The product form is three components rather than one, and `ProductOptionDraft.values`
is no longer the string the record stores — a transform now sits between them, and the round-trip
test over all 449 records is what holds it honest. The export route is a second reader of the
catalogue from an admin surface, so a future Postgres migration has two callers of
`listProducts()` to satisfy rather than one; both go through the repository, which is the point.

**A new column of risk in `data/products.json`.** The picker makes assigning and clearing a
variant photograph a one-click action, where it was previously a deliberate retype. The save path
is unchanged and still refuses anything the build would refuse, and the catalogue's audit trail is
still a commit.

**What would force a revisit.** Per-variant pricing, which would make an option value a thing that
carries an amount and would change the record shape this picker is a view over. Image upload,
which would make `media.images` editable and turn `photographChoicesFor` into a list that changes
without a save. A fifth or sixth admin section, at which point the flat sidebar list wants
grouping.
