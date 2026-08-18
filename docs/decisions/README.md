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
| [002](ADR-002-product-data-model.md) | Product data model | Accepted |
| [003](ADR-003-discount-display-pricing.md) | Discount display pricing | Accepted |
| [004](ADR-004-design-system.md) | Design system | Accepted |
| [005](ADR-005-navigation-and-chrome.md) | Navigation and global chrome | Accepted |
| [006](ADR-006-product-image-convention.md) | Product image convention and placeholders | Accepted |
| [007](ADR-007-home-composition.md) | Home page composition | Accepted |
| [008](ADR-008-shop-architecture.md) | Shop page architecture | Accepted |
| [009](ADR-009-product-page.md) | Product detail page | Accepted |
| [010](ADR-010-cart-architecture.md) | Cart architecture | Accepted |
| [011](ADR-011-checkout-address-step.md) | Checkout step 1 — the address page | Accepted |
| [012](ADR-012-static-and-policy-pages.md) | Static content and the policy set | Accepted |
| [013](ADR-013-order-creation-and-payment.md) | Order creation and the payment step | Accepted |
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
