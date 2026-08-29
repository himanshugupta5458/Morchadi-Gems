# PATCH /admin/api/products/{id}

Saves one product's record — all three tabs of the edit form — in one request, validated against
the whole catalogue and written atomically, or refused with the reasons the build would give.

**Two public URLs, one handler.** On the admin subdomain this route is reached at
`https://admin.morchadigems.com/api/products/{id}`, which `middleware.ts` rewrites to
`/admin/api/products/{id}`. In local development it is reached by its internal path. Neither
address is written down in a component: the form resolves it from the request's hostname with
`resolveAdminProductActionHref`. See
[ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md) and
[ADR-064](../decisions/ADR-064-admin-product-management.md).

**This is the only route in the repository that writes `data/products.json`, and on most
deployments it refuses to.** The catalogue a production container serves is compiled into its
build, so a write there changes nothing anyone can see — see
[503 CATALOGUE\_WRITES\_DISABLED](#503-service-unavailable--catalogue_writes_disabled) below, and
[ADR-064](../decisions/ADR-064-admin-product-management.md) finding 1 for the measurement.

**The handler performs no write itself.** It resolves the session, coerces the body into the shape
of an edit, and hands both to `productRepository.updateProduct`. When the catalogue moves to
Postgres, this file does not change.

## Request

| | |
| --- | --- |
| Method | `PATCH` |
| Runtime | `nodejs` — reads and rewrites a file |
| Caching | `dynamic = "force-dynamic"`; every response carries `Cache-Control: no-store` |
| Auth | A live admin session, resolved against Postgres inside the handler |

`{id}` is the product's P-code (`/^P\d{3}$/`) — the id on the owner's invoices and photograph
filenames ([ADR-016](../decisions/ADR-016-real-product-import.md)), and the same value the product
list links each row with. **It must already exist in the catalogue.** This endpoint cannot create
a product; an unknown id is a 404, never an insert. Adding a product remains the Draft A pipeline's
job ([ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)) followed by
`npm run publish:product`.

`PATCH` rather than `POST` because it replaces the editable fields of an existing record and
creates nothing. It is also not a method a cross-site `<form>` can issue at all, which sits
alongside the JSON content type and the `SameSite=Lax` cookie in keeping this reachable only from
the panel.

```ts
interface AdminProductActionRequestBody {
  /** Every editable field, all of them present. Not a partial — see below. */
  edit: ProductEdit;
  /** The version token the form was rendered from. A mismatch is a 409. */
  expectedVersion: string;
}

interface ProductEdit {
  name: string;
  category: Category;
  /** null removes the key — the field is optional on the record and blank is not a value. */
  subcategory: string | null;
  description: string;
  status: "draft" | "active";
  flags: { featured: boolean; isNew: boolean };
  stock: { inStock: boolean };
  /** An empty array removes the key — a product sold in one configuration has no options. */
  options: { name: string; type: ProductOptionType; values: string[]; default: string }[];
  /** Keyed "OptionName:value". An empty object removes the key. */
  variantImages: Record<string, string>;
  pricing: { price: number; mrp: number; cost: number; minPrepaidAmount: number };
  specs: Record<string, string>;
  seo: ProductSeo;
}
```

`Content-Type: application/json` is required in practice. A body that is not a JSON object is
treated as `{}`, which fails validation like any other empty submission — never a 500.

**`edit` is complete, not partial.** A partial makes "absent" ambiguous: it can mean *leave this
alone* or *clear this*, and the two readings differ for exactly the fields most worth getting
right — `subcategory`, `options` and `variantImages` are all legitimately absent on a real record.
A complete edit says what the record should be, and the repository decides which keys that means
writing.

**Four fields are absent from `ProductEdit` and cannot be set.** `id`, `media.images`,
`collections` and `migrationProvenance` are not read off the body at all, so naming them changes
nothing: an id is the owner's P-code, image files are out of scope for a screen that cannot upload,
collections are merchandising taxonomy, and provenance is a historical fact about where a record
came from ([ADR-056](../decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md)).
They are carried through from the record on disk unchanged.

**The id comes from the URL and never from the body**, so a request cannot name one product and
edit another.

## Server-side validation

Performed in this order. Every step re-derives its answer from the file rather than from the body.

1. **Session.** `readAdminSessionFromRequest` resolves the cookie against Postgres. No session is
   a 401, and the catalogue is never opened. A body cannot claim an identity — there is no
   `changedBy` field on this route and no audit row for it; the catalogue's audit trail is the git
   history ([ADR-001](../decisions/ADR-001-tech-stack.md)).
2. **Shape coercion, not value coercion.** `readProductEdit` forces the body into the *structure*
   of a `ProductEdit` — a string where an array belongs would otherwise throw a `TypeError` rather
   than be refused. **Values pass through untouched**: a price of `"210"`, a `featured` of
   `"yes"`, a category of `"jewellery"` all reach the validator as sent, so the thing that rejects
   them is the catalogue's own rule in the build's own words. A `Number("abc")` coerced to `0`
   here would save a zero-rupee price no rule ever objected to.
3. **Writes enabled?** If not, `503` before the file is opened.
4. **Read the catalogue from disk.** Everything after this point reasons about this read, never
   about a copy loaded when the form was rendered. An unreadable or non-array file is a `500`.
5. **Record exists?** An id not in the catalogue is a `404`.
6. **Version check.** `sha256(JSON.stringify(record)).slice(0, 16)` of the record *as just read*
   must equal `expectedVersion`. A mismatch is a `409` and nothing is written.
7. **Apply and compare.** The rebuilt record is compared to the current one; byte-identical is
   `UNCHANGED`, and the file is not rewritten.
8. **Validate the whole resulting catalogue** against a baseline measured from the *unedited*
   catalogue, using `scripts/product-record-rules.mjs` — the same module
   `scripts/validate-products.mjs` imports. Only failures this edit *introduced* count. Any
   introduced failure, whether it names this product or not, is a `422`.
9. **Write atomically**, `data/products.json` and `data/keyword-map.json` both.

**Prices are not exempt from any of this, and this route is not a pricing path.** It sets what a
product costs in the catalogue; it never computes what a shopper is charged. Server-side price
validation for an order still reads `data/products.json` at request time in
[`/api/create-order`](create-order.md), and nothing about that changed.

### The rules an edit is held to

Every one of them comes from `scripts/product-record-rules.mjs`, so the panel and
`npm run validate:products` cannot disagree. Among them: the id pattern, the key set of the record,
the category vocabulary, `price`/`mrp`/`cost`/`minPrepaidAmount` as positive whole rupees with
`mrp >= price`, the implied-discount ceiling, meta-copy lengths, keyword and meta-title uniqueness
across the catalogue, the precious-metal honesty rules
([ADR-018](../decisions/ADR-018-honest-product-description.md),
[ADR-035](../decisions/ADR-035-catalogue-content-pass.md)), the no-fabricated-reception rule
([ADR-034](../decisions/ADR-034-seo-audit-remediation.md)), variant-image keys matching an option
the product actually offers, and the merchandising floors — four featured and four new products
minimum, and no surfaced category left empty.

**One gate rule is deliberately not run here**: the near-match keyword advisory, which compares
every keyword entry against every other (~1.6 million pairs) and is advisory in both places. It
could never have blocked a save. Nothing that can *fail* the build is missing.

**Advisories do not block.** A thin margin, a description outside the house word range, a
`minPrepaidAmount` above the product's own price — these are returned alongside a successful save
and the operator decides. Margin is the owner's call, not the code's
([ADR-040](../decisions/ADR-040-postgres-for-orders.md)).

## Responses

### 200 OK — `UPDATED`

The record was written, and so was the rebuilt keyword map.

```json
{
  "status": "UPDATED",
  "version": "09ed546338859774",
  "advisories": ["P001: 24 words, outside the 150-300 word house range"]
}
```

`version` is the **new** token. The form adopts it, so a second consecutive edit is not refused as
a concurrent change by the operator's own first one.

### 200 OK — `UNCHANGED`

The submitted edit rebuilt a byte-identical record. Nothing was written and the token did not move.

```json
{ "status": "UNCHANGED", "version": "f4c817691c2e586e" }
```

### 401 Unauthorized

No live admin session. The catalogue is never opened.

```json
{ "status": "REJECTED", "error": "UNAUTHENTICATED", "message": "Sign in to continue." }
```

### 404 Not Found

No product in the catalogue carries this id. Never an insert.

```json
{ "status": "REJECTED", "error": "NOT_FOUND", "message": "No product in the catalogue has that id." }
```

### 409 Conflict — `CONCURRENT_CHANGE`

The record's hash on disk no longer matches `expectedVersion`: it changed after the form was
rendered, by another tab, another operator, a script, or a `git pull`. **Nothing is written.**

```json
{
  "status": "REJECTED",
  "error": "CONCURRENT_CHANGE",
  "message": "This product changed on disk after this form was opened, so the save was refused rather than overwriting it. Reload the page and make the edit again.",
  "failures": []
}
```

The token is per record, not per file, so two operators editing two different products never see
this.

### 422 Unprocessable Entity — `VALIDATION_FAILED`

The edit would have broken one or more of the catalogue's rules. **Nothing is written.**
`failures` carries every one of them, verbatim from the validator — an edit can break several
rules at once and the operator needs all of them, in the same words a failed build would use.

```json
{
  "status": "REJECTED",
  "error": "VALIDATION_FAILED",
  "message": "That edit would break a rule the catalogue is built on, so nothing was saved. The reasons are below, in the same words the build would use.",
  "failures": [
    "P001: \"18K Hallmarked Gold Wave Band Initial Ring\" makes a precious-metal claim this catalogue cannot support",
    "P001: pricing.price must be a positive whole number of rupees"
  ]
}
```

A failure that names no product id — `"expected at least 4 featured products, found 3"` — is still
this edit's fault and still refuses the save.

### 503 Service Unavailable — `CATALOGUE_WRITES_DISABLED`

This deployment's catalogue is compiled into its build, so a write to `data/products.json` would
change nothing. Returned **before the file is read**, and it is a refusal rather than a
false success on purpose: a save that reported success and did nothing would be worse than no save
at all.

```json
{
  "status": "REJECTED",
  "error": "WRITES_DISABLED",
  "message": "This deployment serves a catalogue compiled into the build, so a save here would change nothing. Edit the product in a checkout and publish it with a commit and a redeploy.",
  "failures": []
}
```

Writes are enabled when `CATALOGUE_WRITES_ENABLED=true`, or whenever `NODE_ENV` is not
`production`. The form disables its save button in this state rather than letting an edit be typed
and discarded.

### 500 Internal Server Error — `STORAGE_ERROR`

`data/products.json` could not be read, was not a JSON array, or could not be written. The
underlying error is logged server-side and not returned. A partially written catalogue is not a
possible outcome — see side effects.

```json
{
  "status": "REJECTED",
  "error": "STORAGE_ERROR",
  "message": "The catalogue could not be written, so the edit was not saved. Check the server log and the file's permissions.",
  "failures": []
}
```

## Side effects

On a successful save, and only then, in this order:

1. `data/products.json` is rewritten with the edited record in place. Keys are written in the
   order `PRODUCT_KEYS` lists them — the order all 449 records already use — so a one-field edit
   produces a one-line diff. Optional keys are **omitted rather than written as `null`**, because
   the gate checks the *set* of keys on a record.
2. `data/keyword-map.json` is rebuilt from the resulting catalogue and rewritten. It is derived
   data and the gate compares it byte for byte, so an edit to a keyword that left the map alone
   would give a green save and a red build. On an edit that touches no keyword the file is
   rewritten byte-identically, which is correct and produces no diff.

Both writes go to a sibling `…<pid>.tmp` and are `rename`d over the target. `rename` within one
filesystem is atomic, so a reader sees either the whole old catalogue or the whole new one. An
in-place write of 1.38 MB is not atomic: a process killed partway through leaves a truncated file,
and the thing truncated is every product rather than the one being edited. The temporary file is
unlinked if anything throws.

**No database row is written and no notification is sent.** The catalogue is not in Postgres
([ADR-040](../decisions/ADR-040-postgres-for-orders.md)) and this is not an order action.

**Nothing here reaches a shopper on its own.** On a development machine `next dev` recompiles and
the change is live within seconds; on a real checkout running a production build it is a
working-tree change that reaches the shop on the next build. Either way the record of the change
is a commit, which is the property [ADR-001](../decisions/ADR-001-tech-stack.md) wanted from prices
in the first place.

## Security notes

- **Reads no payment secret.** `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are not touched by any
  code path here.
- **Reads `DATABASE_URL`** only through `readAdminSessionFromRequest`, to resolve the session
  cookie.
- **`pricing.cost` is server-only margin data and this route both reads and writes it.** That is
  correct — the admin panel is the surface the seal exists to serve rather than to hide from — and
  the seal is enforced where it matters: `lib/product-repository-boundary.test.ts` greps real
  client chunks under `.next/static` and asserts no bundle a shopper downloads carries a product id
  beside a `"cost"` key. The product list's own row type omits `cost` entirely, so a serialised
  page prop cannot leak it either.
- **The write path is the CSRF-sensitive one**, and three things guard it: `PATCH` is not issuable
  by any `<form>`, `application/json` requires a preflight a cross-site request will not be granted,
  and the session cookie is `SameSite=Lax` and does not ride a cross-site request at all.
- **Middleware gates the path, but is not the authentication.** `/admin/api/products/*` is not a
  public admin path, so a request with no session cookie is turned away before the handler runs —
  and the handler resolves the session itself regardless, on the Node runtime, against Postgres.
  See [ADR-044](../decisions/ADR-044-admin-order-detail-and-layout-split.md).
