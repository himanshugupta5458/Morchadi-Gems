# Products completed

The manual register of Draft A objects whose product has been published into
`data/products.json`. A row arrives here when its row leaves
[`drafts-in-progress.md`](drafts-in-progress.md); the two files should never hold the same id at
the same time.

**Nothing generates or reads this file.** Like its counterpart it is a human index over an
untracked directory — here, `content-pipeline/completed/`.

`Published Date` is the date the commit that added the product to `data/products.json` landed,
not the date the draft was finished. A product becomes real in a commit
([ADR-001](../decisions/ADR-001-tech-stack.md)), so that is the date worth recording.

`Final Name` is the product's `name` as it stands in `data/products.json`, which is often not
the reference title the draft started from — review renames things. The draft in
`content-pipeline/completed/PNNN.json` keeps the original under `sourceNotes.rawContent`.

## Register

| Product ID | Final Name | Category | Published Date |
| --- | --- | --- | --- |
| P106 | Pear-Petal CZ Flower Ring | rings | 2026-08-24 |
| P108 | Butterfly Wing Bypass Ring | rings | 2026-08-24 |
| P109 | Oval CZ Swirl Cocktail Ring | rings | 2026-08-24 |
| P110 | Lattice Criss-Cross CZ Ring | rings | 2026-08-24 |
| P115 | Beaded-Edge CZ Band Ring | rings | 2026-08-24 |
| P117 | Interlaced Crossover CZ Ring | rings | 2026-08-24 |
| P118 | Open Heart and Teardrop CZ Ring | rings | 2026-08-24 |
| P119 | Rose Gold-Plated Oval Halo Ring | rings | 2026-08-24 |
| P120 | Blooming Five-Petal CZ Ring | rings | 2026-08-24 |
| P121 | Pink-Wing Butterfly CZ Ring | rings | 2026-08-24 |
| P122 | Rose Gold-Plated CZ Solitaire Ring | rings | 2026-08-24 |
