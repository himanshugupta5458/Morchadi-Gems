# Test Result: Phase 2 orchestration — attribute mapping, the similarity gate, and publish-product

- **Date:** 2026-08-23
- **Prompt:** 69
- **Covers:** [ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)
- **Suites:** `lib/draft-a-to-product.test.ts` (36), `lib/content-similarity-gate.test.ts` (18),
  `lib/publish-product.test.ts` (15)

There is no separate `PLAN-` file for this work. The cases were derived from ADR-053's decision
list one at a time, and are recorded here with the decision each one exercises.

## Everything here runs on synthetic fixtures

**No Draft A object has ever existed in this repository, and none was created for these tests.**
Every draft below is a literal in a test file. The publish suite builds its own repository under
the OS temp directory — its own `data/products.json`, its own `content-pipeline/` — because
publishing is a one-way file move and a test that *could* run it against the shipped catalogue is
a test that will eventually run it against the shipped catalogue.

The one exception is deliberate and read-only: two similarity cases score a fixture against the
real 49 products to confirm the comparison population is every `active` record and no draft.

## Attribute mapping — `lib/draft-a-to-product.test.ts`, 36 cases

| Case | Asserts | ADR-053 decision |
| --- | --- | --- |
| Label canonicalisation | Lower-cased, punctuation dropped, whitespace collapsed. `Closure   Type` → `closure type`, `Chain-Length` → `chain length` | 2 |
| Every documented synonym | `Metal`, `Plating`, `Base Material` → `material`; `Gemstone` → `stone`; `Product Type` → `type`; `Chain Length`, `Dimensions` → `size`; `Clasp` → `closure`; `Color` → `colour` | 2 |
| Unrecognised label | `Movement` → `movement`, `Bulb count` → `bulb count`. Kept, not coerced, with an advisory | 2 |
| Specs shape | Four attributes produce `{material, stone, closure, size}`; every key is lower-case, every value a string | 2 |
| Value formatting | First character upper-cased and whitespace collapsed, and **nothing else**: `cat's-eye`, `CZ`, `18K` survive verbatim | 2 |
| Trade name never written | An attribute with `value: "cubic zirconia"` and `displayTerm: "American Diamond"` produces `specs.stone: "Cubic zirconia"`; the serialised specs contain no occurrence of the trade name | 2 |
| Duplicate spec key | `Material: stainless steel` plus `Plating: 18K gold` is one hard error naming `specs.material`, not a merge and not a silent overwrite | 2 |
| Unconfirmed attribute | Hard error, raised by the mapper on its own without the step-1 gate having run | 2 |
| Blank label, blank value, no attribute at all | Three hard errors | 2 |
| `stoneSource: "unverified-guess"` | Advisory, not an error. The spec is still written | 2 |
| Options: values and default | `values` carried in order, `default` is `values[0]` | 2 |
| Options: control type | A four-value option with no declared type is **refused**, not guessed | 2 |
| Options: empty values, duplicate name | Two hard errors | 2 |
| Media: rename | `general` → `media.images`; `variantImages` **omitted entirely** when empty rather than written as `{}` | 2 |
| Media: variant key passthrough | `"Colour:Golden"` survives unchanged | 2 |
| Media: unreachable variant key | `"Finish:Matte"` on a product with no `Finish` option, and `"Colour:Rose"` on an option with no `Rose` value, are both hard errors | 2 |
| Media: malformed key, empty general | Two hard errors | 2 |
| Pricing | `mrp` falls back to `price` with an advisory; a missing `cost` and an `mrp` below `price` are hard errors | 2 |
| Collections | `gifting` and `anti-tarnish` kept; `best-sellers` refused as derived from flags | 2 |
| Full assembly | One draft produces the exact expected record, field for field, including field order | 2 |
| **Status is always draft** | A Draft A object claiming `status: "active"` still produces `status: "draft"` | 3 |
| Optional fields omitted | No `collections` key and no `options` key when the draft has neither, rather than empty ones | 2 |
| No partial record | Any error returns `product: null` | 1 |
| Category outside the ten slugs | `"jewellery"` is a hard error | 2 |
| Personalised with no option | Advisory | 2 |
| Keyword gate, published collision | A published product's primary keyword blocks | 4 |
| **Keyword gate, draft collision** | A `status: "draft"` record's primary keyword blocks, while `published.blocked` stays `false` — the committed map genuinely cannot see it | 4 |
| Keyword gate, self-ignore | Passing the product's own id un-blocks it, so a rewrite does not collide with itself | 4 |
| Keyword gate, clean candidate | Passes | 4 |

## The similarity gate — `lib/content-similarity-gate.test.ts`, 18 cases

The two behaviours the prompt named are asserted directly and separately.

**Null threshold never blocks.**

| Case | Asserts |
| --- | --- |
| The shipped constant | `SIMILARITY_THRESHOLD` is `null` |
| Verbatim copy, threshold null | A description **word-for-word identical** to a live one returns `blocked: false`, `advisory: true`, `exceeded: []` |
| Scores still computed | The same run reports `comparedAgainst: 2` and `comparisons[0].scores.raw === 1`. Advisory does not mean "skipped" |
| Default argument | Calling `evaluateSimilarityGate` with no threshold argument uses the shipped `null` and does not block |
| Report wording | `describeSimilarityGate` says `ADVISORY` and names the null threshold |

**Set threshold blocks above it.**

| Case | Asserts |
| --- | --- |
| Above | The verbatim copy at threshold `0.5` returns `blocked: true` with one entry in `exceeded`, naming `P001` |
| Below | Unrelated copy at threshold `0.5` returns `blocked: false` |
| **Exactly equal** | A peak of exactly `1` at threshold `1` **passes**. Above means above, so a threshold of 1 reads as "refuse a verbatim copy" |
| Any of the three measures | A description differing from a live one only in its nouns blocks on the normalised measure, not the raw one |
| Nothing else differs | `comparisons` is identical between the advisory run and the blocking run over the same input. Turning the gate on changes only the verdict |

Plus: `peakScore` returns the highest of the three and breaks a tie in raw → normalised → opening
order; `compareAgainstCatalogue` sorts by peak descending, excludes the candidate's own id, and
carries all three measures on every comparison; the comparison population over the real catalogue
is exactly its `active` records.

## `scripts/publish-product.mjs` — `lib/publish-product.test.ts`, 15 cases

| Case | Asserts | ADR-053 decision |
| --- | --- | --- |
| Status flip, pure | `activateProduct` returns a new array with `status: "active"`; the input array is **unmutated** | 6 |
| Nothing else changes | The returned record equals the input record with only `status` differing | 6 |
| **Flip and move together** | `status` is `active` in `data/products.json`, `drafts/P050.json` is gone, `completed/P050.json` exists and its content is byte-equal to the draft | 6 |
| Other products untouched | Two neighbouring records, one active and one draft, come back deep-equal | 6 |
| File formatting | The written catalogue is byte-identical to `serialiseCatalogue`, so a publish is a one-line diff | 6 |
| Keyword map regenerated | `data/keyword-map.json` is written, `productCount` is 1, and the new product's primary and secondary keywords are in it | 6 |
| Readiness re-check | A draft whose attribute was unconfirmed after the record was built is refused; status stays `draft`, the draft file stays put, and **no keyword map is written at all** | 6 |
| Price removed after the fact | Refused, status stays `draft` | 6 |
| Missing draft file | Refused rather than publishing an unsourced record | 6 |
| Second publish | The same product cannot be published twice; the completed file is not moved again | 6 |
| Keyword collision at publish | Publishing a draft whose primary keyword an active product already owns is refused before any write | 4, 6 |
| Similarity report | Left in `drafts/`, with a warning saying so — it is the advisory record, not part of the draft | 5 |
| Owner reminder data | The result carries the name, category and destination the printed register row is built from | 6 |

Every refusal case asserts that **nothing was written**: status unchanged, draft file still in
place, and where applicable no keyword map created.

## End-to-end run of the CLI

Executed once against a synthetic `P900` record added to `data/products.json` and a matching
`content-pipeline/drafts/P900.json`, then reverted with `git checkout` and the files deleted.

```
$ node scripts/publish-product.mjs P900
Morchadi Gems — publishing P900

  status            draft -> active
  name              Synthetic Gate Fixture
  keyword map       rewritten, 50 published product(s)
  draft filed       content-pipeline/completed/P900.json

Two files are yours to update by hand. Nothing generates them and nothing reads them:
  docs/pipeline-prep/drafts-in-progress.md
    Delete the P900 row.
  docs/pipeline-prep/products-completed.md
    Add: | P900 | Synthetic Gate Fixture | rings | <the date this commit lands> |
```

Verified afterwards: `P900.status` was `active`, `keyword-map.json` held
`"synthetic gate fixture ring": ["P900"]` with `productCount: 50`, `drafts/P900.json` was gone and
`completed/P900.json` was present. Reverted: `git status` clean on `data/` and
`content-pipeline/`, catalogue back to 49 records.

The two refusal paths were also run against the real repository, which changed nothing:
`node scripts/publish-product.mjs` with no argument exits 2 with usage; `... P050` exits 1 with
*"content-pipeline/drafts/P050.json does not exist"*.

## The full gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm run lint` | No ESLint warnings or errors |
| `npm run test:run` | **1464 passed**, 103 skipped, 84 files. 69 of those are new |
| `npm run validate:products` | `PASS — all checks green`, 49 products, advisories unchanged from prompt 68 |
| `npm run build` | Succeeds |

`data/products.json` and `data/keyword-map.json` are byte-identical to their state at the start of
the prompt. This work added a mechanism; it added no product.

## One failure worth recording

`lib/copy-dashes.test.ts` failed on the first full run: `lib/draft-a-to-product.ts` carried em
dashes inside fifteen **error-message string literals**. The sweep strips comments before
scanning, so the module's JSDoc was fine; the strings were not.

The rule is right and the messages were rewritten rather than the test relaxed. An error message
is copy a person reads, and a repository-wide typographic rule that carves out an exception for
"messages only agents see" is a rule that erodes. `lib/keyword-collision-check.ts` had already
reached the same conclusion in prompt 68 — none of its collision messages contains one.
