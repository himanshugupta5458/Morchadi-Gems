# ADR-009: Product detail page

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 8

## Context

The product page is the last catalogue-browsing surface and the first page that has to hold
a *transaction* — quantity, add to cart, buy now — while the cart layer does not yet exist.
It also has to serve 100 URLs off a catalogue that ships as code and changes only when
someone edits a JSON file and redeploys.

Two tensions shape it. The page must look and behave finished, including the buttons, while
the thing those buttons do is deliberately absent. And it must render a gallery for a
catalogue where every product has exactly one image — building a gallery nobody can see, or
faking a thumbnail strip out of one photo, are both wrong.

## Decision

**1. Every product prerenders. `dynamicParams = false`.**

`generateStaticParams` returns all 100 ids and the build emits 100 static HTML files —
verified by counting `.html` files under `.next/server/app/product` and diffing that set
against the catalogue ids: 100 present, none missing, none extra.

`dynamicParams = false` makes any id outside that list a 404 without invoking the page. The
catalogue is fixed and ships as code, so an unknown id is *always* wrong — there is no
scenario where a product exists but was not known at build time. On-demand rendering would
only mean doing work to discover that.

The `getProductById` guard and `notFound()` call stay regardless. They narrow
`Product | undefined` for TypeScript, and they are the correct behaviour if
`dynamicParams` is ever relaxed.

**2. The gallery is built but dormant, and it does not ship to the browser.**

`images` is `string[]` ([ADR-002](ADR-002-product-data-model.md)) and every product
currently has one entry. So:

- `ProductImagePanel` — a Server Component that renders one image, or the empty-`images[]`
  placeholder.
- `ProductGallery` — a Client Component that wraps it with a thumbnail strip and swap state.
- The page picks: `images.length > 1 ? <ProductGallery/> : <ProductImagePanel/>`.

**With one image there is no thumbnail row and no client JavaScript at all** — not a
one-thumbnail strip, which would be decoration pretending to be a control. The gallery code
exists so the second photo needs no rewrite, and it is rendered on `/style-guide` against a
synthetic two-image product so the dormant path is not shipped unseen. That verification
matters more than usual here: nothing in the catalogue exercises it, so without the style
guide it would be untested code that first runs the day real photography arrives.

**3. `PriceDisplay` extracted, and the two existing call sites retrofitted.**

The card and the product page show the same price rules at different sizes. Rather than
copy the markup, `PriceDisplay` takes `mrp`, `price`, and a `size` of `md` or `lg`, and is
now the only implementation of [ADR-003](ADR-003-discount-display-pricing.md)'s display
rules. `ProductCard` and the `/style-guide` price panel were both changed to use it — the
style guide had been hand-rolling the same markup, which is exactly how a style guide starts
lying about the system.

Two smaller extractions came out of the same pass: `Monogram` (shared by `TestimonialCard`
and product reviews) and `ProductImagePlaceholder` (shared by `ProductCard` and
`ProductImagePanel`). Sharing the monogram *treatment* does not merge the two concepts —
store testimonials and per-product reviews stay separate types, separate data, separate
components.

**4. The purchase buttons are inert, by design, and say so nowhere on screen.**

`ProductPurchasePanel` takes optional `onAddToCart` and `onBuyNow`, matching the pattern
`ProductCard` already uses. Neither is supplied, because a Server Component cannot pass a
function to a Client Component — so both buttons currently do nothing.

This is the honest shape of "build the shell, not the cart". The alternative — inventing
local state so the button *feels* like it worked — would be a lie that the cart prompt then
has to unpick. The page ships the real control surface with a seam at the boundary; the cart
prompt either passes handlers from a client parent or replaces the defaults with a
`useCart()` read. One line either way.

**`onBuyNow`'s intended behaviour is: add the item at the chosen quantity, then navigate to
`/address`.** Recorded here because it is the one piece of behaviour that cannot be inferred
from the code as it stands. `/address` does not exist yet.

**5. Quantity is bounded in exactly one place.**

`clampQuantity` in `lib/quantity.ts` is the only thing that decides what a valid quantity is
(1–10, integer). The stepper's buttons, its number input, and any paste all route through
it, so an invalid quantity cannot be constructed through the UI and nothing downstream needs
to defend against one. It is pure, so it is unit-tested (6 tests) rather than reasoned about.

The input is a real `<input type="number">` rather than a read-only display, so keyboard
arrows and screen-reader spinbutton semantics come for free; native spinners are hidden
because the ± buttons are the intended control.

**6. Out of stock disables the controls and nothing else.**

`inStock: false` disables the stepper and both buttons, relabels the primary to "Sold out",
and adds a short explanatory line. Details, reviews, and related products all render
normally. A sold-out product is still a page worth reading and worth linking to — and it is
the page from which someone finds the four related pieces that are in stock.

## Alternatives considered

**SSR or ISR instead of SSG.** Rejected: the data is a static import from a JSON file in the
same bundle. There is nothing to revalidate — a catalogue change *is* a deploy.

**`dynamicParams = true`** (the default), letting unknown ids render on demand and call
`notFound()`. Rejected as strictly more work for the same 404, given a closed id set.

**A single always-client `ProductGallery`.** Simpler — one component, one code path.
Rejected because it would ship swap machinery to all 100 product pages to manage a single
image that can never change.

**Faking a thumbnail strip from the one image.** Rejected outright. A control that does
nothing is worse than no control.

**Skipping the gallery until a second image exists.** Defensible, and rejected narrowly:
the branch is ~40 lines, and writing it now with a style-guide harness means the day
photography lands is a data change, consistent with ADR-006's "swapping in a real photo is a
file drop".

**Building minimal cart state here** so the buttons do something. Rejected — the prompt
scope excludes it, and a throwaway store would be rewritten in the next prompt, with the
risk that some of it survives.

**Merging product reviews into the testimonial components.** They render similarly. Rejected:
they answer different questions ("is this piece good" vs "is this shop trustworthy") and
have different data shapes. Only the monogram atom is shared.

## Consequences

The site is now almost entirely static: 100 product pages, home, style guide, and the 404
prerender; only `/shop` is dynamic, and only because it reads `searchParams`
([ADR-008](ADR-008-shop-architecture.md)).

Every `ProductCard` link across home, shop, and related grids now resolves. All 100 product
URLs return 200; invalid ids, wrong case, and near-miss ids return 404.

A root `app/not-found.tsx` now serves every 404 on the site, so `/cart`, `/about`,
`/contact`, and `/terms` get an on-brand page with a Back to Shop CTA instead of the Next.js
default — a side benefit of building it for unknown product ids.

The add-to-cart and buy-now buttons are visibly present and functionally dead until the cart
prompt. Anyone demoing the site before then should know that.

`PriceDisplay` is now a shared dependency of `ProductCard`, the product page, and the style
guide. Changing its markup changes the price treatment everywhere, which is the point, and
means ADR-003's rules have exactly one place to be violated.

What would force a revisit: real photography with multiple shots per product, which
activates the gallery for the first time in production and is the moment to check that its
thumbnail sizing holds up against real images rather than placeholders.
