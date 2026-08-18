# ADR-002: Product data model

- **Status:** Accepted — record shape superseded by [ADR-027](ADR-027-product-schema-migration.md)
- **Date:** 2026-08-17
- **Prompt:** 2

## Context

[ADR-001](ADR-001-tech-stack.md) established that there is no database and that
`data/products.json` is the sole authority on what a product is and what it costs. That
makes the shape of this file, and the discipline around reading it, load-bearing for the
whole application — including the checkout path, where the server must recompute every
total from this file rather than trust the client.

This prompt had to settle four things: the TypeScript contract for a product, how pages get
at the data, how images are represented before any real photography exists, and how product
identifiers are assigned.

## Decision

**`lib/products.ts` is the only path to product data.** It performs the single
`import catalogue from "@/data/products.json"` in the codebase and exports six typed
accessors: `getAllProducts`, `getProductById`, `getProductsByCategory`,
`getFeaturedProducts`, `getNewArrivals`, `getRelatedProducts`. Pages, components, and route
handlers never import the JSON.

**`images` is always an array**, even now when every product carries the same single
`/placeholder-product.jpg`. It is `string[]` from the first commit, not a `string` to be
widened later.

**IDs use a per-category prefix and a zero-padded three-digit sequence** — `nk-001`,
`er-013`, `np-012 `— with prefixes `nk`, `er`, `rg`, `br`, `bn`, `pd`, `ak`, `np`. Numbering
restarts within each category. An ID, once assigned, is never reused or renumbered.

**Category display labels live in one `CATEGORIES` constant** in `types/product.ts`, pairing
each slug with its label. UI reads labels from there; no component writes `"Nose Pins"` as a
string literal.

**Conformance is enforced at runtime by `scripts/validate-products.mjs`**, not by the type
system alone.

## Alternatives considered

**Letting pages import `products.json` directly.** Rejected. It is one line shorter and
gives up everything: with a direct import there is no single place to add caching, to swap
the JSON for a CMS or database later, or to guarantee that a filter is applied consistently.
More importantly, it makes the price-authority rule unenforceable by inspection — with a
single access module, "where do prices come from?" has one answer, and any future reviewer
can audit it by reading one file.

**Making `images` a `string` now and an array later.** Rejected. Product pages will need a
gallery, and the migration would touch every consumer at exactly the point where real
photography is being wired up. Committing to the array now costs one pair of brackets.

**Using a placeholder image service or an empty `[]`.** An empty array was allowed by the
brief but rejected: it forces every consumer to handle the empty case with a fallback that
becomes dead code the moment real images land, and it hides missing-image bugs behind a
branch that is always taken. A single concrete placeholder path means the render path
exercised today is the same one that runs in production.

**Sequential IDs across the whole catalogue (`p-001` … `p-100`).** Rejected. The prefix
makes an ID self-describing in logs, in Cashfree order payloads, and in a cart stored in
`localStorage` — `nk-006` is legible in a support conversation in a way `p-006` is not. It
also lets each category be extended independently without a global counter.

**Slug-based IDs (`kundan-rani-haar`).** Rejected as the primary key. A slug is derived from
a name, and names get corrected for typos and rewritten for merchandising; an ID that
changes when a name changes breaks carts already sitting in customers' browsers and orders
already recorded at Cashfree. Slugs may still be added later as a URL concern, resolving to
a stable ID.

**Deriving category labels with a `replace("-", " ")` and title-casing helper.** Rejected.
It produces "Nose Pins" correctly and would produce nonsense for any future slug that is not
a simple two-word phrase. An explicit table is shorter than the helper and never wrong.

**Trusting `resolveJsonModule` typing instead of a runtime validator.** Rejected as
insufficient. TypeScript infers `category: string` and `rating: number` from the JSON
literal, so the `as Product[]` assertion in `lib/products.ts` is a claim the compiler cannot
check — a typo of `"neckalces"` or a rating of `7.4` would typecheck cleanly. The validator
closes that gap.

## Consequences

**Made easy.** Swapping the JSON for another source later means rewriting one module.
Adding a category is a two-line change in `types/product.ts` plus products. Every consumer
gets a `Product`, fully typed, without knowing where it came from. Because IDs are stable
and self-describing, carts and payment records stay readable across catalogue edits.

**Made hard.** The `as Product[]` assertion in `lib/products.ts` is the one place the type
system is being taken on trust, so `npm run validate:products` is not optional — it is the
check that makes the assertion true. It must run before any deploy, and any change to the
`Product` interface must be mirrored in the validator in the same commit or the two drift
apart silently. Also, because the whole catalogue is imported eagerly, every consumer pulls
in all 100 products; this is irrelevant at this size and would need revisiting well before
the catalogue reaches thousands of entries.

**Authoring note.** The 100 seed products were produced by a curated generator run once
from a scratch directory, then discarded. The generator is deliberately **not** kept in the
repository: keeping it would create a second, competing source of truth and invite someone
to regenerate the file and silently overwrite hand edits. `data/products.json` is the
artifact; it is edited directly from here on, and `scripts/validate-products.mjs` — which
*is* kept — is what guards those edits.

**What would force a revisit.** The merchant needing per-product variants (size, metal,
stone colour) would change the `Product` shape materially and deserves its own ADR, as would
real inventory counts replacing the boolean `inStock`.
