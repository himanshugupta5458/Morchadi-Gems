# ADR-006: Product image convention and placeholder strategy

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 5

## Context

The storefront has 100 products and no photography. Pages need to render populated and
real-looking now, and the owner will supply real photos later — piecemeal, over time, with
no admin panel and no upload flow ([ADR-001](ADR-001-tech-stack.md)).

Before this prompt every product in `data/products.json` pointed at the same file,
`/placeholder-product.png`. That renders, but it makes the catalogue look like one product
photographed a hundred times, and it means dropping in a real photo requires editing
`data/products.json` for every product — a hundred hand edits with a hundred chances to
typo a path.

The question is not "what do the placeholders look like". It is: **what has to change when
a real photo arrives?** Anything more than "put the file here" is a design failure, because
the person doing it is the shop owner, not an engineer.

## Decision

**1. Image paths are derived from the id, not stored as data.**

| Asset | Path |
| --- | --- |
| Product primary image | `/products/{id}.webp` |
| Category tile | `/categories/{slug}.webp` |

`nk-001` → `/products/nk-001.webp`. All 100 products were repointed. `images` stays a
`string[]` — additional gallery shots will be appended later ([ADR-002](ADR-002-product-data-model.md))
— but index 0 is now conventional rather than free-form.

**Replacing a placeholder with real photography is a file drop. No code change, no data
change, no rebuild of the catalogue.** Save the photo as `public/products/nk-001.webp`,
overwrite, deploy. That is the whole procedure, and it is the point of the convention.

**2. The generator never overwrites.**

`scripts/generate-placeholders.mjs` (`npm run generate:placeholders`) writes a placeholder
only where no file exists at the target path. A file that is already there is skipped, always
— there is no `--force`, no `--clean`, no flag that would let a mistyped command destroy
photography the owner has added. Re-running it after adding a hundred real photos writes
nothing and reports 100 skipped.

This makes the script safe to run on every new product: add the row to
`data/products.json`, run the generator, and only the new id gets a placeholder.

**3. The generated webp files are committed.**

`sharp` stays a devDependency and never runs on Vercel. The build serves committed static
files out of `/public`. Generation is a local authoring step, like writing the catalogue.

Committing ~1.3 MB of generated output is the cost. It buys: identical images in every
environment, no build-time image toolchain on Vercel, no risk of a `sharp` native-binary
failure breaking a production deploy, and — the real reason — **one storage location for
both placeholder and real images.** If placeholders were generated at build time they would
have to live somewhere generation-shaped, and the real photo would have to live somewhere
else, and something would have to choose between them at request time. Committing collapses
that into one path with one file at it.

**4. Placeholders are on-brand, not diagnostic.**

Each is an ivory field with a per-category tint, the gold gem motif from `icons.tsx`, a gold
rule, an uppercase category eyebrow, and the product name — products at 1000×1000, category
tiles at 1200×1500 with content held in the central band so a tile crop cannot cut it.

Two deliberate choices:

- **No "image coming soon" text.** These are meant to make the storefront look finished, and
  a hundred cards announcing their own incompleteness does the opposite. `ProductCard` still
  has a separate in-component fallback that *does* say "Image coming soon", but that is for
  an empty `images[]`, which is a data error rather than a pending photo.
- **The tint is strongest at the centre and falls off to ivory at the edges.** `ProductCard`
  insets the image inside an ivory area, so a field tinted to its edges would draw a visible
  rectangle there — reintroducing exactly the inner frame that prompt 4's design QA removed.

Brand fonts are not embedded. The rasterizer uses DejaVu Serif / DejaVu Sans, which read as
a clean serif/sans pairing close enough to Fraunces/Jost for artwork that is meant to be
thrown away. Wiring Fraunces into `sharp` would be real work in service of a temporary asset.

**5. Validation covers the file system, not just the JSON.**

`scripts/validate-products.mjs` now asserts that every product's `images[0]` is exactly
`/products/{id}.webp` **and that the file exists on disk**, plus that all 8 category files
exist. A path that is correct in the data but missing on disk is a 404 on a product card,
and the JSON alone cannot catch it.

## Alternatives considered

**Keep the path in the data and let it be anything.** Maximum flexibility, and the reason
the catalogue previously had a hundred copies of one string. Rejected: a free-form path is a
field that can be wrong, and there is no admin UI that would ever validate it. Deriving the
path from the id makes a whole class of mistake unrepresentable.

**Generate placeholders at build time on Vercel and gitignore the output.** Keeps the repo
small. Rejected on the storage-location argument in (3), plus it puts a native image binary
on the critical path of every production deploy to produce artwork that will be deleted.

**An external placeholder service** (`placehold.co`, Unsplash Source). Rejected: a
third-party request per card, `next.config` `remotePatterns`, no offline dev, no brand
control, and images that vanish when someone else's service does. Everything here is local
under `/public`, so no `remotePatterns` entry is needed at all.

**A single shared placeholder per category** (8 files instead of 108). Much less to commit.
Rejected: a grid then shows the same image eight times over, which is the problem this
prompt exists to fix. Per-product placeholders carry the product name, so a grid reads as a
catalogue.

**Overwrite-by-default generation with a `--no-clobber` opt-in.** Rejected outright. The
destructive behaviour must not be the default when the thing at risk is photography that may
exist nowhere else.

## Consequences

Adding a product is: append to `data/products.json`, run `npm run generate:placeholders`,
run `npm run validate:products`. The image path is implied by the id and never typed.

Handing real photography over needs no engineer — the procedure is documented in
[`docs/design/IMAGES.md`](../design/IMAGES.md) as a file drop.

`public/placeholder-product.png` was deleted. Every reference to it is gone, so ADR-004's
note about creating it now describes a superseded state; the file it created has been
replaced by the per-id convention rather than removed for being wrong.

`.webp` is fixed by the convention. An owner supplying `.jpg` must convert first, and
`validate:products` fails loudly if they do not. This is a deliberate trade — one format
means the path is fully derivable, where "any of jpg/png/webp" would need a lookup.

Gallery images (`images[1..n]`) have no convention yet. When a product page needs multiple
shots, this ADR should be extended with a `/products/{id}-2.webp` rule rather than letting
those paths become free-form.

What would force a revisit: real photography arriving in volume large enough that the repo
size becomes a problem. At that point the answer is a CDN or Vercel Blob with a URL derived
from the id — the derivation rule survives, only the prefix changes.
