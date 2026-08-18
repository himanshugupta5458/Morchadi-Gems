# Images

Where images live, how to put real photography in, and how to generate placeholders for new
products. The reasoning behind all of it is in
[ADR-006](../decisions/ADR-006-product-image-convention.md).

## Which files are real photography

`public/products/P001.webp` … `P021.webp` are **the owner's own product photographs**, not
generated placeholders. They exist nowhere else in this repository and are not reproducible
by any script here. The other 79 files are generated placeholders.

Nothing in the tooling can tell them apart. `generate:placeholders` never overwrites an
existing file, which is what protects them — but the `rm -rf public/products` recipe further
down this page would delete them, so **do not run it**. It was written when every file in
that folder was regenerable, and it no longer is.

The 21 products they belong to are the owner's real catalogue, imported in prompt 15; the
id-is-the-P-code decision is in
[ADR-016](../decisions/ADR-016-real-product-import.md).

## Where images live

Everything is a local static file under `/public`. There is no CDN, no image host, and no
`remotePatterns` entry in `next.config.mjs` — if you find yourself adding one, something has
gone off the convention.

```
public/
├── logo.png                     — the brand logo, 642 x 388 RGBA, the owner's artwork
├── products/     {id}.webp      — one per product, 49 files (P001–P049, all real photography)
├── categories/   {slug}.webp    — one per category, 10 files
├── hero/         home-hero.webp — the home page hero panel, 1 file
└── og/           default.png    — the 1200 x 630 social share card, derived from the logo

app/
├── icon.png                     — 512 x 512 favicon, derived from the logo
├── apple-icon.png               — 180 x 180 touch icon, derived from the logo
└── favicon.ico                  — 16/32/48, derived from the logo
```

| Asset | Path | Size | Fit |
| --- | --- | --- | --- |
| Product image | `/products/{id}.webp` | 1000 × 1000, square | `object-contain` on ivory |
| Category tile | `/categories/{slug}.webp` | 572 × 1024, portrait | `object-cover` in a 4:5 tile |
| Home hero | `/hero/home-hero.webp` | 1024 × 572, landscape | `object-cover`, the hero's ground |

The path is **derived from the id**, never stored. `data/products.json` holds
`"images": ["/products/P022.webp"]` for `P022` and `validate:products` enforces that it
matches exactly. You do not choose an image path; the id chooses it.

## Replacing a placeholder with a real photo

This is a file drop. There is no code change, no data change, and nothing to rebuild.

1. Export the photo as **WebP**, square, 1000 × 1000 or larger.
2. Save it over the existing file at `public/products/{id}.webp` — same name, same folder.
3. `npm run validate:products` to confirm nothing is missing.
4. Commit and deploy.

The generator will not touch it afterwards. It only ever writes where no file exists, so
re-running it later reports the file as skipped and leaves it alone.

Category tiles work the same way at `public/categories/{slug}.webp`, portrait. Keep the
subject centred — tiles crop to 4:5, trimming top and bottom. The label sits at the bottom
edge under a `charcoal/90 → transparent` scrim confined to the tile's lower half, so a
photo whose subject drifts into that band will fight it.

The home hero is `public/hero/home-hero.webp`, landscape, and it is the hero **section's
ground** rather than a panel inside it (ADR-023). Compose it with the **left third empty** —
the headline, lede and CTAs sit in that gap from `lg` up, under a left-to-right ivory scrim.
Below `lg` the image drops beneath the copy in a 16:10 frame cropped `object-right`, so keep
anything essential out of the far left. A light, uncluttered ground sits best. The hero's
`alt` text is descriptive, so swapping the file needs no code change here either.

**The filename must match the product id exactly, and the extension must be `.webp`.** A
photo saved as `nk-001.jpg` will not be found; `validate:products` fails with the path it
expected. Convert first:

```bash
npx sharp-cli --input photo.jpg --output public/products/nk-001.webp
```

## Adding a new product

```bash
# 1. append the product row to data/products.json
npm run generate:placeholders   # writes only the new id, skips the other 100
npm run validate:products       # confirms the path and the file on disk
```

The generator needs the product's `category` to pick a tint, so a new category slug must be
added to `CATEGORIES` in `scripts/generate-placeholders.mjs` as well as to
`types/product.ts`. It exits 1 and names the slug if you forget.

`watches` (`#E6E4DE`) and `hair-accessories` (`#EFE4EA`) were added this way in
[ADR-020](../decisions/ADR-020-two-tier-catalogue-ia.md), a prompt before either category
held a product — the tile is keyed on the slug, not on whether anything is filed under it. A category image is produced for every slug in the
constant, so the two placeholders shipped on the same never-overwrite rule as the other
eight: real photography dropped at either path survives every future run.

## Regenerating placeholders

```bash
npm run generate:placeholders
```

**It never overwrites.** A file that exists is skipped, always — there is no `--force`
flag, deliberately, because the thing at risk is photography that may exist nowhere else.

No product in the catalogue is served by a generated placeholder any more — every one of
the 49 resolves to the owner's own photograph ([ADR-021](../decisions/ADR-021-all-real-catalogue.md)).
The generator earns its place on the next product added: give the new row a P-code, and it
writes a placeholder at that path until the photograph arrives.

To redo a generated image you no longer want, delete that one file and re-run:

```bash
rm public/products/P050.webp && npm run generate:placeholders
```

To redo all of them after changing the artwork in the generator, you would delete the
folders and regenerate. **That is no longer safe and the command is left here only so it is
recognisable when someone finds it in an old note:**

```bash
# DO NOT RUN — deletes P001.webp … P049.webp, the owner's only copies
rm -rf public/products public/categories && npm run generate:placeholders
```

Delete individual placeholder files instead, by name.

## What the placeholders look like

An ivory field with a per-category tint, the gold gem motif from `components/icons.tsx`, a
gold rule, an uppercase category eyebrow, and the product name. Each category has its own
tint so a mixed grid does not read as one repeated image.

The hero placeholder is the same visual language but **genuinely wordless** — a larger gem
motif between two gold rules, no text at all. It carried a `FINE JEWELLERY` eyebrow until
ADR-023; that is a precious-metal term this catalogue cannot use (ADR-018), and it hid from
the ADR-018 sweep by being drawn into an image rather than rendered as text.

Two things about them are load-bearing rather than decorative:

- **They say nothing about being placeholders.** They exist to make the storefront look
  finished. `ProductCard`'s separate "Image coming soon" fallback is for an empty `images[]`
  — a data error — not for a photo that has not arrived yet.
- **The tint fades outward to ivory.** `ProductCard` insets the image inside an ivory area,
  so a field tinted all the way to its edges would draw a visible rectangle there, which is
  the inner frame design QA removed in prompt 4.

Brand fonts are not embedded. `sharp` rasterizes with DejaVu Serif / DejaVu Sans, a close
enough serif/sans pairing for artwork that is meant to be replaced. Placeholder text does
not need to be Fraunces.

## How images are served

`ProductCard` uses `next/image` with `fill`, `object-contain`, and `p-4` on an `ivory` image
area, so a photo on any background sits correctly without being cropped. Next.js optimizes
and serves modern formats from `/_next/image` — the committed `.webp` is the source, not
what the browser necessarily receives.

`sharp` is a **devDependency** and never runs on Vercel. Placeholder generation is a local
authoring step; production only serves committed files.

## What validation checks

## Brand assets

`public/logo.png` is the source. Everything else with the mark on it is generated from it:

```bash
npm run generate:brand-assets
```

| Output | Size | Ground | Contents |
| --- | --- | --- | --- |
| `app/icon.png` | 512 × 512 | transparent | the peacock feather's eye |
| `app/apple-icon.png` | 180 × 180 | ivory | the same crop — iOS composites on its own ground, so transparency is not safe |
| `app/favicon.ico` | 16, 32, 48 | transparent | the same crop, packed as a multi-size ICO |
| `public/og/default.png` | 1200 × 630 | ivory | the full logo, a gold rule, and the product descriptor |

The icons use a **150 × 140 crop at (240, 60)** rather than the whole logo: the full lockup
is 1.65:1 wide and reduces to a smear at 32px, and the crop's bottom edge stops at y=200
because below that it starts catching an ascender from the script. The numbers live in
`FEATHER_CROP` in the script.

**Unlike `generate:placeholders`, this script overwrites.** That is the point — every output
is derived from `logo.png` with no hand-editing in between, so a stale copy is a bug rather
than something to protect. Replace the logo, re-run, and the whole set follows. The
reasoning is in [ADR-022](../decisions/ADR-022-logo-integration.md).

Do not put the logo on a dark ground. Its script measures 1.65:1 against `charcoal`; the
footer uses the type lockup instead, via `<Wordmark variant="text" />`.

## Orphaned placeholder images

`public/products` holds 149 files: the 49 real photographs the catalogue references, and
**100 orphaned placeholders** (`nk-001.webp`, `er-004.webp` and so on) left behind when
[ADR-021](../decisions/ADR-021-all-real-catalogue.md) deleted the invented products. They
are unreferenced — no product, no route and no component resolves to any of them — and they
add about 1.2 MB to the deployed bundle.

They are safe to delete, and deliberately were not deleted in that prompt. Anything matching
`^P\d{3}\.webp$` is the owner's own photography and is **irreplaceable** — the delete has
to be by pattern, never by wiping the directory:

```bash
# safe: removes only the orphans, keeps every P-code file
cd public/products && ls | grep -vE '^P[0-9]{3}\.webp$' | xargs rm --
```

`npm run validate:products` will not catch a mistake here in the direction that matters: it
checks that every *referenced* image exists, not that every file is referenced. Deleting a
P-code file fails the gate loudly; leaving an orphan in place fails nothing.

## What the validator checks

`npm run validate:products` asserts, for every product in the catalogue:

- `images[0]` is exactly `/products/{id}.webp`
- that file exists on disk
- and that all 10 `public/categories/{slug}.webp` files exist
- that every `id` is a P-code, so no invented product can rejoin the catalogue

A path that is right in the JSON but missing on disk is a 404 on a live product card, so
both halves are checked. Failures name the file and point at
`npm run generate:placeholders`.
