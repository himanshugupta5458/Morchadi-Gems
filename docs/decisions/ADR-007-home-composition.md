# ADR-007: Home page composition

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 6

## Context

The home page is the storefront's showcase and the first real page built on the design
system. Everything before it — tokens, primitives, chrome, image convention — existed to be
composed here.

Two constraints shape it. There is no photography: every image on the page is a generated
placeholder ([ADR-006](ADR-006-product-image-convention.md)), and the real photos arrive
later by file drop. And `/shop` does not exist yet, so most of the page's outbound links are
promises rather than working routes.

The failure mode to avoid is a home page that is *structurally* right but *looks* unfinished
— a hero built around a photo that is not there, reading as a broken image slot rather than
as a designed page.

## Decision

**1. The hero is typographic and brand-led, with the image as a supporting panel.**

The hero carries an eyebrow, a two-tone display headline (`THE EVERYDAY` roman + *Heirloom*
in gold italic, the same lockup as `SectionHeading` and `Wordmark`), a gold rule, a
positioning line, two CTAs, and a catalogue count. **All of that reads as a finished hero
with the image removed entirely.** The image is a 5-of-12 side panel on desktop, below the
type on mobile.

This is the point rather than a stylistic preference. A hero whose composition depends on
photography is a hero that looks broken until photography exists — and photography is the
one thing this project does not have and cannot schedule. Type is the asset we control.

The slot at `/hero/home-hero.webp` follows the same convention as everything else: fixed
path, generated placeholder, non-clobbering generator, swap by dropping a file. Its
placeholder is deliberately **wordless** — a gem motif between two gold rules on a tinted
field, with a small `FINE JEWELLERY` eyebrow. It says nothing the headline beside it already
says, and a real photograph dropped in at that path loses nothing textual. A soft
ivory gradient sits over it so its edges melt into the ivory ground instead of reading as a
pasted rectangle.

The `alt` text is descriptive rather than empty, so swapping in a real photo needs no code
change — the same principle as the path convention.

**2. `ProductGrid` is built for the Shop page, not for Home.**

`ProductGrid` takes `products`, an optional `onAddToCart`, and `priorityCount`. It decides
nothing about *which* products it renders — Home hands it `getNewArrivals()` and
`getFeaturedProducts()`; Shop will hand it filtered and sorted results. Responsive columns
(2 / 3 / 4) live in the grid, not at the call site, so every product grid on the site has
the same rhythm.

Home uses it twice on the day it is written, which is the cheapest possible proof that it is
genuinely page-agnostic. Had it been written to fetch its own products, or to render its own
heading, Shop would have had to fork it.

`ButtonLink` exists for the same reason. `Button` is a `<button>` and a Client Component;
the hero CTAs are navigation and belong in an `<a>`. Rather than duplicate the class strings,
both read `buttonClasses()` from `lib/button-styles.ts`, so a variant cannot drift between
the two.

**3. Section order runs discovery → product → reassurance.**

| # | Section | Ground |
| --- | --- | --- |
| 1 | Hero | `ivory` |
| 2 | Shop by Category | `white` |
| 3 | New Arrivals | `white`, hairline above |
| 4 | Best Sellers | `white`, hairline above |
| 5 | The Morchadi Promise | `ivory` |
| 6 | Customer Speak | `honey` |

Category tiles come before product shelves because the catalogue is 100 items across 8
categories: a visitor who knows they want earrings should be one click from earrings, not
scrolling two product shelves first. New Arrivals precedes Best Sellers so returning
visitors see what changed before what is popular.

The three product-bearing sections share a white ground with hairline rules between them, so
every `ProductCard` sits on the same colour and cards never appear to have two different
resting treatments. Warm grounds bracket them: `ivory` at the hero and the promise strip,
`honey` at the testimonials, which ends the page warm rather than trailing off.

Both product sections use `align="left"` headings with a `ViewAllLink` opposite; the
editorial sections use centred headings. Alignment marks the difference between a shelf you
can act on and a statement you read.

**4. Metadata is set at the layout with a title template.**

`app/layout.tsx` carries `metadataBase` (from `NEXT_PUBLIC_BASE_URL`), a
`"%s · Morchadi Gems"` title template, the default description, and the OpenGraph block.
Pages set only what differs. Home overrides its title with `absolute` so it does not render
as "Morchadi Gems — Fine Jewellery Online · Morchadi Gems".

**A page's `openGraph` replaces the layout's rather than merging into it.** This was found by
inspecting the served HTML, not by reading the docs: the first version of the home page set
a partial `openGraph` and silently lost `og:type`, `og:site_name`, `og:locale` and
`og:image`. Any page that sets `openGraph` at all must restate the whole block. Shared
strings live in `SITE_CONFIG` so restating it cannot mean rewriting it.

## Alternatives considered

**A full-bleed photographic hero** — the conventional jewellery-storefront hero. Rejected:
with no photography it degrades to a large empty band or a full-screen placeholder, which is
precisely the "waiting for an image" look this page must not have. It is also the harder
thing to hand over, since it needs an art-directed shot at multiple crops rather than one
file.

**No hero image at all.** Honest, and it would look fine. Rejected because it leaves nowhere
for real photography to land later without a redesign — the slot is cheap now and expensive
to retrofit.

**A charcoal hero band.** Dramatic and it tested well against the palette. Rejected: the
announcement bar directly above it is already charcoal, so the page would open with two dark
bands stacked, and the header's white row would be sandwiched between them.

**Inlining the grid markup in each section.** Fewer files. Rejected — the Shop page needs the
same grid, and a grid duplicated in two places is a grid that will disagree with itself at
the third.

**A `ProductSection` component wrapping heading + view-all + grid.** Tempting, since Home
uses that shape twice. Rejected for now: Shop needs the grid without the heading and
without the view-all, so the wrapper would immediately need an escape hatch. Two similar
call sites is not yet duplication worth abstracting.

## Consequences

Home is fully server-rendered. The only client JavaScript on the page comes from chrome
(`AnnouncementBar`, `CartLink`, `CategoryNavBar`, `MobileNav`) and `TestimonialCarousel` —
no section added by this prompt is a Client Component, and the `ProductCard` "Add to cart"
buttons remain wired only to the optional `onAddToCart` prop, which Home does not pass.

Nine outbound links 404 until later prompts build their routes: `/shop` and its
`?category=` / `?sort=` variants, `/product/[id]`, `/cart`, `/about`, `/contact`, `/terms`.
They point at final URLs deliberately, per [ADR-005](ADR-005-navigation-and-chrome.md).

`/shop` now has two more parameters to honour: `sort=newest` and `sort=rating-desc`, joining
the `category` and `price` band keys from ADR-005. These are a public URL surface.

The hero headline, positioning line, and section subtitles are marketing copy written by an
engineer. They are placeholders in the same sense the images are — they read well enough to
ship, and the owner should be given the chance to replace them.

What would force a revisit: real photography arriving. A strong hero shot may well justify
reweighting the hero toward the image, and the composition should be revisited then rather
than assumed to still be right.
