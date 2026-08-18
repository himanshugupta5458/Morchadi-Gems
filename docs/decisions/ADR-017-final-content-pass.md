# ADR-017 — The final content pass on the policy set and the about page

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 16

## Context

[ADR-012](ADR-012-static-and-policy-pages.md) shipped the four policies as *sample copy
generated from what the code does*, and [ADR-015](ADR-015-business-config-and-shipping-threshold.md)
replaced the bracketed identity markers with the owner's real entity, address, inbox and
WhatsApp number. What neither prompt did was reconcile the **substance** of the copy with the
business that now exists.

Three gaps were left:

1. **The copy described the wrong shop.** The policies and `/about` described a hallmarked
   fine-jewellery workshop — kundan, polki, temple gold, oxidised silver, hallmark
   certificates. The catalogue imported in [ADR-016](ADR-016-real-product-import.md) is
   handcrafted and curated **artificial** jewellery, priced from ₹130. A refund policy that
   promises a hallmark certificate back in the box is a policy the store cannot honour.

2. **The policy set was missing clauses a shopper and a payment gateway both expect.**
   No eligibility clause, no prohibited-use clause, no usage-data or data-security section,
   no policy-updates clause on `/shipping`, no stated window for reporting a damaged parcel,
   and a refund window (`5–7 business days`) that did not match the owner's actual
   settlement experience.

3. **`/terms` carried a "we do not offer user accounts" clause.** True, but it is a *feature*
   statement in a legal document. The absence of accounts belongs in `/privacy`, where it
   explains what is *not* collected. In the terms it invited the reader to look for an
   account section that should not exist at all.

Separately, `/about` was a workshop story with no dates, no numbers and no journey — the
owner supplied all three.

## Decision

**1. Every value that appears in the copy is read from config, not written down.**

The rule from ADR-015 is extended past the identity fields to every operational number the
new copy states. `config/business.ts` gains the story facts the owner will change over time —
`foundedYear`, `customersServed`, `designsReleased`, `deliveryCoverage` — and `lib/config.ts`
exposes them as `STORY_CONFIG` alongside three additions to `LEGAL_CONFIG`:

| Value | Where it lives | Where it now appears |
| --- | --- | --- |
| `damageReportWindow` — 48 hours | `LEGAL_CONFIG` | `/refund` §4, `/shipping` §6 |
| `replacementDispatchWindow` — 7 working days | `LEGAL_CONFIG` | `/shipping` §6 |
| `minimumAge` — 18 | `LEGAL_CONFIG` | `/terms` §2, `/privacy` §10 |
| `shippingScope` — India | `LEGAL_CONFIG` | `/shipping` §2, §3, metadata |
| `foundedYear` — 2016 | `STORY_CONFIG` | `/about` eyebrow, story, stat band, timeline |
| `customersServed` — 10,000 | `STORY_CONFIG` | `/about` story, stat band, timeline, metadata |
| `designsReleased` — 500 | `STORY_CONFIG` | `/about` stat band, timeline, metadata |
| `deliveryCoverage` — Pan India | `STORY_CONFIG` | `/about` stat band |

`refundProcessingWindow` changed from `5–7 business days` to **`7–10 business days`** — one
constant edit, and `/refund` follows.

`formatMilestone` (`10000` → `"10,000+"`) lives in `lib/format.ts` beside `formatRupees` and
`formatPolicyDate`, not in `lib/config.ts`. Config holds facts; formatting them is a
different job, and putting the `Intl` formatter in the config module would have made every
importer of a constant pull a formatter it does not use.

The test is mechanical: `10,000+` appears three times on `/about` and `2016` four times, and
each one is an expression. There is no second place to forget.

**2. The copy now describes artificial jewellery, and says so in the terms.**

`/terms` §3 states plainly that the pieces are handcrafted and curated **artificial**
jewellery, that they are not precious metal or precious stone jewellery, and that they are
not sold as an investment. Every hallmark and precious-metal claim is gone from all five
pages. This is the honest description of the catalogue, and it is the clause that protects
the store if a buyer later claims they thought they were buying gold.

**3. The four carve-outs on `/refund` are stated as rules, not as bracketed questions.**

ADR-015 recorded these as owner-review items; the owner has approved them, so they are now
written as policy:

- **Made-to-order and personalized pieces** — letter and initial rings, anything engraved —
  are non-returnable **unless damaged or defective**. The carve-out from the carve-out is the
  point: a personalized piece that arrives broken is still our problem.
- **Pierced jewellery** (nose pins, earrings) is non-returnable on hygiene grounds unless
  faulty.
- **Clearance and final-sale pieces** are non-returnable.
- **Return shipping splits by cause.** Change of mind: the customer ships it back at their
  cost and no pickup is arranged. Faulty, damaged or incorrect: we collect at our cost and
  cover shipping both ways.

**4. `48 hours` is the reporting window for a damaged or incorrect delivery, and the policy
says why.**

The window is short enough to be worth explaining rather than asserting: it is the period in
which a courier will still investigate a claim. Both `/refund` §4 and `/shipping` §6 state
it, both read it from the same constant, and both name the remedy — replacement, exchange or
refund at our discretion, with an agreed replacement dispatched within
`replacementDispatchWindow`.

**5. The accounts claim moved from `/terms` to `/privacy` only.**

`/terms` no longer has a user-accounts clause. `/privacy` §1 and §2 carry it, framed as what
is *not* collected: no sign-up, no password, no profile. Guest checkout is a privacy fact,
not a term of sale.

**6. `/about` is composed from the existing design system — no new visual language.**

Seven sections, all built from primitives that already existed:

- **Hero** — the eyebrow/`h1`/rule/lede stack the page already used, with the two-tone
  treatment applied to *both* halves of the headline ("Crafted With Love." roman uppercase,
  "Worn With Pride." italic gold) plus a `ButtonLink` to `/shop`.
- **Our Story** — `SectionHeading` + `Prose`.
- **Stat band** — a `<dl>` on `ivory` using the `heading`/`maroon` display type. A
  definition list because these are label-value pairs, and a screen reader should read
  "Founded, 2016", not four loose numbers.
- **Our Journey** — an `<ol>` with a `line` rule and `gold` dots. An ordered list because the
  order carries meaning.
- **Why Choose Morchadi** — six `TrustBadge`s in a 2/3-column grid. `TrustStrip` itself is
  the fixed four-badge home-page strip and stays that; this page needs six with different
  labels, so it composes the same primitive rather than adding a variant prop to the strip.
  Every icon is one already in `icons.tsx` — no icon was added.
- **Customer Love** — `TestimonialBand`, reading the same `data/testimonials.json` as the
  home page.
- **Closing CTA** — `SectionHeading` + `ButtonLink` + the free-shipping line.

`TestimonialBand` gained optional `roman`, `accent` and `subtitle` props defaulting to its
current words, so the home page is byte-identical and `/about` can run the same band under
"Customer Love". Duplicating the section to change three words would have meant two places to
fix the carousel. The data source is deliberately *not* a prop — the JSON import stays
server-side inside the band.

**7. `/about` keeps its full OpenGraph restate and stays indexable.**

It goes on using `buildPageMetadata`, so all ten OG tags are emitted
([ADR-012](ADR-012-static-and-policy-pages.md) §6), and its description is now assembled from
`STORY_CONFIG` — the founding year, the customer count and the design count in the share card
are the same expressions as the ones on the page.

**8. The sample-template disclaimer, the last-updated line and the cross-links stay.**

`PolicyPage` is untouched. The copy is better; it is still not legal advice, and the notice
that says so comes off deliberately or not at all.

## Alternatives considered

**Hardcoding the story numbers in `app/about/page.tsx`.** They are page copy, not shared
constants, so the argument was that config is over-engineering. Rejected: `10,000+` appears
three times *within that one file* and once more in its metadata, and the owner is the person
who will change it. It belongs in the file the owner edits.

**Leaving `refundProcessingWindow` at 5–7 days.** Rejected. A refund that lands on day 9
against a policy promising 7 is a support ticket the store cannot win. The wider window is
the one the owner can actually meet.

**Adding a `variant` prop to `TrustStrip` so it could render six badges.** Rejected — that is
configuration where composition works. `TrustStrip` is the home-page strip; `/about` maps its
own six over `TrustBadge` in seven lines.

**Extracting `StatBand` and `JourneyTimeline` as shared components.** Rejected for now. Both
are used exactly once, by one page, and promoting them would put two entries in
`DESIGN_SYSTEM.md` that no second caller justifies. If a second page needs either, that is
the moment to extract it.

**Rewriting the storefront's "hallmarked" marketing copy in the same change.** Rejected as
out of scope, and recorded below as a blocker instead.

## Consequences

**Easy.** The owner changes a founding year, a customer count, a refund window or the damage
reporting window in one place and every page that states it follows. The four refund
carve-outs are now readable policy rather than bracketed text a shopper could see. `/about`
has a real narrative with dates and numbers behind it, and it cost no new component and no
new icon.

**Hard.** The three interior journey years — 2018 online, 2020 anti-tarnish, 2023 the
customer milestone — are literals in `app/about/page.tsx`, because they are historical events
rather than live values. If a date turns out to be wrong, that file is where it is fixed. The
policies still need a legal review before launch.

**A launch blocker this change surfaced and did not fix.** `/terms` now states that the
pieces are artificial jewellery and not precious metal. **Seven surfaces outside the five
pages in scope still claim the opposite** and contradict it, some of them on the very pages
that carry the new clause, because they are global chrome:

| File | Claim |
| --- | --- |
| `components/AnnouncementBar.tsx` | "Certified & hallmarked jewellery" |
| `components/Hero.tsx` | "Hallmarked · Hand-finished", "Kundan, polki, temple gold and oxidised silver" |
| `components/Footer.tsx` | "Hallmarked, hand-finished jewellery" |
| `components/CartEmptyState.tsx` | "everyday oxidised silver to kundan" |
| `app/page.tsx` | "held to the same hallmark" |
| `app/shop/page.tsx` | "hallmarked and hand-finished" (copy and metadata) |
| `lib/config.ts` | `SITE_CONFIG.description` — "Hallmarked, hand-finished jewellery … temple gold and oxidised silver" |

Hallmarking under BIS applies to gold and silver. Claiming it for artificial jewellery is a
false description, and it is now a documented contradiction with the published terms. Fixing
it means rewriting the storefront's brand voice, which is a marketing decision for the owner
rather than a content edit — so it is flagged here, not made.

**What would force a revisit.** A legal review, which supersedes this copy wholesale. Selling
any genuinely hallmarked piece, which would reverse decision 2. International shipping, which
`shippingScope` now makes a one-constant change in the prose but still a real change to the
states list, the flat rate and the checkout.
