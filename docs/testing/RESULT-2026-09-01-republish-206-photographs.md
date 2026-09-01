# RESULT 2026-09-01 — the 206 placeholders replaced by their own photographs

The repair pass [ADR-074](../decisions/ADR-074-publish-stages-its-own-photographs.md) deferred.
The mechanism shipped in prompt 118 and left the gate red on purpose; this run made it green by
publishing the photographs, and changed nothing else. `data/products.json` was not touched and
`generate:placeholders` was not run.

## The list was derived, not carried over

The 206 ids came out of `npm run validate:products` in this session — parsed from the
`stage:images`-recommended line of each failure — rather than from the earlier audit or from the
review report. The count was checked before anything was written:

```
exit=1
unique ids: 206
```

The set is byte-for-byte the same as the set of files the commit touches, confirmed by `diff`
after staging: **IDENTICAL SETS**.

## The copy

```
npm run stage:images -- <206 ids> --force

Copied              267
Overwritten         206
Skipped, identical  0
Skipped, differs    0
Confirmed, unstaged 0
UNRESOLVED          0

OK.
```

Every overwrite printed both sides. A representative one:

```
  P628  OVERWROTE   /products/P628.webp
        before  11654 B, 1000x1000
        after   128504 B, 1000x1000  (from 2026-08-23-batch-01/P628/raw/main.webp)
```

### The 267 extra copies, and why they are not in the commit

`stage:images` stages **every** confirmed image in a record, not only the primary, which is
correct and is what ADR-074 decided. 267 of the copies were secondary photographs —
`/products/PNNN-2.webp`, `-3.webp`, `PNNN-{variant}.webp`. **Not one of them is referenced by
`data/products.json`**: 436 of the 449 catalogue records carry exactly one entry in
`media.images`, and nothing resolves a `-N` suffix at runtime — `lib/variant-images.ts` reads an
explicit `media.variantImages` mapping and returns `null` when a selection is unmapped.

So the 267 files are inert, and they are a second, separate defect of the same family as the one
ADR-074 closed. P629 is the clean example: its completed draft confirms three general images
with three distinct paths, `mapImagesToMedia` (`lib/draft-a-to-product.ts:425`) pushes every
confirmed path into `general`, and yet `data/products.json` records
`{"images":["/products/P629.webp"]}` alone. The photographs are confirmed, the mapper would
carry them, and the catalogue does not have them.

Repairing that means editing `data/products.json`, which is a catalogue change with its own
review, so it is **not** in this commit. The 267 files were left untracked in the working tree
rather than committed or deleted: every one has a tracked source under
`content-pipeline/completed/{id}/raw/`, so `npm run stage:images` reproduces them in one
command, and untracked files never reach a Coolify build, which deploys from git.

## Gate

Run stage by stage.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | ✔ No ESLint warnings or errors |
| `npm run validate:products` | **PASS — all checks green**, exit 0 |
| `npm run build` | exit 0, 449 product pages prerendered |
| `npm run test:run` | 129 files, 2545 passed, exit 0 |

The photograph check, which reported 206 before and 0 after:

```
Published photographs against the pipeline's own confirmed source
  verified identical 400
  no staged photo    49 (hand-made, nothing claims one)
  differ, not flat   0
  source missing     0
  PLACEHOLDER SHOWN  0
```

400 + 49 = 449. Every migrated product is now byte-identical to the photograph its own record
stages, which is also the state in which the check stops decoding anything: the runtime the ADR
predicted would fall away has fallen away.

## Sixteen pages rendered and looked at

Not a file-existence check. Each page was loaded in headless chromium against `npm run dev`, the
rendered `<img>` measured, and the gallery frame screenshotted and inspected.

| Product | Published source | Shape | What is actually on screen |
| --- | --- | --- | --- |
| P103 | 2890x2890 | square | Gold screw-motif bangle on cream fabric with greenery |
| P105 | 1080x1080 | square | Two cubic-zirconia rings on a black pad, cream satin |
| P127 | 1080x1080 | square | Heart ring on a black pad against cream satin |
| P246 | 1080x1080 | square | Four enamel bangles stacked, **numbered 1–4 in the photo** |
| P298 | 1080x1350 | portrait | Hand holding a MORCHADI JEWELS card; **pendant carries an interlocking double-C mark** |
| P301 | 1080x1080 | square | Charm bracelet on a **KIYU ZIYU®** card beside a red rose |
| P408 | 800x800 | square | Silver initial "A" ring in a wooden presentation box |
| P426 | 1083x1919 | portrait | Hand holding a MORCHADI JEWELS card, domain legible, bow pendant |
| P435 | 1920x1920 | square | Hand holding a MORCHADI JEWELS card, heart pendant |
| P474 | 1083x1919 | portrait | Hand holding a card reading only "Fashion", tennis bracelet |
| P499 | 1535x1920 | portrait | Pink glass bangles with ghungroo charms worn on a wrist |
| P532 | 1080x1350 | portrait | Open hamper box — **"pinteresty BIRTHDAY HAMPER" banner, KitKat and Dairy Milk Silk packaging, printed callout labels** |
| P549 | 1920x1920 | square | Wheat-chain bracelet flat-lay on a MORCHADI JEWELS card |
| P587 | 768x1376 | portrait | White satin long-tail bow clip against pampas grass |
| P611 | 1080x1920 | portrait | Hand holding a green-dial watch |
| P634 | 896x1195 | portrait | Model wearing a pavé heart pendant |

All sixteen returned HTTP 200 and every one is a genuine photograph. The eight known content
concerns above are exactly the ones the pre-publish review report flagged; the owner approved
publishing all 206 with a product-by-product review to follow.

### Layout under non-square sources

The frame is a fixed square and the image is `object-fit: contain`, as
[IMAGES.md](../design/IMAGES.md) documents. Measured on every one of the sixteen: the rendered
box is `566x566` inside a `568x568` parent, `objectFit: "contain"`, `complete: true`. A portrait
source such as P426 (`640x1134` after the Next.js optimiser) letterboxes inside that square —
nothing crops, nothing stretches, nothing pushes the column.

Horizontal overflow was checked directly rather than by eye, at 1280px and at 390px, by counting
elements whose bounding rect extends past `clientWidth`:

```
desktop P426 {"docW":1280,"clientW":1280} ok
desktop P499 {"docW":1280,"clientW":1280} ok
desktop P103 {"docW":1280,"clientW":1280} ok
mobile  P426 {"docW":390,"clientW":390} ok
mobile  P499 {"docW":390,"clientW":390} ok
mobile  P103 {"docW":390,"clientW":390} ok

P499 {"count":0,"sample":[]}
P001 {"count":0,"sample":[]}
P010 {"count":0,"sample":[]}
```

Zero on every page, including the two untouched controls.

## Diff

206 files changed, all `public/products/PNNN.webp`, all modifications, none added or removed,
nothing staged outside `public/products/` and no tracked file left unstaged.
