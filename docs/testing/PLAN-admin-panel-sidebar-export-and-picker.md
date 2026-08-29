# Test Plan: Admin panel sidebar, product export, and the variant photograph picker

- **Scope:** the sidebar's section highlighting; the `.xlsx` export route and the button that
  reaches it; the variant photograph picker and the structured option-value editor; the sticky
  save bar and the tab error markers. **Explicitly not covered here:** the save endpoint's own
  contract, which is [PLAN-admin-product-management.md](PLAN-admin-product-management.md) and is
  unchanged by this work — the cases below assert only that the new UI produces the same request.
- **Prerequisites:** the catalogue on disk (`data/products.json`); for the manual cases, local
  Postgres (`docker compose up -d`), migrations applied, `ADMIN_USERNAME`/`ADMIN_PASSWORD` in
  `.env.local`, and `npm run dev`.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The sidebar lists every declared section on every page | Render the protected layout with `x-admin-internal-path: /admin/orders` | Every `resolveAdminSectionLinks` entry is present, by label and by href | Automated |
| TC-02 | Orders is marked current on the order list | Render with `/admin/orders` | The Orders anchor carries `aria-current="page"`; the Products anchor carries none | Automated |
| TC-03 | Products is marked current on the product list | Render with `/admin/products` | The Products anchor carries `aria-current="page"`; the Orders anchor carries none | Automated |
| TC-04 | A detail page stays inside its section | Render with `/admin/products/P001` | Products is still marked current | Automated |
| TC-05 | The panel home marks nothing | Render with `/admin` | No anchor carries `aria-current="page"` | Automated |
| TC-06 | The identity and the way out travel with the sidebar | Render with `/admin/orders` | The username and a Sign out control are in the markup | Automated |
| TC-07 | A section declared without a label or href fails loudly | Assert `resolveAdminSectionLinks` covers `ADMIN_SECTIONS` exactly | One link per section, each with a non-empty label and a rooted href | Automated |
| TC-08 | The panel still carries no shop chrome | Render the admin shell | No WhatsApp link, footer copyright or site schema; the sidebar's landmarks are present | Automated |
| TC-09 | The export refuses an unauthenticated request | `GET` the export route with no session | 401; the catalogue is never read | Automated |
| TC-10 | Margin data does not leak on that refusal | Same as TC-09 | The response body contains no `pricing.cost` | Automated |
| TC-11 | The workbook is a real `.xlsx` | `GET` the export, parse the bytes | One sheet named `Live Products`, one row per selected product | Automated |
| TC-12 | The columns are the standalone script's | Parse the header row | Identical to `Object.keys(flattenProductForExport(...))`, in order | Automated |
| TC-13 | Migration provenance is exported | Find a migrated product's row | `migrationProvenance.originalId` matches the record | Automated |
| TC-14 | The response makes a browser save a file | Inspect the headers | `Content-Type` is the xlsx media type, `Content-Disposition: attachment`, `Cache-Control: no-store` | Automated |
| TC-15 | An unnarrowed export is the whole catalogue | `GET` with no query | Row count equals the catalogue, and exceeds one page | Automated |
| TC-16 | A view narrows the export | `GET ?view=out-of-stock` | Exactly the ids `matchesAdminProductView` selects | Automated |
| TC-17 | A search narrows the export | `GET ?search=ring` | Exactly the ids `selectMatchingAdminProducts` selects | Automated |
| TC-18 | A sort orders the export | `GET ?sort=price-high` | Row order equals the list's order | Automated |
| TC-19 | A page parameter is ignored | `GET ?page=3` | The whole selected set, not a page of it | Automated |
| TC-20 | The unnarrowed filename is the script's | `productExportFilename(false, date)` | `live-products-export-YYYY-MM-DD.xlsx` | Automated |
| TC-21 | A narrowed export is named differently | `productExportFilename(true, date)`, and a filtered `GET` | `products-export-filtered-YYYY-MM-DD.xlsx` | Automated |
| TC-22 | The button's label says which of the two it does | `adminProductExportLabel` for a default and a narrowed query | "Export all N products" / "Export these N filtered products" | Automated |
| TC-23 | The label's count is the export's count | Compare the label against the parsed row count | They agree | Automated |
| TC-24 | An unreadable catalogue is not an empty sheet | Make `listProducts` throw | 503 saying nothing was exported | Automated |
| TC-25 | The picker offers the product's whole gallery | Render the Variants tab for P586 | One radio per photograph on the record, plus the default choice — 15 in total, not 9 | Automated |
| TC-26 | An unmapped value shows as using the default | Inspect `Color: Combo` | The "Default photo" radio is checked and the row says the primary photograph is shown | Automated |
| TC-27 | A mapped value shows its photograph | Inspect `Color: Wine Red` | The checked radio's value is `/products/P586-wine-red.webp` | Automated |
| TC-28 | Clicking a thumbnail assigns it | Click `View 3` on `Color: Combo`, save | The submitted `variantImages` carries that path for that key | Automated |
| TC-29 | Choosing the default clears the pairing | Click "Default photo" on a mapped value, save | The key is absent from the submitted map | Automated |
| TC-30 | An untouched record saves its mappings unchanged | Open the Variants tab and save | The submitted map equals `media.variantImages` exactly — the data-loss regression | Automated |
| TC-31 | The payload is byte-identical to the typed-path form's | Make one choice, compare against a reimplementation of the old transform | `JSON.stringify` equality, key order included | Automated |
| TC-32 | A choice survives a tab change | Choose, leave the tab, return | The same radio is still checked | Automated |
| TC-33 | A deleted option value cannot keep its photograph | `assignVariantImage` on a draft whose value was removed | Only the surviving keys are returned | Automated |
| TC-34 | Values are fields, not a textarea | Render the Variants tab | `Value 1`, `Value 2`… each carry one value | Automated |
| TC-35 | A new value gets a photograph row immediately | Add a value, type into it | A picker group appears for it | Automated |
| TC-36 | A removed value takes its row and its mapping | Remove value 2, save | The group is gone and the key is absent from the submitted map | Automated |
| TC-37 | The default is chosen, not typed | Inspect the Default control | A `<select>` whose options are the current values | Automated |
| TC-38 | Save is reachable from every tab | Visit each tab | The Save product button is present each time | Automated |
| TC-39 | The bar states whether anything is unsaved | Edit a field | "Nothing unsaved" becomes "Unsaved changes on this record." | Automated |
| TC-40 | A landed save clears the state | Save | "Nothing unsaved" returns | Automated |
| TC-41 | Trimmed whitespace is not an unsaved change | Type a trailing space into a trimmed field | Still "Nothing unsaved" | Automated |
| TC-42 | Each refused rule maps to the tab holding its field | `tabForProductFailure` over pricing, seo, specs, options, media and unknown prefixes | pricing / pricing / pricing / variants / variants / basic, and basic for the unknown | Automated |
| TC-43 | The refused tab is marked on screen | Refuse a save with an `seo.metaTitle` failure | Pricing & SEO carries the marker; Basic details does not | Automated |
| TC-44 | Editing a record still round-trips losslessly | `toProductEdit(toProductDraft(p))` for all 449 records | Identical to the record, including options and variant images | Automated |
| TC-45 | The panel navigates by sidebar in a browser | Sign in, follow Orders then Products | Each page highlights its own section | Manual |
| TC-46 | The export button downloads a real workbook | Press it unfiltered and filtered | Two `.xlsx` files that open, with 449 and 6 rows and the right filenames | Manual |
| TC-47 | A real variant-image edit reaches the file | Pair a photograph, save | A one-line diff in `data/products.json`, visible on reload | Manual |
| TC-48 | A stale version is still refused | Save with a stale token | 409 `CONCURRENT_CHANGE`, file untouched | Manual |
| TC-49 | A broken rule is still refused in the build's words | Save an invalid meta title | 422 quoting the catalogue's own message, file untouched | Manual |
| TC-50 | The test edit is reverted | Clear the pairing through the panel | Working tree clean | Manual |
