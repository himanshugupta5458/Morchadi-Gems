# ADR-036: Per-product search and social metadata, written into the catalogue

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 31, recorded as BUILD_LOG row 37

## Context

[ADR-035](ADR-035-catalogue-content-pass.md) gave every product a long-form description and,
with it, a problem: a 200-word description cannot be a `<meta name="description">`. Its
decision 3 solved that by deriving one — `buildProductMetaDescription` took whole sentences
from the opening paragraph while they fit under 155 characters.

That derivation was correct as far as it went and wrong about what a meta description is for.
An opening paragraph is written to make someone who is *already on the page* keep reading. A
meta description is written to make someone who is *looking at ten search results* click this
one. They are different jobs, and taking the first 150 characters of the first does the second
badly:

- Six of the 49 derived descriptions came out under 100 characters, because the opening
  sentence was short and the second would not fit. A 76-character description leaves most of
  the SERP line blank.
- Several opened on a sentence that only makes sense with the paragraph under it. P009's read
  "It does not tell the time." — true, deliberate on the page, and a strange thing to meet in
  a search result with no product in front of you.
- The `og:title` was `${name} · Morchadi Gems` on every product and the `og:description` was
  the same derived text as the meta description. WhatsApp shows roughly the first 80 characters
  of an `og:description` and **caches a link preview aggressively**, so a card that lands badly
  the first time stays landed badly for everyone who saw it.
- Every product image carried `alt={product.name}` — the name, not a description of the
  photograph. "Gold Peacock Nath with Pearl Drop" tells a screen-reader user the listing title
  they already heard from the heading, and tells an image crawler nothing new.

Deriving harder was not the fix. The metadata had to be *written*, per product, the way the
descriptions were.

## Decision

**1. Metadata is catalogue data, written per product by the `morchadi-product-meta` skill.**

Each of the 49 records gains a `seo` object:

```json
"seo": {
  "primaryKeyword": "gold-plated peacock nath",
  "secondaryKeywords": ["nath for wedding", "screw nose pin", "festive nath", "nose ring with stones"],
  "metaTitle": "Gold-Plated Peacock Nath with a Deep Pink-Red Stone",
  "metaDescription": "A peacock curves along a pave hoop, set with a deep pink-red stone and one hanging pearl-look bead. Gold-plated brass, screw fit for a pierced nose.",
  "imageAlt": "Curved peacock nose ring in gold tone with a deep pink-red stone and a pearl-look bead below",
  "ogTitle": "Gold-Plated Peacock Nath, Pearl-Look Drop, \u20B9109",
  "ogDescription": "A nath does more work in a photograph than its size suggests. A gold-plated peacock along the hoop, a deep pink-red stone, and a pearl-look bead below.",
  "ogImage": "/products/P032.webp"
}
```

`additionalImageAlts` is the ninth key, present only on P002, the one product with a second
photograph. One alt per image, in `media.images` order.

`primaryKeyword` and `secondaryKeywords` are **internal targeting only**. They are never
emitted as a `<meta name="keywords">` tag, which Google has ignored since 2009. They are stored
because the collision rule below is enforced against them, and a keyword that exists only in a
session transcript cannot be checked by anything.

**2. `buildProductMetaDescription` is deleted, not kept as a fallback.**

A fallback that never fires is a second definition of the truth waiting to diverge from the
first. `seo` is required on `Product` and required by `validate-products.mjs`, so there is no
product for a fallback to serve. Its four tests go with it.

**3. The product page reads the record and hardcodes nothing.**

`generateMetadata` maps `seo.metaTitle` → `title`, `seo.metaDescription` → `description`,
`seo.ogTitle`/`seo.ogDescription` → both the Open Graph *and* the Twitter block (a share card
and a search result are different jobs; the two social surfaces are not), and `seo.ogImage` →
`openGraph.images`, declared 1200x630. The canonical stays `/product/{id}`. A future product
gets its metadata by having the fields, not by anyone editing the component.

**4. The title opts out of the layout's brand template.**

`app/layout.tsx` sets `template: "%s · Morchadi Gems"`. Applied to a title already sized against
the ~600px a desktop SERP renders, it appended a second brand and pushed every product title to
67-77 characters. The page now returns `title: { absolute: seo.metaTitle }`. The brand belongs
in a title only where the product keywords have room to spare, and on this catalogue they do
not — so it is in the `og:title` of a few products, where social cards show a brand well, and
in none of the meta titles.

**5. Image alt text describes the photograph, and follows the photograph.**

`getImageAlts` returns one alt per entry in `media.images`. `ProductImagePanel`, the gallery's
main image, and `ProductCard` all read it. A variant photograph (P010's golden finish) has no
alt written for it and falls back to the main one rather than describing the wrong finish;
`ProductGallery` no longer takes `productName` at all.

**6. The bounds are checked by measurement, in the gate.**

`validate-products.mjs` counts **code points**, not UTF-16 units, so the rupee sign counts once,
and fails on: `metaTitle` outside 50-60, `metaDescription` outside 140-160, `ogTitle` outside
40-70, `ogDescription` over 200, any alt over 125, an alt opening "image of", a missing or
extra alt for the image count, an `ogImage` that is not the product's own photograph, a
duplicate `metaTitle` or `primaryKeyword` across the batch, an `ogTitle` that clones the
`metaTitle`, a barred promotional adjective, an anti-tarnish claim on a product not tagged for
it, and a rupee amount that is neither the product's price nor the free-shipping threshold.

`lib/product-seo.test.ts` asserts the same from the test side plus what a script cannot reach:
that `generateMetadata` actually publishes the fields, that Twitter mirrors Open Graph, and
that no title carries the brand twice.

## Consequences

**The metadata is honest by the same rules the descriptions are.** Colour words never become
stone names ("deep pink-red stone", not "ruby"; "emerald-green" as a colour, with P014's
`og:description` saying so outright). Anti-tarnish appears on the eight tagged products and
nowhere else, enforced. Pearl-look, not pearl. Gold-plated, never gold. No karat, no
hallmarking, no sterling — the ADR-035 sweep now covers `seo` strings too, in both the
validator and `lib/product-copy.test.ts`.

**Eight names still say something the piece is not.** ADR-035 corrected five titles; this pass
surfaced eight more, and did not rename them. The metadata says the honest thing in every
field, so no shopper reads a false claim from a search result or a share card, but the `name`
on the record is the owner's and renaming it is a merchandising call, not a code fix.

| Product | Name says | The piece is |
| --- | --- | --- |
| P009 Watch Dial Ring | a watch | a decorative dial. The hands are painted and do not move |
| P010 Mini Watch Ring | a watch | the same, at a smaller scale |
| P020 Gold Ribbon Bow Ring | gold | gold-plated stainless steel |
| P022 Vintage Gold Beaded Bracelet Watch | gold | an anti-tarnish gold-plated alloy |
| P032 Gold Peacock Nath with Pearl Drop | gold, pearl | gold-plated brass with a faux pearl-look drop |
| P033 Gold Peacock Nath with Clear Stones | gold | gold-plated brass |
| P034 Gold Minimalist Stone Nath | gold | gold-plated brass |
| P046 Clover Charm Gold Anklet | gold | anti-tarnish gold-plated stainless steel |

P030's spec calls its centre stone a "milky cat's-eye", without saying what it is made of. The
metadata calls it a cat's-eye **effect** and a milky centre, which is what can be seen; the
material is a question for the owner.

**Nine products quote a price, and a price goes stale.** Where the low price is the click
reason, it leads — P047 at ₹49, P020 at ₹130, P044 at ₹89. `validate-products.mjs` prints these
as an advisory on every run, so a price change surfaces the metadata that needs rewriting
rather than leaving a card promising ₹49 after the piece moved to ₹79.

| Product | Amount |
| --- | --- |
| P005 | ₹199 (og:title only) |
| P017 | ₹210 |
| P020 | ₹130 |
| P023 | ₹189 |
| P031 | ₹109 |
| P032 | ₹109 |
| P041 | ₹799 (the free-shipping threshold, not a price) |
| P044 | ₹89 |
| P047 | ₹49 |

**The free-shipping nudge is used once in 49.** On a catalogue topping out at ₹499, telling a
shopper looking at a ₹109 nath about free shipping over ₹799 is a nudge to spend seven times
the item's price. It appears only on P041, the bangles sold in packs of four or eight, where a
multi-item basket is what the product is. Fifteen of the 49 carry a trust nudge at all — nine
7-day returns, four dispatch-in-2, one delivery-in-7, one free shipping — and the other 34
carry none, because a meta description that always ends the same way reads as a template
across 49 search results.

**Four products still have a one-line description and full metadata.** P001, P022, P032 and
P042 are the ADR-035 gap. Metadata does not depend on description length — it depends on the
specs, the price and the photograph, all of which those four have — so they are written to the
same standard as the other 45. `docs/CATALOGUE-DATA-TODO.md` still tracks the copy.

**What this does not do.** It does not touch the `Product` JSON-LD, which keeps the full
description and the real image list. It does not generate per-product Open Graph images: the
1200x630 declared on `openGraph.images` is the box an unfurler renders the square product
photograph into, and rendering true 1.91:1 cards per product is a separate asset job.

## Alternatives considered

**Keep deriving from the description and just tune the clipper.** Rejected. The failure is not
the length rule, it is that the opening of a description and the pitch of a search result are
different pieces of writing. No clipper turns one into the other.

**Hold the metadata in a lookup keyed by product id, in `lib/`.** Rejected. It is per-product
data and the product record is where per-product data lives; a parallel map is a second file to
keep in step with `products.json`, and the validator would have had to check the join rather
than the record.

**Emit `<meta name="keywords">` since the keywords are now stored.** Rejected. Google has
ignored it since 2009 and it publishes the targeting for a competitor to read. The keywords
earn their place in the record by being what the collision rule is enforced against.


## Addendum, 2026-08-23 — the site-wide keyword map now exists

*Prompt 68. This record's body above is unchanged; ADRs are immutable once accepted, and this
section states only what has moved.*

### The gap this closes

`.claude/skills/meta-skills.md` enforces its collision rule against a **ledger** — a per-batch
running list the writer keeps and consults before each product. That works inside one sitting
and answers nothing across sittings. The body above stores `primaryKeyword` and
`secondaryKeywords` in the record precisely so the rule has something durable to check against,
but nothing ever assembled them into a site-wide view, and
[`docs/PROJECT-STATE.md`](../PROJECT-STATE.md) §11 recorded the consequence: *"A standalone
site-wide keyword-map file was not found in the repository, so where it currently lives is
**[VERIFY WITH OWNER]**."* It lived nowhere. This addendum builds it.

| Artefact | What it is |
| --- | --- |
| `data/keyword-map.json` | The map. `{ keyword: [productId] }`, twice: once for primary keywords, once for secondary |
| `scripts/backfill-keyword-map.mjs` | Builds it from `data/products.json`. `npm run backfill:keyword-map` |
| `lib/keyword-collision-check.ts` | Checks one candidate `primaryKeyword` against the map |

### The alternative this record rejected, and why this is not it

The Alternatives section above rejects *"hold the metadata in a lookup keyed by product id, in
`lib/`"* on the grounds that **a parallel map is a second file to keep in step with
`products.json`.** That objection is correct and it applies here, so it is answered rather than
ignored.

Two things make this a different proposition. First, the direction is reversed: that alternative
proposed the map as the *place metadata lives*, replacing the record. This map is **derived** —
`data/products.json` remains the single source of truth for every keyword, and the map holds no
fact the records do not already carry. Second, the drift is closed mechanically.
`scripts/validate-products.mjs` rebuilds the map from the catalogue on every gate run and
compares it byte for byte with the committed file; a mismatch is a **hard failure** naming the
one command that fixes it. The map cannot silently disagree with the catalogue, because
disagreeing fails the build.

What justifies a derived file at all is that the collision rule is the one question in this
record that a *single product record cannot answer*. Everything else the validator checks —
lengths, honesty, field-clones — is a property of one product. "Is this keyword taken" is a
property of the catalogue.

### Hard versus advisory

The rule in the skill says no two products may share a `primaryKeyword` and says **nothing about
secondary terms.** That silence is deliberate and is now encoded rather than left to a reader:

| Condition | Severity |
| --- | --- |
| The candidate is another published product's `primaryKeyword` | **Hard — blocks** |
| The candidate is another product's secondary keyword | Advisory |
| The candidate differs from an existing keyword only by word order or punctuation | Advisory |

Only the first blocks. Two rings genuinely are both adjustable, and forbidding that overlap
would push a writer into inventing a distinction the products do not have, which is the failure
[ADR-018](ADR-018-honest-product-description.md) exists to prevent. A near-match is advisory for
the reason [ADR-051](ADR-051-draft-a-content-pipeline.md) gives for refusing fuzzy matching
elsewhere: *a fuzzy match is an answer nobody gave.* The loose comparison here is a stated,
mechanical rule — punctuation dropped, word order discarded, a trailing plural removed from words
long enough for that to be safe — and it exists to point a writer somewhere, never to decide.

Case is not a difference. `Gold-Plated Ring` and `gold-plated ring` are one keyword competing
with itself, so the hard check compares canonicalised strings.

### Drafts do not reserve keywords

A `status: "draft"` product ([ADR-052](ADR-052-product-status-field.md)) is excluded from the
map. An unpublished record is not competing for a search result, and letting it hold a keyword
would block a real product on behalf of one nobody can reach. A draft's keyword becomes live
when the product does.

### The state of the existing 49

**No hard collision exists.** All 49 published products carry distinct primary keywords, and no
product's primary keyword appears as another product's secondary term. The pass that wrote them
held its ledger correctly.

Advisory findings, reported on every gate run and **not fixed**, because which of two products
should own a shared term is an owner and merchandising decision rather than a code fix:

- **9 secondary keywords claimed by more than one product**, spanning 15 products. The largest is
  `adjustable ring for women` on P004, P007 and P019. `set of sixteen bangles` and
  `lacquered glass bangles` are both shared by P042 and P043, which are the same piece in two
  colourways.
- **1 near-match pair:** `gold-plated thin ring` (P015) and `thin gold-plated ring` (P017),
  identical in words and different in order. Both are secondary terms, so neither blocks.
