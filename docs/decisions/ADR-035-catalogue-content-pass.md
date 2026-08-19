# ADR-035: The catalogue content pass — approved copy in, false claims out, gaps deferred

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 30

## Context

Every product in `data/products.json` carried a single-sentence description written during the
[ADR-021](ADR-021-all-real-catalogue.md) import — 62 to 119 characters, enough to fill a slot
and not enough to sell anything or to be honest about what the piece is made of.

A copywriting pass produced 45 approved long-form descriptions (`descriptions.md` at the repo
root), one per product, 162 to 232 words over four to six paragraphs. Alongside the copy it
produced 41 merchandiser notes, and those notes split cleanly into two kinds:

**Claims that are false with the data we already have.** Nine specs — fourteen, in fact, once
grepped rather than counted by eye — read `18K gold plated stainless steel` or `18K gold plated
brass`. A karat figure states the fineness of *solid* gold; on a plated item it is a
precious-metal claim about a piece that contains no meaningful gold. This is the same defect
[ADR-018](ADR-018-honest-product-description.md) removed when it took `hallmarked` off the
site, and it survived that sweep because it was in the catalogue rather than in page copy.
Alongside it: five titles naming a metal or a stone the piece does not contain, three naming
the stone one way while the spec named it another, and one calling a flush stud a drop earring.

**Values we simply do not have.** Ring diameters on eleven "free size" fixed bands. Chain,
bracelet and anklet lengths on eleven listings. A pierced-ears-only notice on all seven studs.
Bangle sizes on two glass sets that cannot be resized after purchase. Battery type and water
resistance on two watches. None of these is derivable from the repository. Every one is a
number or a fact only the owner has.

The two kinds needed opposite treatment, and conflating them is how a catalogue acquires
plausible-sounding invented measurements.

## Decision

**1. The 45 approved descriptions are written into `data/products.json` verbatim.**

Prose only. The hook annotation (`*Hook: …*`) and the merchandiser note (`[Merchandiser note:
…]`) are review metadata about the copy, not copy, and neither reaches the field. Paragraph
breaks survive as `\n\n` inside the JSON string, because the copy is written as paragraphs and
storing it as one block would be a silent edit.

Four products — **P001, P022, P032, P042** — have no approved copy. The copy pass never
received them. Their original one-liners stay exactly as they were. Writing 45 of 49 and saying
so is honest; writing 49 by inventing four is not.

**2. Descriptions render as paragraphs.**

The product page rendered `product.description` in a single `<p>`, which was correct for one
sentence and wrong for five paragraphs. `getDescriptionParagraphs` in `lib/products.ts` splits
on the blank line and the page maps them into separate `<p>` elements.

**3. The meta description is the opening sentences, not the whole description.**

A 200-word description in `<meta name="description">`, `og:description` and `twitter:description`
is worse than the one-liner it replaced: a search engine truncates it around 155 characters and
the cut lands mid-word. `buildProductMetaDescription` takes whole sentences from the opening
paragraph while they fit, and clips at a word boundary only where the first sentence alone
exceeds the budget — which happens on four products of 49. The full description still goes into
the `Product` JSON-LD, where length is not a problem.

**4. Every karat figure comes out of the catalogue, and cannot come back.**

Fourteen `specs.material` values lose `18K`, becoming `Gold plated stainless steel` and `Gold
plated brass` — capitalised to match the twelve values that already read `Gold plated brass`,
since the spec list renders the string as written. The plating is real and stays described;
only the fineness claim goes.

The rule is then enforced rather than swept: `validate-products.mjs` fails on any karat figure,
`916`, `hallmark` or `sterling silver` in **any** shopper-facing string — name, description,
spec value, option name or option value — and `lib/product-copy.test.ts` asserts the same from
the test side. A grep proves a sweep once; the check is what keeps it true.

**5. Five titles are corrected to name what the piece actually is.**

| Product | Was | Now | Why |
| --- | --- | --- | --- |
| P005 | Silver Initial Signet Ring | Silver-Tone Initial Signet Ring | Rhodium-plated brass. No silver present |
| P008 | Silver Bow Twist Ring | Silver-Tone Bow Twist Ring | Rhodium-plated brass. No silver present |
| P031 | Silver Floral Teardrop Nath | Silver-Plated Floral Teardrop Nath | Silver-plated brass, and the approved copy says the listing name misleads |
| P035 | Silver Floral Cluster Nath | Silver-Plated Floral Cluster Nath | Same |
| P044 | Silver Snake Chain Ball Anklet | Silver-Plated Snake Chain Ball Anklet | Same |
| P014 | Emerald Baguette Stacking Ring | Emerald-Green Baguette Stacking Ring | Green cubic zirconia. Emerald as a colour word, not a stone name |
| P019 | Crystal Bow Adjustable Ring | CZ Bow Adjustable Ring | Spec says cubic zirconia |
| P024 | Multicolour Crystal Cluster Studs | Multicolour CZ Cluster Studs | Spec says cubic zirconia |
| P028 | Gold-Plated Pink Crystal Flower Studs | Gold-Plated Pink Flower Studs | Spec says cubic zirconia |
| P025 | Silver-Plated Pink Drop Earrings | Silver-Plated Pink Leaf Studs | Push-back studs sitting flush to the lobe. Not a drop |

`Silver-Tone` where there is no silver at all (rhodium plating), `Silver-Plated` where the spec
says the piece is silver-plated. The distinction is the spec's, not a stylistic one.

**6. A stone is named one way, and the spec decides which way.**

Where the title and the spec disagreed, the spec's material won and the title changed (P019,
P024, P028). Two sentences of approved copy moved with them: P019's "this silver-tone crystal
bow ring" becomes "this silver-tone bow ring", because the same description already says
"cubic zirconia is the right stone at this price" three paragraphs later; and P025 loses the
clause "since the listing name says drop", which described a title that no longer exists.

P004 and P012 are **not** touched. Their specs say *faceted clear crystal* and their copy says
crystal, and the P004 description exists to explain how crystal differs from CZ. They agree, so
there is nothing to fix.

**7. No missing value is invented. All of it goes to `docs/CATALOGUE-DATA-TODO.md`.**

Not one ring diameter, chain length, hoop diameter, bangle size, battery type, water resistance
rating or pierced-ears notice was added. Every gap the 41 merchandiser notes raised is now a
per-product checklist item in [`docs/CATALOGUE-DATA-TODO.md`](../CATALOGUE-DATA-TODO.md), with
four priority items at the top — the two glass bangle sets that cannot be resized, P034's
pierced-or-not question, and P041's pack-of-4-or-8 pricing ambiguity.

**8. The description word range is an advisory, not a gate failure.**

`validate-products.mjs` reports any description outside 150 to 300 words. It reports four:
P001, P022, P032 and P042, the ones awaiting copy. A hard floor would fail the gate on work
that has not been written rather than on a defect, and would create pressure to write filler.

## Alternatives considered

**Write the four missing descriptions.** Rejected. They would be inferred from a photograph
filename and a two-line spec, and would sit in the catalogue indistinguishable from 45 that a
person approved. The gap is visible and listed instead.

**Fill the missing measurements with plausible values.** Rejected outright. A chain length is
either the real one or a returns liability. This is the specific failure the whole pass was
structured to avoid.

**Correct every title carrying a bare "Gold".** Deferred. P020, P022, P032, P033, P034 and P046
name gold on gold-plated brass, alloy or steel, which is the same defect as the "Silver" titles.
The copy pass explicitly flagged the silver ones and explicitly did not flag these, and that
asymmetry is signal from the person who read all 49 listings. Renaming six products the pass
left alone is a merchandising call, so it is recorded as an open decision in the TODO rather
than made here.

**Correct P025's spec instead of its title.** Rejected. The approved copy states the earring
"sits against the lobe rather than hanging from it", so the spec (push-back studs) is the true
one and the title was the error.

**Keep the full description in the meta tags.** Rejected — see decision 3.

## Consequences

Product pages carry 45 long-form descriptions rendered as paragraphs. Meta descriptions are
under 155 characters for all 49. No shopper-facing string in the catalogue makes a karat,
hallmark, 916 or sterling-silver claim, and both the validator and the test suite fail if one
returns. Ten product names describe what the piece is made of.

Four products still show a one-line description, and the catalogue still cannot answer a
shopper asking how long a chain is or what size a bangle comes in. Both are recorded rather
than papered over. `docs/CATALOGUE-DATA-TODO.md` is the file that closes them, and it needs the
owner.
