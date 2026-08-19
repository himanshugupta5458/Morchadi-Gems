# Architecture Decision Records

## Purpose

An ADR records one architectural decision: what was chosen, what the alternatives were, and
why the choice was made. It captures the reasoning that the code itself cannot show — six
months from now the code says *what* we do, and these files say *why*.

Write an ADR when a choice is expensive to reverse or would otherwise be re-litigated:
frameworks, payment provider, data storage, hosting, auth model, state management, the
shape of a public contract. Do not write one for routine implementation detail.

## Lifecycle

An accepted ADR is immutable. Do not rewrite history when a decision changes — write a new
ADR that supersedes the old one, then edit the old one's status line to
`Superseded by ADR-NNN` and leave the rest of its body untouched.

Valid statuses: `Proposed`, `Accepted`, `Superseded by ADR-NNN`, `Deprecated`.

## Naming convention

```
ADR-NNN-short-kebab-case-title.md
```

`NNN` is a zero-padded sequential number starting at `001`, never reused. Example:
`ADR-001-tech-stack.md`, `ADR-002-cart-state-persistence.md`.

## Required structure

```markdown
# ADR-NNN: Title

- **Status:** Accepted
- **Date:** YYYY-MM-DD
- **Prompt:** N

## Context
The situation and constraints that forced a decision.

## Decision
What we are doing, stated plainly.

## Alternatives considered
Each option with why it was rejected.

## Consequences
What this makes easy, what it makes hard, and what would force us to revisit it.
```

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [001](ADR-001-tech-stack.md) | Tech stack | Accepted |
| [002](ADR-002-product-data-model.md) | Product data model | Accepted — record shape superseded by [027](ADR-027-product-schema-migration.md) |
| [003](ADR-003-discount-display-pricing.md) | Discount display pricing | Accepted |
| [004](ADR-004-design-system.md) | Design system | Accepted |
| [005](ADR-005-navigation-and-chrome.md) | Navigation and global chrome | Accepted — announcement strip superseded by [028](ADR-028-header-restructure.md) |
| [006](ADR-006-product-image-convention.md) | Product image convention and placeholders | Accepted |
| [007](ADR-007-home-composition.md) | Home page composition | Accepted |
| [008](ADR-008-shop-architecture.md) | Shop page architecture | Accepted |
| [009](ADR-009-product-page.md) | Product detail page | Accepted |
| [010](ADR-010-cart-architecture.md) | Cart architecture | Accepted |
| [011](ADR-011-checkout-address-step.md) | Checkout step 1 — the address page | Accepted |
| [012](ADR-012-static-and-policy-pages.md) | Static content and the policy set | Accepted — `PolicyDisclaimer` superseded by [037](ADR-037-policy-disclaimer-removal.md) |
| [013](ADR-013-order-creation-and-payment.md) | Order creation and the payment step | Accepted |
| 014 | *Never written — see Numbering gaps below* | — |
| [015](ADR-015-business-config-and-shipping-threshold.md) | Single-source business config and a free-shipping threshold | Accepted |
| [016](ADR-016-real-product-import.md) | Real product import and the P-code id scheme | Accepted |
| [017](ADR-017-final-content-pass.md) | Final content pass on the policy set and the about page | Accepted |
| [018](ADR-018-honest-product-description.md) | Honest product description — anti-tarnish, not hallmarked | Accepted |
| [019](ADR-019-product-options.md) | Product options — a recorded choice, never a price | Accepted |
| [020](ADR-020-two-tier-catalogue-ia.md) | Two-tier catalogue IA — categories and collections | Accepted |
| [021](ADR-021-all-real-catalogue.md) | An all-real catalogue and the end of placeholder products | Accepted |
| [022](ADR-022-logo-integration.md) | The real logo replaces the text wordmark | Accepted |
| [023](ADR-023-home-polish.md) | Home polish — real imagery, everyday positioning, button spacing | Accepted |
| [024](ADR-024-funnel-ui-polish.md) | Funnel UI polish — logo scale, two button scales, card alignment, one price facet, compact product details, em-dash sweep | Accepted |
| [025](ADR-025-button-padding-tailwind-content.md) | Button padding never rendered — `lib/` was outside Tailwind's content globs | Accepted |
| [026](ADR-026-paired-cta-equal-width.md) | A pair of calls to action is one grid, not two buttons | Accepted |
| [027](ADR-027-product-schema-migration.md) | Product record grouped by purpose, four named option controls, per-variant images and a multi-image gallery | Accepted |
| [028](ADR-028-header-restructure.md) | Two header bands, not three — the announcement moves into the logo row | Accepted |
| [029](ADR-029-seo-foundations.md) | SEO foundations — a generated sitemap, robots rules, and structured data that repeats the real policies | Accepted |
| [030](ADR-030-dependency-security-bump.md) | Dependency security — what a patch bump could fix, and why Next.js was not one of them | Accepted |
| [031](ADR-031-mobile-scale.md) | A mobile scale of its own, added under the desktop layout rather than beside it | Accepted |
| [032](ADR-032-coolify-docker-deploy.md) | Containerised deploy on Coolify — standalone output and a three-stage Dockerfile | Accepted — narrows the hosting row of [001](ADR-001-tech-stack.md) |
| [033](ADR-033-mobile-layout-round-two.md) | Four mobile layouts that differ in kind from their desktop counterparts, not just in scale | Accepted |
| [034](ADR-034-seo-audit-remediation.md) | SEO audit remediation — fabricated reviews removed, security headers added | Accepted — retires the `aggregateRating` and `review` of [029](ADR-029-seo-foundations.md) and the `amber` star token of [004](ADR-004-design-system.md) |
| [035](ADR-035-catalogue-content-pass.md) | The catalogue content pass — approved copy in, false claims out, missing values deferred to the owner | Accepted — extends the honesty sweep of [018](ADR-018-honest-product-description.md) into `data/products.json` |
| [036](ADR-036-product-seo-metadata-pass.md) | Per-product search and social metadata, written into the catalogue rather than derived from the description | Accepted — retires `buildProductMetaDescription` and decision 3 of [035](ADR-035-catalogue-content-pass.md) |
| [037](ADR-037-policy-disclaimer-removal.md) | Policy pages stop disclaiming themselves | Accepted |
| [038](ADR-038-dead-code-and-doc-accuracy-cleanup.md) | Verified-dead code removed, and the documentation corrected to match the repository | Accepted |

## Numbering gaps and known drift

Two numbers do not mean what a reader would assume, and one convention changed partway
through. All three are recorded here rather than repaired in the ADR bodies, because an
accepted ADR is immutable.

**014 was never written.** [ADR-013](ADR-013-order-creation-and-payment.md) closes by naming
payment verification and the confirmation page as the next prompt's work. That prompt shipped
the code but produced no ADR, and the following prompt chose to leave the slot empty rather
than renumber an accepted record (see row 14 of the
[build log](../progress/BUILD_LOG.md)). There is no
`ADR-014-payment-verification-and-confirmation.md` and there never was; source files that
linked to that filename now point at [`docs/api/verify-order.md`](../api/verify-order.md),
which carries the reasoning an ADR would have held.

**031 was claimed twice.** The admin WhatsApp-notification work was in flight and had already
been referenced as `ADR-031-admin-whatsapp-notification.md` from several source files, but no
such file was ever committed, and slot 031 was subsequently taken by
[ADR-031](ADR-031-mobile-scale.md) (the mobile scale). `/api/notify-admin` therefore has no
ADR; its reference document is [`docs/api/notify-admin.md`](../api/notify-admin.md), and the
stale links have been repointed there.

**ADR-015 through ADR-028 omit the `Prompt:` metadata field** required by the structure above, and
several of them use an em-dash subtitle in the `# ADR-NNN: Title` line rather than a plain
title. ADR-029 onward follows the convention again. The omission is left in place: these are
accepted records, and back-filling a metadata field into fourteen immutable documents would
rewrite history to fix a cosmetic inconsistency. New ADRs must include the field.
