# ADR-018 — Honest product description: anti-tarnish, not hallmarked

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 17
**Resolves:** the launch blocker recorded in
[ADR-017](ADR-017-final-content-pass.md) §Consequences

## Context

[ADR-017](ADR-017-final-content-pass.md) rewrote the four policies and `/about` to describe
the shop that actually exists: `/terms` §3 now states plainly that the pieces are handcrafted
and curated **artificial** jewellery, not precious metal or precious stone, and not sold as
an investment.

It also recorded, and deliberately did not fix, the contradiction that created. Seven
surfaces outside those five pages still advertised the store as **hallmarked**. Two of them —
`AnnouncementBar` and `Footer` — are global chrome, so they rendered the word *on the very
pages carrying the new clause*. A shopper could read "Certified & hallmarked jewellery" in the
strip at the top of `/terms` and "not precious metal or precious stone jewellery" in the body
below it.

**Hallmarking is not a marketing adjective.** Under the BIS Hallmarking Regulations it is a
statutory certification scheme for articles of gold and silver, applied by a licensed assaying
and hallmarking centre and carried as a physical mark plus a HUID. It has no meaning for
plated brass, alloy or stainless steel. Applying it to this catalogue is not
over-enthusiastic copy; it is a false description of goods, and it is the kind of claim a
consumer forum reads literally.

The catalogue is unambiguous about what it is. The owner's 21 real products are `18K gold
plated stainless steel` and `18K gold plated brass`. The word to lean into was already
present in the brand's own history — the [ADR-017](ADR-017-final-content-pass.md) journey
timeline records 2020 as the year the collection moved onto an **anti-tarnish** plating,
which is a real, testable property and the thing customers actually ask about.

Grep also surfaced surfaces the ADR-017 blocker list had missed, and a second class of the
same defect in the catalogue itself.

## Decision

**1. `hallmarked` and `certified` are replaced by `anti-tarnish`, `hand-finished`,
`skin-friendly` and `quality-checked` across every shopper-facing surface.**

Nine surfaces changed, not the seven ADR-017 listed:

| Surface | Before | After |
| --- | --- | --- |
| `lib/config.ts` `SITE_CONFIG.title` | "Fine Jewellery Online" | "Artificial Jewellery Online" |
| `lib/config.ts` `SITE_CONFIG.description` | "Hallmarked, hand-finished jewellery … kundan, polki, temple gold and oxidised silver" | "Premium anti-tarnish, skin-friendly artificial jewellery … hand-finished, quality-checked, and priced to be worn" |
| `lib/config.ts` `SITE_CONFIG.ogImage.alt` | "Morchadi Gems fine jewellery" | "Morchadi Gems artificial jewellery" |
| `components/AnnouncementBar.tsx` | "Certified & hallmarked jewellery" | "Anti-tarnish, skin-friendly jewellery" |
| `components/Hero.tsx` eyebrow | "Hallmarked · Hand-finished · Shipped across India" | "Anti-tarnish · Hand-finished · Shipped across India" |
| `components/Hero.tsx` lede | "Kundan, polki, temple gold and oxidised silver" | "Gold-plated, anti-tarnish and kind to skin" |
| `components/Footer.tsx` | "Hallmarked, hand-finished jewellery" | "Anti-tarnish, hand-finished artificial jewellery" |
| `components/CartEmptyState.tsx` | "everyday oxidised silver to kundan made for the front row" | "everyday studs to statement pieces made for the front row" |
| `components/TrustStrip.tsx` badge 4 | "Certified Quality" / "Every piece inspected" | "Anti-Tarnish Quality" / "Checked by hand before dispatch" |
| `app/page.tsx` | "held to the same hallmark" | "held to the same anti-tarnish standard" |
| `app/shop/page.tsx` | "hallmarked and hand-finished" (×2 + metadata) | "anti-tarnish and hand-finished" |
| `data/testimonials.json` | "the hallmark certificate and the finish made up for it" | "the packaging and the anti-tarnish finish made up for it" |

**"Fine jewellery" went too, and that was not on the list.** Like hallmarking, it is a term of
art — it denotes precious metal and genuine stones, as against *fashion* or *costume*
jewellery. Replacing "hallmarked" while leaving the site titled "Fine Jewellery Online" would
have fixed the word and kept the claim. "Artificial jewellery" is also the phrase Indian
shoppers actually search.

**The testimonial changed, and that deserves a note.** `data/testimonials.json` is invented
placeholder copy, so editing it is editing our own fiction, not rewriting what a customer
said. Had it been a real quotation it would have been removed rather than reworded — you do
not edit a customer's words to fit a policy.

**2. The shared claim is a config constant, so a page cannot reintroduce it.**

`PRODUCT_DESCRIPTOR` — `"anti-tarnish, skin-friendly artificial jewellery"` — is exported from
`lib/config.ts` and read by `SITE_CONFIG.description` and by the per-category description
`app/shop/page.tsx` builds in `generateMetadata`. Those two sentences were near-identical and
independently written down, which is how "hallmarked" survived in two places at once. They
are now one expression used twice.

The prose surfaces — `Hero`, `Footer`, `CartEmptyState` — keep their own words. They are
different registers and lengths, and forcing one phrase through all of them would produce
copy that reads like a filled-in template. The constant governs the *metadata* claim, which
is the one that must be identical.

**3. `TrustStrip`'s fourth badge no longer implies certification.**

"Certified Quality" was the last certification claim in the chrome. It is now
**"Anti-Tarnish Quality" / "Checked by hand before dispatch"** — a description of what we do
rather than of a document we do not hold. It stays distinct from `/about`'s "Premium Quality /
Anti-tarnish plating, inspected piece by piece" so the two pages read as written rather than
duplicated. `CertificateIcon` is kept: it is a rosette outline, and the icon set names shapes
rather than claims.

**4. Nine placeholder products were making the same false claim in the catalogue, and are
fixed.**

This was found by the no-new-false-claims sweep rather than by the hallmark grep, and it is
the identical defect one layer down — a product page stating a material the piece is not:

| Product | Before | After |
| --- | --- | --- |
| `np-002` Diamond Solitaire Nose Pin | "18k gold with a certified solitaire diamond" | **Crystal Solitaire Nose Pin** — "Gold-plated brass with a cubic zirconia solitaire" |
| `np-008` Emerald Stud Nose Pin | "18k gold with an emerald green stone" | **Emerald Green Stud Nose Pin** — "Gold-plated brass with an emerald green stone" |
| `bn-011` Rajwadi Filigree Kada | "925 sterling silver filigree" | "Oxidised German silver filigree" |
| `pd-008` Evil Eye Silver Pendant | "925 sterling silver with blue enamel" | **Evil Eye Nazar Pendant** — "Silver-plated brass with blue enamel" |
| `ak-001` Silver Payal with Ghungroo | "925 sterling silver with ghungroo bells" | **Ghungroo Payal Pair** — "Silver-plated brass with ghungroo bells" |
| `ak-006` Pearl Drop Anklet | "Shell pearls with 925 sterling silver chain" | "Shell pearls on a silver-plated brass chain" |
| `ak-008` Layered Chain Anklet | "925 sterling silver, three layer chain" | "Silver-plated brass, three layer chain" |
| `np-005` Pearl Drop Nose Pin | "925 sterling silver with a shell pearl drop" | "Silver-plated brass with a shell pearl drop" |
| `np-012` Silver Clip On Nose Ring | "925 sterling silver" | **Clip On Nose Ring** — "Silver-plated brass" |

Five names changed because the name itself carried the claim: a piece called *Diamond
Solitaire* is a diamond claim however carefully the material line is worded. All nine are
invented placeholder rows, none is one of the owner's P-codes, and no test referenced them.

**Two things the sweep deliberately left alone.**

*German silver* stays on the six oxidised rows that use it. It is a copper-nickel-zinc alloy
containing no silver, and it is the standard, honest trade term for exactly this category of
Indian jewellery. Replacing an accurate term because it contains the word "silver" would trade
precision for squeamishness.

*`18K gold plated`* stays on all fourteen of the owner's real products. Plating karatage is a
factual spec — it states the karat of the gold **layer**, and the word "plated" is doing the
work. It is the opposite of the `18k gold` claim on `np-002`, which asserted the whole piece.

## Alternatives considered

**"Certified quality" / "quality certified" as the replacement.** Rejected. It keeps the
implication and loses the specificity; the obvious next question is *certified by whom*, and
there is no answer.

**"Premium quality" everywhere.** Rejected as the primary replacement — it is unfalsifiable
filler. It survives only on `/about`, where the badge detail line makes the concrete claim
underneath it ("Anti-tarnish plating, inspected piece by piece").

**Leaving the placeholder products alone as out of scope.** Rejected. They are the same false
description, on the page where a shopper decides to buy, and they contradict the same `/terms`
clause. Scope was defined by the defect, not by the grep pattern that happened to find most of
it.

**Deleting the reworded testimonial instead.** Would be correct for a real quotation. These
are invented, so rewording is honest and keeps the six-card carousel balanced. Recorded above
so the distinction is not lost.

**A lint rule banning the vocabulary.** Attractive, and rejected for now — an ESLint rule over
JSX string literals would not catch JSON data, which is where four of the claims lived. The
enforcement that works here is `PRODUCT_DESCRIPTOR` plus the grep in the build log.

## Consequences

**Easy.** The metadata claim is one constant. Every shopper-facing surface now says something
true, and the `/terms` §3 clause no longer contradicts the strip above it. The word the brand
replaced it with — anti-tarnish — is one it can actually defend, and it already appears in the
`/about` timeline as the 2020 milestone, so the story and the marketing now agree.

**Hard.** "Fine jewellery" and "hallmarked" are better-converting words than "artificial
jewellery", and dropping them is a real, if small, cost in perceived positioning. The trade is
deliberate: an unsupportable claim on a live storefront is a chargeback, a takedown or a
consumer-forum complaint waiting for its first unhappy buyer.

**What this does not fix.** The 79 placeholder products still carry invented materials,
ratings and reviews — accurate in *kind* now, but not sourced from anything. That remains the
launch blocker recorded in [ADR-016](ADR-016-real-product-import.md); this change only
guarantees the placeholder copy no longer claims a category of goods the store does not sell.

**What would force a revisit.** Actually stocking hallmarked gold or silver, or genuine
stones — at which point the claim becomes true for those rows and the catalogue needs a way to
mark which ones, rather than a blanket phrase.
