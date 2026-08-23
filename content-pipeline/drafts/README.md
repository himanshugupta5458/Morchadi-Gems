# content-pipeline/drafts

Draft A objects awaiting or undergoing owner review. **This directory starts empty**, and this
file is the only thing in it that git tracks.

## Convention

| Property | Rule |
| --- | --- |
| Filename | `PNNN.json` — the object's own `productId`, so the file and the record cannot disagree |
| Contents | Exactly one Draft A object per file. The validator also accepts an array, labelling elements `file.json#N`, but one object per file is the convention here so a file can be moved on its own |
| Id assignment | Sequential, by pipeline code and never by the model, at the moment the draft is created. The next unused number is **P050** — `data/products.json` holds P001–P049 |
| Id reuse | Never. A rejected candidate's number dies with it and gaps in the sequence are correct — see [ADR-051 decision 4](../../docs/decisions/ADR-051-draft-a-content-pipeline.md) |

Every file here should have a row in
[`docs/pipeline-prep/drafts-in-progress.md`](../../docs/pipeline-prep/drafts-in-progress.md).
The row is added by hand; nothing generates it.

## What a file here has not yet been through

`attributes[].confirmed` is `false` on every attribute in this directory. A draft with
`confirmed: true` sitting here is a hard validation failure rather than a state — it claims a
review that has not happened.

## Check before review

```
node scripts/validate-draft-a.mjs content-pipeline/drafts
```
