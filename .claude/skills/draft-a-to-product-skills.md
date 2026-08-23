---
name: morchadi-draft-a-to-product
description: Turn one fully-confirmed Draft A object into a real data/products.json entry for Morchadi Gems. Runs the publish-readiness check, generates the product name and description with morchadi-product-copy, generates SEO metadata with morchadi-product-meta, checks the primary keyword against the site-wide keyword map, records an advisory content-similarity score, maps the draft's attributes and images into the real product schema, and writes the entry as status "draft". Use after owner review, pricing and image assignment are all finished. Never use to create or edit a Draft A object.
---

# Morchadi Gems — Draft A to Product (Phase 2 orchestration)

## Purpose

One Draft A object in, one `data/products.json` entry out. This skill is the **orchestration**
step: it decides nothing about materials, prices, or what a piece is, because all of those were
decided in owner review before it runs. What it does is run the gates in order, call the two
copy skills, map the draft's shape onto the catalogue's shape, and write the record as
`status: "draft"` so a human still has to switch it on.

It is Phase 2 of the pipeline in
[ADR-051](../../docs/decisions/ADR-051-draft-a-content-pipeline.md), designed in
[ADR-053](../../docs/decisions/ADR-053-draft-a-to-product-orchestration.md).

**What this skill never does.** It never writes a Draft A object, never edits one to make it
pass a gate, never confirms an attribute, never sets a price, never assigns an image, and never
sets `status: "active"`. Each of those is somebody's decision, taken elsewhere. If a gate fails,
the skill stops and reports; it does not route around the failure.

## Input

One Draft A object, in the schema `draft-a-skills.md` defines, read from
`content-pipeline/drafts/{productId}.json`. It must already be at the `priced-and-shot` stage of
`docs/pipeline-prep/drafts-in-progress.md`: every attribute confirmed, a real price, at least
one image.

## The run, in order

Each step is a gate. A gate that fails stops the run — the next step does not start, and no file
is written. Report which gate failed, quote its message, and stop.

### Step 1 — Publish readiness (hard gate)

```
node -e "import('./scripts/validate-draft-a.mjs').then(async (m) => {
  const draft = JSON.parse(require('node:fs').readFileSync('content-pipeline/drafts/PNNN.json','utf8'));
  const result = m.validatePublishReadiness(draft, { label: 'PNNN' });
  for (const e of result.errors) console.error(m.formatFinding(e, 'error', result.productId));
  process.exit(result.errors.length === 0 ? 0 : 1);
})"
```

`validatePublishReadiness` from `scripts/validate-draft-a.mjs` asks whether owner review actually
happened: every `attributes[].confirmed` is `true`, `category` is one of the ten slugs,
`personalized` is resolved to a boolean, `images.general` holds at least one entry, and
`pricing.price` is a positive number.

**Refuse to proceed on any error.** Do not confirm an attribute, resolve a `personalized: null`,
or invent a price to get past it. Report the findings verbatim and stop — the fix is a human
editing the draft, then running this skill again.

Also run `validateDraftA` from the same module. It is the pre-review check and most of it still
holds after review: the source pairing and the quoted-phrase containment are worth re-running,
because a review that edited a `value` without touching its `source.quotedPhrase` has broken the
provenance the record's honesty rests on. Three of its rules invert after review — `confirmed`,
`pricing.price` and `images.general` — so those three failures are expected here and are the only
ones to disregard.

### Step 2 — Product name and description

Follow [`product-skills.md`](product-skills.md) as written. Nothing in this skill overrides it.
The source of truth for that skill is normally a `data/products.json` record; here it is the
Draft A object, and the substitution is exact:

| `product-skills.md` reads | Read instead |
| --- | --- |
| `specs` | the draft's confirmed `attributes` — each entry's `label` and `value` |
| `category` | the draft's `category` |
| `options` | the draft's `variants` |
| the existing description | the draft's `sourceNotes.rawContent` and `referenceTitle`, as *raw material only* |
| price, for matching language to price | the draft's `pricing.price` |

Three of that skill's rules bite harder here than they do on a rewrite, and they are the reason
Phase 2 exists at all rather than the copy being written straight off the source text:

- **Describe only what is real, from the confirmed attributes.** A phrase in
  `sourceNotes.rawContent` that no attribute claims is not a fact — the old site's copy is the
  input the pipeline exists to distrust. A `displayTerm` is a trade name, never a material claim:
  the copy may say `cubic zirconia`, and may say `sometimes sold as American Diamond` beside it,
  and may never say `American Diamond` alone.
- **Batch discipline.** The ledger `product-skills.md` requires is not just the drafts in this
  batch. Read the descriptions already in `data/products.json` before writing, and deliberately
  differ from them in hook type and sentence shape. Step 4 measures whether that worked.
- **The missing-data protocol still applies.** If a buyer-critical fact is missing, append the
  `[Merchandiser note: ...]` line and report it. Do not fill the gap from the source text.

**The product name.** `product-skills.md` covers copy but not the record's `name`. Write it from
the confirmed attributes, in the catalogue's existing style: what the piece is, with the
distinguishing feature first, no brand name, no price, Title Case, and honest — a name may not
say `ruby` where the confirmed stone is coloured cubic zirconia. `sourceNotes.referenceTitle` is
a starting point and often a misleading one; review renames things, and this is where the rename
lands.

### Step 3 — SEO metadata, and the keyword collision gate

Follow [`meta-skills.md`](meta-skills.md) as written, reading the description from step 2 and the
specs mapped in step 5. All character counts must be **measured**, per that skill's rule 7.

Its collision rule says the check runs against the ledger rather than memory. The ledger is now a
file — `data/keyword-map.json`, derived from `data/products.json` by
`scripts/backfill-keyword-map.mjs` — and the check is code:

```ts
import catalogue from "@/data/products.json";
import { getKeywordMap } from "@/lib/keyword-collision-check";
import { checkCandidatePrimaryKeyword } from "@/lib/draft-a-to-product";

const result = checkCandidatePrimaryKeyword(candidate, getKeywordMap(), catalogue, productId);
```

| Outcome | What it means | What to do |
| --- | --- | --- |
| `result.published.hard` non-empty | A **published** product already owns this primary keyword | **Refuse.** Differentiate by the distinguishing option — colour, motif, size — in both the keyword and the metaTitle, then re-check |
| `result.pendingDrafts.hard` non-empty | An **unpublished** record in `data/products.json` already claims it | **Refuse**, the same way. The committed map excludes drafts by design, so this collision would otherwise stay invisible until publish |
| `result.published.advisory` / `result.pendingDrafts.advisory` non-empty | A secondary-term overlap, or the same words in a different order | **Report and proceed.** Two rings genuinely are both adjustable |

`metaTitle` uniqueness has no map of its own. Check it by reading the `seo.metaTitle` of every
record in `data/products.json`, drafts included.

The keyword map itself is **derived and never hand-edited** — `validate-products.mjs` rebuilds it
from the catalogue on every gate run and fails the build if the committed file differs. See
[Output, step 3](#3-datakeyword-mapjson) for when it is regenerated and why that is not now.

### Step 4 — Similarity, advisory only

Score the new description against **every product in the catalogue, published or not**, plus any
sibling draft written earlier in this same session that has not been saved yet, and write the
result to `content-pipeline/drafts/{productId}-similarity.json`:

```ts
import catalogue from "@/data/products.json";
import {
  SIMILARITY_THRESHOLD,
  evaluateSimilarityGate,
  selectSimilarityComparisonPopulation,
} from "@/lib/content-similarity";

const report = evaluateSimilarityGate(
  { id: productId, category, description, specs, options },
  selectSimilarityComparisonPopulation(catalogue, sessionDrafts),
  SIMILARITY_THRESHOLD,
);
```

`sessionDrafts` is a `SimilarityInput[]` of the drafts this run has already written — omit it and
the population is just the catalogue. **Do not call `selectActiveSimilarityInputs` here.** It
returns the published half only, and a migrated batch is written entirely as `status: "draft"`,
so an active-only population scores each candidate against the original catalogue and never
against its own batch — which is the population most likely to be templated. See
[ADR-056](../../docs/decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md).

Every comparison records `againstPopulation`, so the stored file says whether a score was
measured against live copy or against a sibling draft.

The report carries all three of the engine's measures — raw, normalised and opening-sentence —
for every comparison, plus the peak of the three and which measure produced it.

**`SIMILARITY_THRESHOLD` is `null` as shipped, and while it is null nothing is ever refused.**
Compute the scores, write the file, name the highest-scoring pair in the run report, and
continue. A high score is a prompt to look, not a verdict: read the two descriptions and decide
whether they genuinely read as one template.

The blocking path is implemented and tested. When a future calibration sets a real number,
`report.blocked` starts coming back `true` for a peak strictly above it, and this step becomes a
hard gate with no further change to this skill. Choosing that number is a separate decision and
is explicitly not this skill's to make — the reasoning is in
[ADR-053](../../docs/decisions/ADR-053-draft-a-to-product-orchestration.md#the-threshold-is-null-and-a-number-requires-a-calibration-run-that-has-not-happened).

Always write the file, even on an advisory run. Its whole value is being the record a future
calibration reads.

### Step 5 — Map the draft onto the product schema

`lib/draft-a-to-product.ts` performs the mapping. Call it rather than assembling the record by
hand — the rules below are what it implements, stated here so a reviewer can check the output
without reading the module.

```ts
import { buildProductFromDraft } from "@/lib/draft-a-to-product";

const { product, errors, advisories } = buildProductFromDraft({
  draft,
  content: { name, description, seo },
  optionTypes: { Colour: "swatch" },
});
```

`product` is `null` whenever `errors` is non-empty. A partial record is never returned and never
written — report the errors and stop.

#### `attributes` → `specs`

Draft A's `attributes` array is flexible and labelled in whatever words the source used;
`specs` is a `Record<string, string>` with lower-case keys. The mapping is **by label**, through
a stated synonym table:

| Draft A label, lower-cased and stripped of punctuation | `specs` key |
| --- | --- |
| `material`, `materials`, `metal`, `base metal`, `base material`, `plating`, `finish` | `material` |
| `stone`, `stones`, `gem`, `gems`, `gemstone`, `gemstones` | `stone` |
| `type`, `product type`, `style`, `form` | `type` |
| `size`, `sizes`, `dimension`, `dimensions`, `measurement`, `measurements`, `length`, `chain length` | `size` |
| `closure`, `closure type`, `clasp`, `fastening`, `back`, `backing` | `closure` |
| `weight` | `weight` |
| `colour`, `color`, `colour family` | `colour` |
| anything else | **the label itself**, lower-cased, punctuation replaced by single spaces |

Seven rules govern it:

1. **The value written is `attribute.value`, never `displayTerm`.** `value` is the technical term
   the owner confirmed; `displayTerm` is the trade name the source used. `specs.stone` reads
   `Cubic zirconia`, never `American Diamond`. A record's honesty is about what it claims, and a
   trade name in a spec is a claim the shop cannot substantiate (ADR-018, ADR-035).
2. **An unrecognised label keeps its own key** and is reported as an advisory. `specs` is
   open-ended on purpose (ADR-027) — a watch has a movement and a locket has a closure — and
   `lib/specs.ts` renders any key by capitalising its first letter, so `movement` displays as
   `Movement` with no code change. Read the advisory and check the label reads as a label.
3. **Two attributes resolving to one key is a hard error, not a merge.** `Material: stainless
   steel` plus `Plating: 18K gold` is a maximal phrase that got split, which Draft A rule 2
   forbids. The fix is in the draft — one attribute reading `18K gold-plated stainless steel` —
   not a decision taken here about which one survives.
4. **An unconfirmed attribute is a hard error**, even though step 1 already checked for one. The
   mapper is callable on its own and does not assume its caller ran the gate.
5. **A blank label or a blank value is a hard error.** An unset candidate is not a spec.
6. **Values are sentence-cased and nothing more:** whitespace collapsed, first character
   upper-cased, the rest left exactly as confirmed, so `cat's-eye`, `CZ` and `18K` survive.
7. **At least one spec must result.** A record with no specs is a record that says nothing about
   the piece.

`stoneSource: "unverified-guess"` produces an advisory rather than a refusal. Confirmation is what
clears a candidate; the advisory records that this one never had a reference list behind it.

#### `images` → `media`

`images.general` becomes `media.images`, in order, and `images.variantImages` becomes
`media.variantImages`, unchanged. Both already use the storefront's `"OptionName:value"` key
format, so this is a rename rather than a translation (ADR-050).

- `media.images[0]` is the product's own photograph and is what every listing renders. An empty
  `images.general` is a hard error.
- `media.variantImages` is **omitted entirely** when there is none, rather than written as `{}`.
- Every variant key must name an option the product declares and a value that option offers.
  A key naming neither is a hard error: the unified gallery strip renders every mapped
  photograph, so an unreachable one would put a thumbnail on the page that no swatch selects back.

#### `variants` → `options`

`optionName` becomes `name`, `values` is carried through in order, `default` is `values[0]`.

`type` — the control the choice is made with — **has no source in the draft and is not guessed.**
ADR-027 makes it catalogue data precisely because two groups of the same size are not the same
kind of question: four locket shapes are a set to compare, four ribbon colours are a set to look
at. Supply it per option name in `optionTypes`; its absence is a hard error. Ask the owner which
control they want if it is not obvious from the values.

#### The rest of the record

| Product field | Source | Rule |
| --- | --- | --- |
| `id` | `draft.productId` | Assigned at Draft A creation and permanently reserved (Draft A rule 14) |
| `name`, `description` | step 2 | |
| `seo` | step 3 | |
| `category` | `draft.category` | Must be one of the ten slugs; anything else is a hard error |
| `status` | — | **Always `"draft"`.** Never `"active"`, whatever the draft says its own status is |
| `pricing.price`, `pricing.cost` | `draft.pricing` | Positive whole rupees, both required. A missing `cost` is a hard error — it is margin data and nothing may invent it |
| `pricing.mrp` | `draft.pricing.mrp` | Falls back to `price` when unset, which shows no discount. Below `price` is a hard error |
| `collections` | `draft.suggestedCollections` | Only `gifting` and `anti-tarnish` may be carried. `best-sellers` and `new-arrivals` are derived from `flags` (ADR-020, ADR-024) and naming one is a hard error. Omitted entirely when empty |
| `stock.inStock` | — | `true` unless told otherwise |
| `flags` | — | `{ featured: false, isNew: true }` — a product nobody has merchandised yet |

`draft.personalized` has no home in the product record. It is a review fact, and the mapper uses
it for one check: a piece recorded as personalised that declares no option group raises an
advisory, because the page then offers nothing to personalise.

`draft.subcategory`, `sourceNotes`, `flaggedContent` and `notes` do not become part of the record
either. They stay in the draft, which is why the draft is filed rather than deleted at publish.

### Step 6 — Write, and report

Append the record to `data/products.json`, keeping the file's existing formatting: two-space
indent, trailing newline, and the field order above.

**Before running the gate, bump `EXPECTED_PRODUCT_COUNT` in `scripts/validate-products.mjs`** to
the catalogue's new length. It is an exact count rather than a floor, deliberately, so that a
record cannot appear or vanish without someone intending it — and it counts drafts too, because it
checks the file rather than a surface (ADR-052). Adding a record therefore fails the gate until
this one line is updated, and that failure is correct rather than a bug.

It is the **only** hardcoded catalogue count in the repository. Every count in the test suite
derives from the file at run time, so nothing else needs touching. The validator's own failure
message names this line and the number to set it to. See the
[ADR-053 addendum](../../docs/decisions/ADR-053-draft-a-to-product-orchestration.md#addendum-2026-08-23--one-catalogue-count-and-synthetic-ids-stay-out-of-the-real-range).

Then run the full gate — `npm run typecheck && npm run lint && npm run test:run && npm run
validate:products && npm run build`. `validate-products.mjs` is where the record's character
counts, price bands, image paths and keyword uniqueness are actually enforced; this skill's own
checks are upstream of it, not a substitute for it.

## Output

### 1. `data/products.json`

One appended record, `status: "draft"`.

### 2. `content-pipeline/drafts/{productId}-similarity.json`

The full similarity report from step 4 — every comparison, all three measures, the threshold in
force at the time. Written on every run, advisory or not.

### 3. `data/keyword-map.json`

Regenerate it with `npm run backfill:keyword-map` and commit whatever changes.

**Expect no change.** The map indexes published products only, on the reasoning that an
unpublished record is not competing for a search result and should not reserve a keyword on
behalf of a product nobody can reach. The new record is a draft, so the regenerated map is
byte-identical to the committed one, and running the command is how that is confirmed rather than
assumed. The map gains the new keywords when `scripts/publish-product.mjs` turns the product on,
and that script regenerates it as part of publishing.

This is also why step 3 checks the candidate keyword against draft records separately. The map
cannot answer for them, and two drafts claiming one keyword is a collision that would otherwise
surface at publish, after the copy is written.

### 4. The run report

Print, do not write to a file:

```
PNNN — <product name>
gate 1  publish readiness     PASS
gate 2  keyword collision     PASS | REFUSED: <keyword> is owned by <ids>
gate 3  similarity            ADVISORY — highest <measure> <score> against <id>, threshold null
        specs                 material, stone, type
        advisories            <field>: <message>
        merchandiser notes    <any [Merchandiser note: ...] the copy raised>
next    node scripts/publish-product.mjs PNNN, after a human has read the record
```

## Publishing is not part of this skill

The record is written as a draft and stops there. Turning it on is
`node scripts/publish-product.mjs PNNN`, which re-runs the publish-readiness check, flips
`status` to `active`, regenerates the keyword map, moves the draft to
`content-pipeline/completed/`, and prints the two hand-maintained register rows the owner then
writes by hand.

Publishing is a one-way step taken by a person who has read the record. A skill that writes a
record and also switches it on is a skill with no review point in it.
