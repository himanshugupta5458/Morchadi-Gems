# ADR-012: Static content and the policy set

- **Status:** Accepted — the `PolicyDisclaimer` decision is superseded by [ADR-037](ADR-037-policy-disclaimer-removal.md); the rest stands
- **Date:** 2026-08-17
- **Prompt:** 11

## Context

Six pages were 404ing: `/about`, `/contact`, and a policy set that did not exist at all.

The policy set is not decoration. **Cashfree will not activate a live merchant account
without published terms, privacy, refund and shipping policies.** They are a gating
requirement for taking real money, which makes them infrastructure rather than content —
and it is why all four ship now, before the payment routes, rather than being left as a
copy task for later.

That creates a specific hazard. Policy text is the easiest thing in a codebase to write
plausibly and wrongly. A generated refund policy will happily promise a 30-day window while
the trust strip on the home page promises 7, or invent free shipping over ₹999 that the
cart does not implement. Every such contradiction is a chargeback argument the store loses.

And none of it is legal advice. We can write copy that accurately describes how this store
behaves; we cannot warrant that it satisfies Indian consumer law.

## Decision

**1. The policy copy is generated from what the code actually does, and the shared numbers
come from constants.**

`FLAT_SHIPPING_RATE` and a new `RETURN_WINDOW_DAYS` live in `lib/config.ts`. The refund and
shipping policies read them, and — the point of the exercise — **`TrustStrip` now reads them
too**, replacing its hardcoded "Flat ₹99 Shipping" and "Easy 7-Day Returns" labels. The
promise on the home page and the promise in the policy are the same expression.

Verified against the served build: `7` is the only day-number that appears on `/`, `/about`,
`/cart` or any of the four policies, and every mention of shipping is `₹99`.

The prose also matches the mechanics that are not numbers: prices are INR and tax-inclusive
with no separate GST line, payment is a Cashfree hosted redirect with no card data on our
side, there are no accounts, the cart lives in `localStorage` and checkout details in
`sessionStorage`, and shipping is India-only. Each of those is a statement about code that
exists.

**2. Every policy carries a visible sample-template disclaimer.**

`PolicyDisclaimer` sits above the content on all four pages, in gold, saying plainly that
the text is a sample, has not been reviewed by a lawyer, and must be reviewed before being
relied on. It is a component rather than copy-pasted text so it cannot be removed from one
page and left on the others.

Unresolvable business facts are marked rather than invented: `[REGISTERED ENTITY NAME]`,
`[CITY]`, `[STATE]` and a handful of `[PLACEHOLDER — confirm]` markers on the
non-returnable categories, which are a merchandising decision we cannot make from inside the
repository. Guessing a jurisdiction city would produce a document that looks finished and is
wrong.

**3. `PolicyPage` + `Prose`, so a policy page contains only its own words.**

`PolicyPage` owns the breadcrumb, the two-tone heading, the last-updated line, the
disclaimer and the cross-links to the sibling policies. `Prose` handles the typography by
styling its descendants by element, so a policy writes plain semantic HTML — `<h2>`, `<p>`,
`<ul>` — and gets the type scale, gold list markers and link treatment without a component
per paragraph.

No `@tailwindcss/typography`. The plugin brings a full opinionated stylesheet that would
have to be overridden back to our tokens; the element selectors in `Prose` are about twenty
declarations and use the tokens directly.

Cross-links come from `POLICY_LINKS` in `lib/navigation.ts`, filtered to exclude the current
page. Adding a fifth policy is one array entry and it appears in the footer and on all four
existing pages.

**4. The contact form has one submit handler and one branch, decided by an env var.**

`NEXT_PUBLIC_WEB3FORMS_KEY` is a *public* submission token — it identifies a destination
inbox, not an account — which is why it is safe with the `NEXT_PUBLIC_` prefix and why no
API route is needed.

- **Key present:** the validated message is POSTed to Web3Forms. A non-OK response or a
  network failure renders an error, not a success.
- **Key absent:** the form still validates and still gives feedback, but it says
  *"Message delivery is not connected yet… it has not been sent"* and points at the support
  email and the WhatsApp button.

**The prompt asked for a cosmetic fallback that shows a "Message sent" toast without
pretending to send. Those two halves conflict**, and the second is the one that matters — a
success message for a message that went nowhere is a lie the shopper acts on, and they never
get a reply. So the cosmetic branch reports honestly and offers a route that works. Its
toast reads "Message checked", not "Message sent".

Both branches are covered by tests: the unconfigured branch asserts `fetch` was never called
*and* that the words "Message sent" appear nowhere.

**5. Name and email validation is reused from `lib/address.ts`, and that changed its copy.**

The rule for a well-formed email does not change because the form is a different one, so
`validateName` and `validateEmail` are shared. Writing the tests surfaced the cost: their
messages read "Enter the full name **for delivery**" and "Enter an email **for your order
confirmation**", which are wrong on a contact form.

The messages are now neutral — "Enter a name", "Enter an email address" — because the
field's own label already supplies the context. Copy that restates why a value is wanted is
copy that breaks the moment the rule is reused.

**6. Contact details are config-driven; About and the policies are indexable, Contact is
lean.**

`CONTACT_CONFIG` and `LEGAL_CONFIG` hold the support email, privacy email, phone, address,
hours, jurisdiction and fulfilment windows. Replacing the placeholders with real details is
a one-file change that updates the contact page, all four policies and the footer at once.

`buildPageMetadata` in `lib/metadata.ts` restates the full OpenGraph block once, encoding
[ADR-007](ADR-007-home-composition.md)'s lesson that a page's `openGraph` *replaces* the
layout's rather than merging. About and the four policies use it and each emit 10 OG tags.
`/contact` deliberately sets no `openGraph` at all, so it inherits the layout's intact —
which is what "lean" means here, not "fewer tags".

Only the contact form is a Client Component. The other five pages ship no page-specific JS.

## Alternatives considered

**Linking to a third-party policy generator, or leaving the policies as TODOs.** Rejected —
Cashfree activation needs them published, and a TODO on a live storefront is worse than a
marked sample.

**Presenting the policies as finished legal text.** Rejected. We can describe behaviour
accurately; we cannot warrant compliance. The disclaimer is the honest position and it costs
one component.

**Inventing a jurisdiction city and entity name to make the pages look complete.** Rejected.
A bracketed placeholder is visibly unfinished, which is correct. An invented city is
invisibly wrong.

**`@tailwindcss/typography` for the prose.** Rejected — see above.

**An API route proxying the contact form.** Would let the key be server-only. Rejected: the
Web3Forms key is not a secret, and a route handler would add a server dependency to a page
that otherwise ships as static HTML.

**A "Message sent" toast on the unconfigured branch.** Rejected as dishonest — see decision 4.

## Consequences

**Easy.** Swapping in the real business details, jurisdiction and dates is one file. Turning
on real contact delivery is one environment variable with no code change. Adding a policy is
one array entry. The shipping rate and returns window cannot drift between the marketing
surface and the legal surface, because they are the same constant.

**Hard.** The policies still need a legal review before launch, and the disclaimer must come
off deliberately rather than by tidy-up. The `[PLACEHOLDER — confirm]` markers on
non-returnable categories are visible to shoppers until someone decides them. And because
`NEXT_PUBLIC_` variables are inlined at build time, adding the Web3Forms key requires a
redeploy, not just an environment change.

**What would force a revisit.** International shipping (the India-only scope, the states list
and the flat rate all change). Accounts (the privacy policy's "no accounts" claim becomes
false). Any change to the shipping rate or returns window — which is now a constant edit,
but still needs the policy prose re-read for sentences the constant does not cover. And a
completed legal review, which supersedes the sample copy wholesale.
