# ADR-001: Tech stack

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 1

## Context

Morchadi Gems is a jewelry ecommerce storefront for a single merchant with a small,
slow-changing catalogue. The requirements that shape every choice below:

- Customers browse products and check out. There are no accounts, no order history, no
  wishlist, no reviews.
- The catalogue changes rarely — new pieces are added in batches, not hourly.
- The merchant is not a technical operator and will not run servers, apply database
  migrations, or be on call.
- Payments are collected in India.
- Running cost must be near zero at low traffic, and the whole thing must survive a traffic
  spike from a marketing push without anyone intervening.

The dominant risk in an ecommerce build is not the storefront — it is money. Anything that
lets a customer influence what they are charged, or that puts card details inside our
codebase, is the failure mode worth designing against.

## Decision

**Next.js 14 with the App Router, TypeScript in strict mode, Tailwind CSS.** Server
Components render the catalogue at build time; route handlers give us a server we control
for the one thing that must never run in the browser — pricing.

**No database. The catalogue is a static `data/products.json` committed to the repo.**
Products are read on the server. Adding a product is a pull request.

**No admin panel.** Catalogue edits are code changes, reviewed and deployed like any other.

**Guest checkout only.** The customer supplies name, contact, and shipping address at
checkout. We store no account, no password, and no card data.

**Cashfree, hosted checkout redirect.** The server creates the order and hands back a
payment session; the customer completes payment on Cashfree's own pages and returns to us.
Card details never touch our origin.

**Vercel for hosting.** Static pages served from the edge, route handlers as serverless
functions, git-push deploys with preview URLs.

**Order totals are always computed server-side from `data/products.json`.** The client
sends product IDs and quantities. Every price, line total, and grand total is derived on
the server at request time, and any amount present in the request body is discarded.

## Alternatives considered

**A database (Postgres via Supabase/Neon, or MongoDB).** Rejected: it buys nothing this
project needs. Product data is small, changes rarely, and benefits from version control and
code review — properties a database actively removes. It would add a connection to manage,
migrations to run, a monthly bill, and a second source of truth for prices. Revisit if the
catalogue grows past roughly a few hundred SKUs, or the moment real-time inventory,
customer accounts, or an order history is required — see Consequences.

**A CMS (Sanity, Contentful) or a headless commerce platform (Shopify, Medusa).**
Rejected: they solve a merchandising-team problem this single-merchant store does not have,
at the cost of a subscription, a vendor lock-in, and an external service that can be down
during a sale. A JSON file is diffable, greppable, and free.

**An admin panel over the JSON file.** Rejected: an authenticated, write-capable surface
is the largest attack surface we could add, and it exists to serve edits that happen a few
times a month. Pull requests give the same capability with review, history, and rollback
already built in.

**Customer accounts.** Rejected: accounts mean stored credentials, password resets,
session management, and personal data at rest — real liability in exchange for convenience
on a store most customers buy from once. Guest checkout removes the entire category.

**Razorpay or Stripe instead of Cashfree.** Stripe rejected: weaker fit for Indian domestic
payment methods and settlement. Razorpay is a genuinely close alternative; Cashfree was
chosen on merchant preference and its straightforward hosted-checkout flow. This is the
most reversible decision in this ADR — it is contained behind `lib/` and a single route
handler.

**Cashfree's embedded/drop-in checkout instead of the hosted redirect.** Rejected for
launch: embedding puts payment UI inside our origin and widens PCI scope for a smoother
flow we do not yet need. The redirect keeps card entry entirely on Cashfree's domain.

**Netlify, Cloudflare Pages, or a self-managed VPS.** Rejected: Vercel is the
first-party Next.js target, so App Router features work without adapter friction. A VPS
would add patching, TLS renewal, and uptime to a merchant who cannot own any of it.

## Consequences

**Made easy.** Deploys are a git push. Pages are static and fast, and cost essentially
nothing at rest. Price changes are reviewable diffs with full history and one-command
rollback. There is no database to breach, no admin login to phish, no card data to protect,
and no stored customer accounts to leak. The whole system has one moving external
dependency: Cashfree.

**Made hard.** Every catalogue change requires a developer and a deploy — the merchant
cannot self-serve. Live inventory counts are not possible; a sold-out item stays purchasable
until someone ships a change, so stock must be handled operationally or the product data
must be conservative. Customers cannot look up past orders on the site; order confirmation
lives in email and in the Cashfree dashboard. Search and filtering must run over the full
JSON in memory, which is fine at this size and would not be at ten thousand SKUs.

**Non-negotiable given these choices.** With no database, `data/products.json` is the only
authority on price. Server-side recomputation of every total is not a best practice here —
it is the sole thing standing between us and a customer paying an amount they chose. It is
recorded as a hard rule in [`CLAUDE.md`](../../CLAUDE.md) and must be covered by adversarial
tests in [`docs/testing/`](../testing/).

**What would force a revisit.** Any one of: the merchant needing to edit the catalogue
without a developer; real-time stock control; customer accounts or order history;
multi-currency or international tax; a catalogue large enough that in-memory filtering or
build times hurt. The first of these to arrive should get its own ADR superseding this one,
rather than a database quietly appearing alongside the JSON file.
