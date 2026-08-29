# GET /admin/api/products/export

Hands back the product list the operator is looking at as a downloadable `.xlsx` workbook.

**Two public URLs, one handler.** On the admin subdomain this route is reached at
`https://admin.morchadigems.com/api/products/export`, which `middleware.ts` rewrites to
`/admin/api/products/export`. In local development it is reached by its internal path. Neither
address is written down in a component: the list page resolves it from the request's hostname with
`resolveAdminProductExportHref`. See
[ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md) and
[ADR-065](../decisions/ADR-065-admin-sidebar-export-and-variant-picker.md).

**It exports the list on screen, not a fixed set.** The query string is the product list's own,
parsed by the same `parseAdminProductQuery` and filtered by the same `selectMatchingAdminProducts`,
so the workbook holds exactly the rows the current view, filters, search and sort select — every
page of them, not the twenty-five being displayed. The button that reaches it names the count for
that reason.

**It replaces `scripts/export-live-products.mjs`**, which is deleted. The column set, their order,
the sheet name and the unfiltered filename are that script's, unchanged, so a folder of last
month's exports and this month's are sheets of the same thing.

**A static segment beside a dynamic one.** This route sits next to `app/admin/api/products/[id]`,
and Next resolves a literal segment ahead of a dynamic one, so `export` is not a reachable product
id. No product may ever be given that id.

## Request

| | |
| --- | --- |
| Method | `GET` |
| Runtime | `nodejs` — `xlsx` writes a binary workbook into a `Buffer` |
| Caching | `dynamic = "force-dynamic"`; every response carries `Cache-Control: no-store` |
| Auth | A live admin session, resolved against Postgres inside the handler |

`GET` because the route creates nothing and changes nothing. That is what lets the button be an
ordinary `<a>` rather than a `fetch`, which keeps the product list's promise of shipping no client
JavaScript, and it means the download survives a new tab, a copied URL and a retry.

There is no request body. Every parameter is a query-string field, and all of them are the product
list's own — a URL copied from the list's address bar and pointed at this route exports what that
list shows.

| Field | Values | Default |
| --- | --- | --- |
| `view` | `all`, `live`, `out-of-stock`, `draft` | `all` |
| `category` | any category slug | none |
| `price` | any price-band slug | none |
| `flag` | `featured`, `new` | none |
| `search` | free text, truncated to 60 characters | none |
| `sort` | `id`, `name`, `price-high`, `price-low` | `id` |
| `page` | **ignored** — a page is not a subset of the answer | — |

## Server-side validation

1. **The session is resolved against Postgres.** Middleware has already turned away a browser with
   no session *cookie*, but a cookie is not a session and a forged one passes that gate. The
   catalogue in this file carries `pricing.cost` for all 449 records, so margin data leaving the
   building on an unauthenticated request is precisely what this check exists to prevent.
2. **The query string is parsed, never trusted.** `parseAdminProductQuery` cannot fail: an
   unrecognised view, an impossible category or a page of `-4` falls back to the default it
   replaces rather than producing an error. A hand-edited URL narrows the export or does nothing;
   it can never widen it beyond the catalogue or reach a record the panel would not list.
3. **The catalogue is read through `productRepository.listProducts()`**, never from
   `data/products.json` directly and never through `lib/products.ts`. When the catalogue moves to
   Postgres this file does not change
   ([ADR-064](../decisions/ADR-064-admin-product-management.md)).

Nothing here writes. This route cannot change a record.

## Responses

### 200 OK

The workbook itself, as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

| Header | Value |
| --- | --- |
| `Content-Type` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | `attachment; filename="live-products-export-YYYY-MM-DD.xlsx"` when nothing narrows the list, `attachment; filename="products-export-filtered-YYYY-MM-DD.xlsx"` when something does |
| `Cache-Control` | `no-store` |
| `X-Product-Export-Count` | the number of rows in the sheet |

The two filenames are deliberate. The unnarrowed export keeps the standalone script's exact name
because it is the same sheet that script produced; a narrowed one is named differently because a
file called `live-products-export` holding six out-of-stock rows will be mistaken for the catalogue
by whoever opens it next month.

One sheet, named `Live Products`, one row per product, and these columns in this order:

```
id, name, category, status, description,
pricing.price, pricing.mrp, pricing.cost, pricing.minPrepaidAmount,
media.images, media.variantImages,
stock.inStock, flags.featured, flags.isNew,
options, specs,
seo.primaryKeyword, seo.secondaryKeywords, seo.metaTitle, seo.metaDescription, seo.imageAlt,
migrationProvenance.originalId, migrationProvenance.originalSku,
migrationProvenance.originalUrl, migrationProvenance.originalCategories
```

Nested blocks are spread into prefixed columns so every field is sortable and filterable in Excel
rather than collapsed into a JSON blob nobody can sort by. `media.variantImages` is the exception
and stays a JSON string: its keys differ per product, so it has no fixed set of columns to become.
Lists join with ` | `. The `migrationProvenance.*` columns are blank for a product that was never
on the old Odoo site — an absent block, not missing data.

### 401 Unauthorized — `UNAUTHENTICATED`

No live session. The catalogue is never read.

```json
{ "status": "REJECTED", "error": "UNAUTHENTICATED", "message": "Sign in again to export." }
```

### 503 Service Unavailable — `CATALOGUE_UNAVAILABLE`

The catalogue could not be read — a malformed or missing `data/products.json`. Answered rather
than allowed to become an empty spreadsheet, which is the failure mode CLAUDE.md forbids: a store
that cannot be read must never render as no results
([ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md)).

```json
{
  "status": "REJECTED",
  "error": "CATALOGUE_UNAVAILABLE",
  "message": "The catalogue could not be read, so nothing was exported. Check the server log."
}
```

### 500 Internal Server Error — `SERVER_ERROR`

Anything else, including a workbook that could not be built. The detail is in the server log and
never in the response.

## Side effects

None. No external call, no write, no email. The route reads the catalogue and returns bytes.

## Security notes

- **`pricing.cost` is in this file.** It is margin data, admin-only and server-only, and the
  session check above is the only thing standing between it and an anonymous `GET`. That check
  runs before `listProducts()`, so an unauthenticated request never causes the catalogue to be
  read at all.
- Draft records are included when the query selects them. That is correct here and differs from
  the storefront, where a draft 404s: the panel is where an unpublished record is worked on.
- No secret is read by this route. `DATABASE_URL` is used only inside `readAdminSessionFromRequest`,
  which is `server-only`, and nothing here reaches a client bundle.
