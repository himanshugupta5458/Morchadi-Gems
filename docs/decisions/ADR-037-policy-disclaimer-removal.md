# ADR-037: The policy pages stop disclaiming themselves

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 32, recorded as BUILD_LOG row 38

## Context

[ADR-012](ADR-012-static-and-policy-pages.md) shipped the four policy pages — `/terms`,
`/privacy`, `/shipping`, `/refund` — and put a `PolicyDisclaimer` component above the content
on every one of them. Its copy read:

> **Sample template** — This policy is a sample template written to match how this store
> operates. It has not been reviewed by a lawyer. Review it with a legal professional, and
> adapt it to your registered entity and jurisdiction, before relying on it or publishing it
> as binding terms.

At the time the store was not live and the policies were placeholder-bearing drafts
(`[REGISTERED ENTITY NAME]`, `[CITY]`, `[PLACEHOLDER — confirm]`), so the notice was accurate
and its own ADR treated removing it as a decision, not a tidy-up. This is that decision.

Two things changed since. The placeholders were resolved into real business facts, so the
prose now states the store's actual rules: 7-day returns, ₹99 flat shipping free over ₹799,
India-only delivery, personalised and pierced items non-returnable, Cashfree hosted checkout,
guest-only with no accounts. And the store went live taking real payments.

The [2026-08-19 post-remediation SEO audit](../testing/RESULT-2026-08-19-seo-audit-followup.md)
flagged the disclaimer as one of three live criticals. The problem is not an SEO one. A
merchant that publicly tells shoppers its own terms are a sample not to be relied on as
binding has, in the same breath, published terms and repudiated them. It reads as unfinished
to a shopper, it undercuts the refund and shipping promises the rest of the site makes, and
it is the opposite of the trust signal a payment page needs.

## Decision

Delete `components/PolicyDisclaimer.tsx` and its render in `components/PolicyPage.tsx`. The
four policy pages present their content as the store's actual, in-effect policies, because
that is what the content describes.

Nothing else on those pages changes. The `Last updated` line, its `<time datetime>`, and
every word of policy prose stay exactly as they were. No legal language was added, softened,
or strengthened — the change is a deletion only.

**For the owner, recorded here rather than on the page:** removing the notice does not make
these policies lawyer-reviewed. It stops advertising that they are not. A real review by an
Indian consumer-law practitioner — against the registered entity, the Consumer Protection
(E-Commerce) Rules 2020, and the DPDP Act 2023 for the privacy page — is still recommended
before the store scales, and any change it produces ships as a normal policy edit with the
`Last updated` date bumped.

## Alternatives considered

**Keep the disclaimer.** Rejected. It was written for a pre-launch draft with unresolved
placeholders; neither condition holds. Leaving it means a live merchant disclaiming its own
binding terms on the same site where it charges cards.

**Soften it to "these policies are under legal review".** Rejected on two counts. It is a new
legal-ish claim about a review that has not been commissioned, which is worse than the honest
version it replaces; and a shopper reading it still cannot tell whether the refund policy
binds the store. The prompt's constraint against adding legal language points the same way.

**Move it to a comment in the source or a `robots`-excluded page.** Rejected as theatre. The
useful audience for "get these reviewed" is the owner, and the owner reads ADRs and the build
log — which is where the recommendation now lives.

**Block on the lawyer review before removing.** Rejected. The review is an external
dependency with no date; the self-repudiation is live damage today. These are independent —
removing the notice does not make the review less necessary, and the review will not be
blocked by the notice being gone.

## Consequences

The four policy pages read as policies. `PolicyPage` is one component simpler and no longer
imports a component that exists for a single caller. The `/style-guide` panel for
`PolicyDisclaimer` is gone with it, and `docs/design/DESIGN_SYSTEM.md` no longer lists it.

The site now makes binding-sounding promises with no disclaimer attached, which is the point
and also the risk: the prose is load-bearing. Any future change to a return window, a
shipping rate, or a delivery geography has to land in `lib/config.ts` and the policy prose
together, as ADR-012 already arranged, because there is no longer a notice hedging the gap.

What would force a revisit: the lawyer review returning material changes, expansion outside
India, or the store starting to hold user accounts or process data in ways the privacy page
does not describe. Each of those is a content edit with a new `Last updated` date, not a
return of the notice.

This supersedes the `PolicyDisclaimer` portion of ADR-012 only. Everything else in that ADR —
the shared `PolicyPage` shell, `POLICY_LINKS` cross-linking, `Prose`, and the
config-driven consistency between the home page's promises and the policy prose — stands.
