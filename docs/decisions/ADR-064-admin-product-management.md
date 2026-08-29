# ADR-064: The catalogue gets an editor, behind a repository boundary and a writability gate

- **Status:** Accepted
- **Date:** 2026-08-29
- **Prompt:** 109

## Context

[ADR-001](ADR-001-tech-stack.md) put the product catalogue in `data/products.json` and left it
there on purpose: prices change when somebody ships a commit, and a diff is the best audit trail
a price can have. [ADR-040](ADR-040-postgres-for-orders.md) brought Postgres in for orders,
customers and admins and explicitly did **not** bring it in for the catalogue.
[ADR-041](ADR-041-admin-subdomain-and-auth.md) built an authenticated operator and said in as
many words that it was not a catalogue admin.

This prompt was asked to build one anyway — a product management screen in the panel — and the
first question was therefore not "what should the form look like" but "does writing to the
catalogue from a running server do anything at all". Three things had to be established before a
line of UI was worth writing:

1. **Is `data/products.json` writable from the deployed process, and does a write to it change
   what anyone sees?**
2. **Does the running server read the file, or a copy of it held in memory?** If it holds a
   copy, an edit that lands on disk is invisible until a restart, and the panel would be lying
   about what it had done.
3. **What happens when two edits overlap?** A solo operator will not race themselves, but a
   panel with a save button is a panel that can be double-submitted, left open in two tabs, or
   killed mid-write by a deploy.

The answers are below, and they are measurements rather than assumptions. Two of the three
turned out to be worse than expected, and the third turned out to matter for a different reason
than the obvious one.

### Finding 1 — the deployed container's catalogue is compiled in, and a write to the file is a silent no-op

`lib/products.ts` reads the catalogue with a static `import` of `data/products.json`. webpack
resolves that at build time and **inlines every record into the compiled server bundle**: all 449
products end up as object literals in `.next/server/chunks`. Next's build trace also copies
`data/products.json` into the production image, which is what makes this dangerous — the file is
*there*, at the path the code would name, and it is never read by the running process.

So a write to it from inside the deployed container:

- succeeds at the filesystem level and returns no error,
- changes nothing any shopper or operator can see, because nothing reads it,
- does not survive the next redeploy, because the container filesystem is ephemeral, and
- **is indistinguishable from a successful save.**

That last property is the one that decided the design. This is not a feature that degrades in
production; it is a feature that reports success and does nothing, which is strictly worse than
one that refuses.

**Under `next dev` the same write behaves completely differently.** The dev server watches the
module graph, notices `data/products.json` changed, and recompiles — so the edit is live within
seconds, on the storefront as well as the panel. Verified during this prompt's manual test: after
saving a description through the panel, `GET /product/P001` on the running dev server rendered the
new text without a restart
([RESULT-2026-08-29-admin-product-management.md](../testing/RESULT-2026-08-29-admin-product-management.md),
TC-05).

A panel that saved happily in both environments would demo perfectly on a laptop and quietly do
nothing in production. That asymmetry is the whole reason decision 3 exists.

### Finding 2 — staleness is real, and is avoided by not caching rather than by invalidating

Because the storefront's copy is inlined at build time, any admin surface that reached the
catalogue through `lib/products.ts` would be reading a *build-time snapshot* — and would go on
reading it after a save, showing the operator their own edit as though it had not happened.

The catalogue is 1.38 MB and 449 records, which is small enough that this needs no cache at all.
`JsonFileProductRepository` reads the file with `fs` on every single call and holds nothing
between them. That costs one parse per admin page view, which is nothing at one operator, and it
buys a property nothing else does: the panel always shows what is on disk, including a change
made by a text editor, by `scripts/publish-product.mjs`, or by a `git pull` since the server
started. `lib/product-repository.test.ts`'s *"reads the file rather than a cached copy, so a
change made behind it is visible"* is the test that holds this.

Both product pages also carry `export const dynamic = "force-dynamic"`, so Next's own render
cache cannot reintroduce the staleness the repository just eliminated.

### Finding 3 — the concurrency worth engineering against is a torn file, not two operators

The shop has one operator. Two people racing on one product is close to hypothetical, and a
design that spent much on it would be spending in the wrong place.

What is **not** hypothetical is a process dying partway through a 1.38 MB write. Coolify restarts
containers on every deploy. An in-place `writeFile` that is interrupted leaves a truncated JSON
file, and the thing truncated is not the record being edited — it is **every product after the
write head**, plus the file's validity as JSON. One interrupted save could empty the shop.

The second real risk is narrower and still worth closing: one operator with the same product open
in two tabs, saving both. That is a lost update, and it is silent.

## Decision

### 1. Every admin product surface reaches the catalogue through `ProductRepository`, and nothing else

`lib/product-repository.ts` defines a three-method interface — `listProducts`, `getProduct`,
`updateProduct` — written in terms of `Product` and nothing else. There is no cursor, no byte
offset, no file handle and no notion of a JSON document anywhere in it. The day the catalogue
moves into Postgres, a `PrismaProductRepository` implements those three methods and the pages,
routes, forms and validation above it do not change.

`JsonFileProductRepository` is today's one implementation, and `productRepository` is the single
exported instance every surface imports. A single instance because it holds no state worth
keeping — it is a path and a policy — and naming it once means a page cannot quietly construct one
pointed somewhere else.

**`lib/products.ts` is untouched and stays exactly as it is.** It is the storefront's read-only
accessor, it is not a defect, and this decision says nothing about it beyond *the admin product
feature does not call it*. Reusing it would have put the build-time snapshot of finding 2 behind
an admin page.

**The boundary is enforced by a test, not by a convention.** Reaching past the interface straight
to `data/products.json` is easier than going through it and works just as well today, so a review
note would not survive contact with the next prompt.
`lib/product-repository-boundary.test.ts` enumerates every file in the feature — both route
directories, recursively, plus twelve named modules and components — and asserts:

- none of them imports `@/data/products.json`, `@/lib/products` or `@/lib/shop`, matched as
  **import specifiers** rather than as bare words, so the several doc comments that legitimately
  *mention* `lib/products.ts` are not false positives;
- the two pages and the route positively contain `productRepository` and import it — the mirror
  of the rule, because a page that read nothing at all would pass the negative check trivially;
- only `lib/product-repository.ts` touches `node:fs/promises`;
- nothing else in the feature calls `writeFile`, `writeFileSync`, `renameSync` or `rename`.

That file also carries the margin-data check: a grep over real client chunks in `.next/static`
asserting that no bundle a shopper downloads contains a product id beside a `"cost"` key. It is
the [ADR-056](ADR-056-image-confirmation-provenance-and-draft-similarity.md) method — grep the
build, do not read the module that is supposed to narrow it — and it is `ctx.skip`ped when no
build output is present, because the suite runs before `next build`.

### 2. The panel is held to the build's own rules, via one extracted module

The rule this feature was most likely to get wrong is the quiet one: writing a *second*,
friendlier validator for the form, so that an edit could pass the panel and fail the build.

So `scripts/validate-products.mjs` was **refactored, not duplicated**. Every constant and every
rule function moved into the new `scripts/product-record-rules.mjs` — `MIN_PRICE`/`MAX_PRICE`,
`PRODUCT_ID`, `PRODUCT_KEYS`, `CATEGORIES`, the meta-copy length bands, `validatePricing`,
`validateMedia`, `validateSeo`, `validateNoPreciousMetalClaim`, `validateNoBarePreciousMetalSpec`,
`validateProductRecord`, `validateCatalogueSeoUniqueness`, `validateCatalogueFloors` and the
rest. The gate lost roughly a thousand lines and gained an import list.

Both callers now import that one module:

| Caller | What it adds |
| --- | --- |
| `scripts/validate-products.mjs` | What is about *this repository's* catalogue rather than about a record: the file path, `EXPECTED_PRODUCT_COUNT`, the keyword map's freshness, the near-match keyword advisory, and the summary a person reads |
| `lib/product-validation.ts` | What is about serving a request: the whole-catalogue pass, the baseline diff, and the failure/advisory split the panel renders |

`lib/product-validation.test.ts`'s *"the gate and the panel share one implementation"* asserts
this structurally — the gate imports the shared module, the gate has **no validate function of its
own left**, and the panel's wrapper imports the same module.

**One rule is deliberately not run on the request path**, and it is named here so its absence is
a decision rather than a gap: the near-match keyword advisory compares every keyword entry against
every other — around 1.6 million pairs at the catalogue's 1,796 entries — and is **advisory in
both places**. It could never have blocked a save. A request handler may not spend that to tell an
operator something that would not have stopped them. Nothing that can fail the build is missing
from the panel.

The same principle runs one level further down, in `readProductEdit`
(`lib/admin-product-api.ts`): the request body's **structure** is coerced, because
`applyProductEdit` spreads `edit.options` and would throw a `TypeError` on a string, but its
**values are not**. A price of `"210"`, a `featured` of `"yes"` and a category of `"jewellery"`
all travel through untouched so that the thing rejecting them is the catalogue's own rule, in the
build's own words. A `Number("abc")` coerced to `0` here would have saved a zero-rupee price that
no rule ever objected to. `lib/admin-product-routes.test.ts`'s *"passes values through untouched
for the real rules to judge"* holds this, and `lib/admin-product-form.test.tsx`'s *"turns a blank
amount into something the validator refuses, not into zero"* holds the client half — `toAmount("")`
returns `NaN` on purpose, because `JSON.stringify` writes it as `null`, which the real rule
rejects with *"must be a positive whole number of rupees"*.

**Validation runs over the whole catalogue, not the edited record.** Three of the guarantees this
catalogue actually depends on are invisible from inside one record: an id that now collides, a
`metaTitle` or `primaryKeyword` another product already owns, and the merchandising floors —
unfeaturing the fourth featured piece empties the home best-sellers row, and the operator who did
it should hear that from the panel rather than from a failed build. Affording a full pass on every
save is exactly what excluding the 1.6-million-pair advisory pays for.

**Failures the catalogue already had are not the edit's to answer for.** `updateProduct` measures
a baseline against the *unedited* file and hands it to `validateCatalogueForEdit`, which reports
only what the edit introduced. Without it, a catalogue already failing the gate for an unrelated
reason would make every product uneditable until somebody fixed it
(`lib/product-validation.test.ts`, *"ignores a failure the catalogue already had before the
edit"*). Introduced failures are then split into the ones naming the edited id and the ones that
do not — a broken floor names no id at all and is still this edit's fault, so **both lists block
the save** (*"reports a broken floor even though it names no product id"*).

Advisories are shown and ignored. The split is the gate's own: what it exits non-zero for is a
failure here, what it prints under `ADVISORY` is an advisory here. An operator who prices a piece
below cost is told, and is still allowed to do it, because margin is the owner's call and not the
code's ([ADR-040](ADR-040-postgres-for-orders.md)).

### 3. `CATALOGUE_WRITES_ENABLED` — writes are on where the file is the catalogue, and off where it is a decoration

```ts
export function isCatalogueWriteEnabled(): boolean {
  if (process.env.CATALOGUE_WRITES_ENABLED === "true") return true;
  return process.env.NODE_ENV !== "production";
}
```

Read plainly: **on** under `next dev` and in tests, **off** in the deployed container, and **on
anywhere somebody sets the variable on purpose**.

The escape hatch is not decoration. Running a production build out of a real checkout — a
maintainer on the VPS, or a local `next start` — is a case where the edit *is* worth making even
though the running server will not show it until a rebuild: it is a working-tree change, and
committing it is exactly how [ADR-001](ADR-001-tech-stack.md) wanted a price to change. The
variable says "I know what this does here."

When writes are off, `updateProduct` returns `REJECTED / WRITES_DISABLED` **before reading the
file**, and the route answers `503` with a sentence that explains rather than apologises:

> This deployment serves a catalogue compiled into the build, so a save here would change
> nothing. Edit the product in a checkout and publish it with a commit and a redeploy.

The form disables its save button rather than accepting an edit it would discard
(`lib/admin-product-form.test.tsx`, *"disables the save rather than accepting an edit it would
discard"*), and `components/CataloguePublishNotice.tsx` states which of the two situations the
operator is in, on the screen where the edit is made. Finding 1 is invisible and
counter-intuitive; leaving it in an ADR and not on the page would be leaving it where the person
who needs it will not read it.

### 4. Concurrency is a per-record version token, and durability is an atomic rename

**The token.** `computeProductVersion(product)` is
`sha256(JSON.stringify(product))` truncated to 16 hex characters. The form renders with it, sends
it back as `expectedVersion`, and `updateProduct` refuses the save if the record on disk no longer
hashes to it.

- **Per record, not per file.** Two operators editing two different products are not in conflict,
  and a file-level token would tell them they were.
- **A hash, not a timestamp.** The catalogue has no `updatedAt`, and adding one would put a field
  on all 449 records that only this feature reads.
- **Truncated, safely.** This is a change detector between two versions of one record, not a
  security boundary. 64 bits is ample, and the failure mode of a collision is that one edit
  overwrites another made in the same second — which is the behaviour with no token at all.

The save response returns the **new** token, so the form can go on saving without a reload;
without that, an operator's second consecutive edit would be refused as a concurrent change by
their own first one (`lib/admin-product-form.test.tsx`, *"adopts the version the save returned, so
a second edit is not a false conflict"*).

**The write.** `writeAtomically` writes to a sibling `…json.<pid>.tmp` and `rename`s it over the
target, unlinking the temporary file if anything throws. `rename` within one filesystem is
atomic, so a reader sees either the whole old catalogue or the whole new one — never the torn
file of finding 3. `lib/product-repository.test.ts`'s *"leaves no temporary file behind"* holds
the cleanup.

**The order of operations in `updateProduct` is the design, not an implementation detail:**

1. writes-enabled gate — before any read, so a read-only deployment cannot fail late;
2. **re-read the catalogue from disk** — nothing after this point reasons about a copy loaded when
   the form was rendered;
3. find the record — `NOT_FOUND` if the id is not in the file;
4. compare `computeProductVersion(current)` against `expectedVersion` — `CONCURRENT_CHANGE` if it
   moved, **checked against the read in step 2**;
5. `applyProductEdit`, then short-circuit to `UNCHANGED` if the result is byte-identical, so a
   no-op save does not rewrite 1.38 MB or advance the token;
6. validate the *resulting whole catalogue* against the baseline (decision 2);
7. atomically write `data/products.json` **and** `data/keyword-map.json`;
8. return `UPDATED` with any advisories.

**The keyword map is rebuilt in the same operation** because it is derived from the catalogue and
`scripts/validate-products.mjs` compares it byte for byte. An edit to a keyword that left the map
alone would hand the operator a green save and a red build
([ADR-036](ADR-036-product-seo-metadata-pass.md)'s addendum is the rule this honours).

`ProductUpdateOutcome` is a discriminated union of `UPDATED` / `UNCHANGED` / `NOT_FOUND` /
`REJECTED`, and `REJECTED` carries one of four typed errors — `VALIDATION_FAILED`,
`CONCURRENT_CHANGE`, `WRITES_DISABLED`, `STORAGE_ERROR` — which the route maps to 422, 409, 503
and 500. `lib/admin-product-routes.test.ts`'s *"maps every outcome to an honest status"* holds all
six mappings.

### 5. What the panel may not change, stated as a type rather than as a disabled input

`ProductEdit` (`types/admin-product.ts`) is **deliberately not `Partial<Product>`**. A partial
makes "absent" ambiguous — it can mean *leave this alone* or *clear this* — and the two readings
differ for exactly the fields most worth getting right: `subcategory`, `options` and
`variantImages` are all legitimately absent on a real record, so a partial merge could never tell
*the operator removed the last option* from *the form did not mention options*. A complete edit
says what the record should be, and `applyProductEdit` decides which keys that means writing.

Four things are absent from `ProductEdit` entirely, which is a stronger statement than a disabled
input: `id` is the owner's P-code ([ADR-016](ADR-016-real-product-import.md)), `media.images` is
out of scope for a screen that cannot upload, `collections` is merchandising taxonomy, and
`migrationProvenance` is a historical fact about where a record came from
([ADR-056](ADR-056-image-confirmation-provenance-and-draft-similarity.md)). An authenticated
`curl` naming any of them changes nothing, because nothing reads them off the body.

`applyProductEdit` writes keys in the order `PRODUCT_KEYS` lists them — the order all 449 records
already use — so a one-field edit produces a one-line diff rather than a reordered record.
Verified in the manual test: changing one description produced exactly `1 insertion(+), 1
deletion(-)`. Optional keys are **omitted rather than written as `null`**, because the gate checks
the *set* of keys on a record and a `subcategory: null` is an unknown shape rather than an absent
field.

### 6. Three tabs, one form state, one save — and no variant matrix, because there is no variant

The edit screen has three tabs (Basics, Variants, Pricing & SEO) over **one** `draft` state and
**one** submit. Switching tabs cannot lose an edit and saving from any tab saves all three; three
separate forms with three save buttons would let a save land half-applied. Inactive tabs are
unmounted rather than hidden, with their state lifted, which is what makes that safe
(`lib/admin-product-form.test.tsx`, *"switching tabs keeps unsaved edits"*, three cases).

The second tab is where the schema had to be confronted rather than papered over. **This
catalogue has no per-variant price and no per-variant name.** `ProductOption` is
`{ name, type, values, default }` and nothing else — no price, no display name, no SKU — and
`types/product.ts` says so about itself: *"A choice the buyer makes without changing the price."*
`SelectedOptions` is part of a cart line's identity and of which photograph is shown, *"and of
nothing else: no amount and no stock check ever reads it"*. That is
[ADR-019](ADR-019-product-options.md)'s decision, restated by
[ADR-027](ADR-027-product-schema-migration.md) and unchanged here.

So Tab 2 does not render a variant matrix, and it does not invent one. It renders the three things
that do exist:

1. **Options** — name, one of the four controls, values one per line (newline rather than comma,
   so a value may contain a comma), and `default`, which is *written down rather than inferred
   from the order of `values`* because it is what a shopper who never opens the control is
   recorded as having chosen.
2. **Variant photographs** — one row per option value, keyed `"OptionName:value"`, recomputed by
   `variantImageRowsFor` from the **draft's** options rather than the saved record, so renaming an
   option updates the photographable list without a save in between. Keys that no longer match any
   option value are dropped, which is what stops an option edit from stranding a variant image the
   validator would then reject (*"forgets a variant image whose option value no longer exists"*).
3. **Photographs** — read-only. Uploading is not part of this screen, and the primary image's name
   is fixed to the product code by [ADR-006](ADR-006-product-image-convention.md).

And it says so in the hint text, in the operator's own reading order: *"This catalogue has no
per-variant price and no per-variant name, only per-variant photographs, so an option group varies
which picture is shown and what the order line records, and nothing else."* An operator who
expected a variant matrix should learn why there isn't one from the screen, not from an ADR.

### 7. The catalogue gets its own failure surface, and it is not the database's

`AdminCatalogueError` is a new row on
[ADR-048](ADR-048-database-health-and-failure-surfaces.md)'s table — added there as an addendum,
per the rule that adding a surface means adding a row.

It is deliberately **not** `AdminDatabaseError`, because the operator's next action and the
urgency are both different. A Postgres outage means orders are arriving unrecorded and is an
emergency. A catalogue that will not parse means this screen cannot list products, while the shop
carries on serving the copy compiled into the running build — no shopper sees anything wrong, and
nothing is being lost while it is fixed. An operator who read the database wording here would
treat a malformed JSON file as a revenue outage
(`lib/admin-product-pages.test.tsx`, *"does not describe it as a database outage or imply orders
are being lost"*).

## Alternatives considered

**Move the catalogue into Postgres and edit it there.** Rejected, and not narrowly. It is the one
row of [ADR-001](ADR-001-tech-stack.md) that still stands in full, and CLAUDE.md restates it as a
standing prohibition: an order row may record the price that was charged; it may never be the
source consulted to decide a price. This ADR is what makes that reversible *later* without being
a rewrite — the interface is in place and tested — but it does not spend the decision now.

**Let the panel write in production and warn the operator it might not stick.** Rejected as the
worst available option. Finding 1 is not a degradation, it is a silent no-op: the save reports
success, the file changes, and nothing else does. A warning next to a button that appears to work
is not informed consent, it is a footnote under a lie.

**Regenerate the storefront's data at runtime, or read the catalogue with `fs` in
`lib/products.ts` too, so production writes would work.** Rejected as out of scope and
architecturally larger than it looks: it would change how all 476 pages get their data, trade
build-time inlining for a per-request parse on the shopper's path, and reopen
[ADR-032](ADR-032-coolify-docker-deploy.md)'s standalone-output assumptions. It is the real fix if
in-production catalogue editing is ever wanted, and it is a prompt of its own. `lib/products.ts`
is untouched here.

**Validate the edited record alone, instead of the whole catalogue.** Rejected in decision 2: id
collisions, keyword collisions and the merchandising floors are all invisible from inside a single
record, and those are exactly the failures an operator would otherwise discover from a red build.

**Write a lighter form-shaped validator and let the gate be the backstop.** Rejected — this is the
failure this feature was most exposed to. The two would diverge on their first divergent edit, and
the panel would be the friendlier of the two, which is the wrong direction for the one that
accepts input.

**A file-level version token, or an advisory lock, or a mutex.** Rejected in finding 3: a
file-level token would report a conflict between two operators editing unrelated products, and a
lock would be a durable piece of machinery for a shop with one operator. The atomic rename
addresses the risk that is real (a torn file), and the per-record hash addresses the one that is
plausible (two tabs).

**A timestamp field on the record instead of a hash.** Rejected in decision 4: it would add a
field to all 449 records that only this feature reads, and `updatedAt` on a catalogue whose real
audit trail is the git history would be a second, weaker answer to a question `git log` already
answers.

**Per-tab save endpoints.** Rejected: three handlers sharing one door, three chances for a save to
land half-applied, and three places for the version check to be got wrong. One `PATCH` replaces
the editable fields of one record.

**Adding per-variant pricing to the schema so Tab 2 could offer it.** Rejected as far outside this
prompt: `SelectedOptions` reaching an amount would touch the order pricing core, `CatalogueEntry`,
the cart's line identity and every total the server computes — the sealed path
[ADR-040](ADR-040-postgres-for-orders.md) and [ADR-058](ADR-058-cod-eligibility-and-min-prepaid-amount.md)
have been careful with. The screen states the constraint instead.

## Consequences

- **The catalogue is now editable from a browser on a development machine, and refuses to pretend
  otherwise in production.** The panel is honest about which of the two it is on, in its own
  words, on the screen.
- **The publish path is unchanged and still runs through git.** An edit is a working-tree change;
  it reaches shoppers when somebody commits it and redeploys. This is
  [ADR-001](ADR-001-tech-stack.md)'s audit-trail property preserved, not worked around.
- **`ProductRepository` is the migration seam.** Moving the catalogue to Postgres is now a new
  class plus a `PrismaProductRepository`, with the pages, routes, forms and validation unchanged —
  and `lib/product-repository-boundary.test.ts` fails the moment somebody erodes that.
- **`scripts/product-record-rules.mjs` is now runtime code, not just tooling.** It is imported by
  `lib/product-validation.ts` and therefore type-checked by `next build` and shipped in the
  container. `.dockerignore` gained four negations for it and its transitive imports
  (`banned-meta-adjectives.mjs`, `min-prepaid-rule.mjs`, and `backfill-keyword-map.mjs` for the
  repository's map rebuild), because `.dockerignore` never applies on a real filesystem and the
  failure mode is a Docker-only *"Cannot find module '@/scripts/…'"* — the exact outage already
  logged in
  [2026-08-28-docker-build-cannot-find-module-scripts-keyword-normalisation.md](../logs/2026-08-28-docker-build-cannot-find-module-scripts-keyword-normalisation.md).
  **Any future rule module added under `scripts/` and imported from `lib/` needs the same
  negation.**
- **A gate advisory is now something an operator sees, and only some of them are.** Measured on
  the shipped catalogue: 9 products sit above the 60% discount house style
  ([ADR-027](ADR-027-product-schema-migration.md)) and 4 descriptions are outside the house word
  range ([ADR-035](ADR-035-catalogue-content-pass.md), the products still awaiting owner copy in
  `docs/CATALOGUE-DATA-TODO.md`) — thirteen records in all, and the panel shows an operator only
  the advisories naming the product they are editing. The gate's other three advisory lists are
  **catalogue-wide reports rather than per-record notes** and are deliberately not surfaced here:
  the 84 shared secondary keywords and 15 near-match pairs belong to the keyword map, and the 404
  products quoting an amount in their search copy are a re-check list for when a price moves, not
  a remark about the record in front of you.
- **`EXPECTED_PRODUCT_COUNT` is untouched and the panel cannot change it.** This feature edits
  records; it does not add or delete them. A product still arrives by the Draft A pipeline
  ([ADR-051](ADR-051-draft-a-content-pipeline.md),
  [ADR-053](ADR-053-draft-a-to-product-orchestration.md)) and `npm run publish:product`.
- **Revisit if** the owner asks to edit the catalogue on the live site. That is the real fix
  rejected above — `lib/products.ts` reading through the repository at request time — and it is a
  prompt of its own, with `next build`'s 476 static pages as the thing to re-decide rather than the
  panel.
- **Revisit if** a second operator is ever added. The per-record token is right for one; the
  advisory the panel does not yet give — *who* changed a record last — would start to matter, and
  the answer is probably `git blame` rather than a field on the record.
