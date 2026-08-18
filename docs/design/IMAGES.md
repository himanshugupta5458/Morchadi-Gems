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
├── products/     {id}.webp      — one per product, 100 files (P001–P021 real, 79 placeholder)
├── categories/   {slug}.webp    — one per category, 10 files
└── hero/         home-hero.webp — the home page hero panel, 1 file
```

| Asset | Path | Size | Fit |
| --- | --- | --- | --- |
| Product image | `/products/{id}.webp` | 1000 × 1000, square | `object-contain` on ivory |
| Category tile | `/categories/{slug}.webp` | 1200 × 1500, portrait | cropped by the tile |
| Home hero panel | `/hero/home-hero.webp` | 1600 × 1200, landscape | `object-cover`, 4:3 panel |

The path is **derived from the id**, never stored. `data/products.json` holds
`"images": ["/products/nk-001.webp"]` for `nk-001` and `validate:products` enforces that it
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
subject centred — tiles crop.

The home hero is `public/hero/home-hero.webp`, landscape. It renders in a 4:3 panel beside
the headline with `object-cover` and a soft ivory gradient over it, so a photo with a light,
uncluttered background will sit best. The hero's `alt` text is already descriptive, so
swapping the file needs no code change here either.

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
[ADR-020](../decisions/ADR-020-two-tier-catalogue-ia.md), which is also why their two tiles
already exist while their categories are still empty — the tile is keyed on the slug, not
on whether anything is filed under it. A category image is produced for every slug in the
constant, so the two placeholders shipped on the same never-overwrite rule as the other
eight: real photography dropped at either path survives every future run.

## Regenerating placeholders

```bash
npm run generate:placeholders
```

**It never overwrites.** A file that exists is skipped, always — there is no `--force`
flag, deliberately, because the thing at risk is photography that may exist nowhere else.

To redo a placeholder you no longer want, delete that one file and re-run:

```bash
rm public/products/nk-001.webp && npm run generate:placeholders
```

To redo all of them after changing the artwork in the generator, you would delete the
folders and regenerate. **That is no longer safe and the command is left here only so it is
recognisable when someone finds it in an old note:**

```bash
# DO NOT RUN — deletes P001.webp … P021.webp, the owner's only copies
rm -rf public/products public/categories && npm run generate:placeholders
```

Delete individual placeholder files instead, by name.

## What the placeholders look like

An ivory field with a per-category tint, the gold gem motif from `components/icons.tsx`, a
gold rule, an uppercase category eyebrow, and the product name. Each category has its own
tint so a mixed grid does not read as one repeated image.

The hero placeholder is the same visual language but **wordless** — a larger gem motif
between two gold rules with a small `FINE JEWELLERY` eyebrow. It carries no brand name,
because the headline immediately beside it already does.

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

`npm run validate:products` asserts, for every product in the catalogue — the owner's own
and any remaining placeholders alike:

- `images[0]` is exactly `/products/{id}.webp`
- that file exists on disk
- and that all 10 `public/categories/{slug}.webp` files exist

A path that is right in the JSON but missing on disk is a 404 on a live product card, so
both halves are checked. Failures name the file and point at
`npm run generate:placeholders`.
