# Test Plan: Admin product management

- **Scope:** the admin product list and edit screens, the `PATCH /admin/api/products/{id}` save,
  the `ProductRepository` boundary, and the shared-rules extraction into
  `scripts/product-record-rules.mjs`. Covers reading, filtering and editing an existing product;
  the writability gate; the concurrency token; and the atomic write.
  **Explicitly not covered:** creating or deleting a product (this surface cannot — see
  [ADR-064](../decisions/ADR-064-admin-product-management.md)), image upload, editing
  `collections` or `migrationProvenance`, and any storefront rendering of an edited record beyond
  confirming that `next dev` picks a write up.
- **Prerequisites:** local Postgres running (`docker-compose.yml`) for the admin session;
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` set for the manual cases;
  `data/products.json` in its committed state. The manual cases end by reverting the working tree.

## Cases

### The repository boundary

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | No feature file reaches past the interface | Enumerate both route directories recursively plus the twelve named modules/components; match forbidden **import specifiers** | None imports `@/data/products.json`, `@/lib/products` or `@/lib/shop`. A doc comment mentioning `lib/products.ts` is not a violation | Automated |
| TC-02 | The pages positively go through the interface | Read both pages and the route | Each contains `productRepository` and imports `@/lib/product-repository` | Automated |
| TC-03 | Only the JSON implementation touches the filesystem | Read `lib/product-repository.ts` and every feature file | Only the repository imports `node:fs/promises`; nothing else calls `writeFile`/`rename` | Automated |
| TC-04 | Margin data stays out of the shopper's browser | Grep every `.js` under `.next/static/chunks` for a product id beside `"cost"` | No client chunk carries both. **Requires a production build** — skips without one | Automated |
| TC-05 | Reads see changes made behind the server | Write the catalogue file directly, then call `listProducts` | The new value is returned — no module-level cache | Automated |

### The shared rules

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-10 | The shipped catalogue passes the panel's rules | Run `validateCatalogue` over all 449 records | Zero failures; valid overall | Automated |
| TC-11 | The gate and the panel share one implementation | Read both source files | The gate imports the shared module and retains **no validate function of its own**; the panel's wrapper imports the same module | Automated |
| TC-12 | Record-level rules fire | Fractional price, `mrp` below price, karat claim, bare precious metal, meta lengths, unknown key, fabricated review, bad status, orphan variant image | Each refused with the gate's own wording | Automated |
| TC-13 | Catalogue-level rules fire | Duplicate primary keyword, duplicate meta title, duplicate id, unfeaturing below the floor | Each refused, though invisible from inside one record | Automated |
| TC-14 | A pre-existing failure is not blamed on this edit | Validate an already-failing catalogue, then edit an unrelated product | The save is allowed; the pre-existing failure is not reported | Automated |
| TC-15 | A floor breach naming no id still blocks | Unfeature the fourth featured product | Refused, reported under catalogue failures | Automated |

### The save endpoint

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-20 | Unauthenticated save | `PATCH` with no cookie | 401; the catalogue is never opened | Automated |
| TC-21 | A body cannot claim an identity | `PATCH` with an admin-ish field in the body | Ignored; still 401 without a session | Automated |
| TC-22 | Every outcome maps to an honest status | Drive each `ProductUpdateOutcome` | 200 `UPDATED` / 200 `UNCHANGED` / 404 / 422 / 409 / 503 | Automated |
| TC-23 | The URL decides which product is edited | Body names a different id than the URL | The URL's product is edited | Automated |
| TC-24 | A non-JSON body | Send garbage | Refused as an empty submission, never a 500 | Automated |
| TC-25 | Hostile shapes are coerced, values are not | Arrays where objects belong; `"210"` as a price | Shape coerced; **values judged by the real rules**, not silently converted | Automated |

### The form

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-30 | Every record survives the round trip | `toProductEdit(toProductDraft(p))` for all 449 | Byte-identical to the original editable fields, SEO block included | Automated |
| TC-31 | A blank amount is refused, not zeroed | Clear a price field | Produces `NaN` → `null` → the validator's own message | Automated |
| TC-32 | Switching tabs keeps unsaved edits | Edit tab 1, visit tab 3, return | The edit is still there; two-tab and checkbox variants too | Automated |
| TC-33 | One save sends all three tabs | Edit on each tab, submit once | One `PATCH`, JSON, carrying all three | Automated |
| TC-34 | The returned version is adopted | Save twice in a row without reloading | The second save is not a false conflict | Automated |
| TC-35 | A refused save keeps the operator's work | Trigger a 422 | Every broken rule shown in the build's words; the typed edits stay on screen | Automated |
| TC-36 | A read-only deployment | Render with writes disabled | The save button is disabled rather than accepting a discarded edit | Automated |
| TC-37 | Untouchable fields are facts, not fields | Render the form | Product code, provenance and photographs shown read-only | Automated |
| TC-38 | Variant rows follow the draft's options | Rename an option, remove a value | Rows recomputed; a stranded variant image is dropped | Automated |

### The pages

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-40 | The list renders the real catalogue | Load `/admin/products` | 25 rows, correct total and page count, every row linked | Automated |
| TC-41 | Tabs carry true counts; filters filter | Load each view and a category filter | Counts match the view's real contents | Automated |
| TC-42 | An empty result reads as empty, not broken | Filter to nothing | An empty state about the catalogue, not an error | Automated |
| TC-43 | The detail page opens a draft | Load a `draft` product | Renders — the storefront would refuse it | Automated |
| TC-44 | An unreadable catalogue | Break the file | `AdminCatalogueError` on both screens; **not** described as a database outage | Automated |

### Manual — the things only a running server can answer

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-50 | Sign in and reach the panel | `POST /admin/api/login`, then `GET /admin/products` | 200, session cookie set, list renders with real counts | Manual |
| TC-51 | The rendered version token is real | Read the token off the edit page; recompute the hash independently | The two match exactly | Manual |
| TC-52 | A real edit persists | Save a description change through the route | 200 `UPDATED`, a new token, and a **one-line** diff in `data/products.json` | Manual |
| TC-53 | The advisory is surfaced, not enforced | Save a product carrying a pre-existing advisory | Save succeeds **and** reports the advisory | Manual |
| TC-54 | The change survives a reload | Re-`GET` the edit page | The new value renders; the page's token equals the one the save returned | Manual |
| TC-55 | `next dev` picks the write up | `GET` the storefront product page | The new description renders without a restart — finding 1's dev half | Manual |
| TC-56 | The keyword map is rebuilt | Save a changed secondary keyword | `data/keyword-map.json` genuinely changes, in sorted position | Manual |
| TC-57 | Two tabs, one product — the lost update | Both open at version V1; tab B saves; tab A then saves | Tab A refused **409 `CONCURRENT_CHANGE`**; the file is byte-identical before and after; tab A's value never reaches the file; tab B's survives | Manual |
| TC-58 | The real gate rules fire at runtime | Save a karat claim and a fractional price together | 422 listing **both** failures in the gate's own words; nothing written | Manual |
| TC-59 | No residue | After every case | No `data/*.tmp` left behind; `git status data/` clean after revert | Manual |
