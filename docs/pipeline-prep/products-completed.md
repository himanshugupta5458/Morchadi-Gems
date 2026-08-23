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
| _(none yet — no Draft A object has ever been created in this repository)_ | | | |
