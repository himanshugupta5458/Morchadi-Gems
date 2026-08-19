# ADR-038: Verified-dead code removed, and the documentation corrected to match the repository

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 40

## Context

An audit of the repository produced two lists: things that exist and are referenced by
nothing, and documents that describe a repository other than this one.

Neither list is urgent. Dead files do not break a build and a stale sentence does not fail a
test — which is exactly why both accumulate. The cost is paid later and by someone else: a
reader who trusts `docs/design/IMAGES.md` on how many photographs exist, or who follows a link
to an ADR that was never written, spends their time discovering that the document is wrong
rather than learning what it was meant to teach. A documentation set that is wrong in places
is worse than one that is thin, because there is no way to tell from the inside which parts to
trust.

The audit also produced a third list — items whose status could not be established from inside
the repository. Those are not acted on here.

## Decision

### 1. Four verified-dead items removed, and nothing else

Each was re-confirmed to have zero references at the moment of deletion, not merely at the
moment of the audit.

| Removed | Evidence |
| --- | --- |
| 96 pre-P-code placeholder images in `public/products/` | No product record, route, component or test fixture resolves to any of them |
| `isContactDeliveryConfigured()` in `lib/contact.ts` | Sole occurrence in the repository was its own definition |
| `getSortLabel()` in `lib/shop-query.ts` | Sole occurrence in the repository was its own definition |
| `components/.gitkeep` | The directory it was holding open has held 40+ components for months |

Neither function removal required a test change: no suite referenced either, so nothing was
weakened to make the deletion pass. `getContactAccessKey()` and `getPriceBandLabel()`, which
sit beside them and *are* used, stay.

### 2. Four placeholder images kept, because "unreferenced" was not true of them

`nk-001.webp`, `rg-001.webp`, `er-001.webp` and `er-004.webp` look identical to the 96 — same
naming scheme, same dead era, no product points at them. They are kept because
`lib/cart.test.ts`, `lib/checkout.test.ts`, `lib/order.test.ts`, `lib/cart-context.test.tsx`,
`lib/address-checkout.test.tsx` and several other suites reference their paths as fixture data.

This is the reason the deletion was done from an explicit reviewed file list rather than by
`grep -v '^P[0-9]{3}'` and a pipe into `rm`. The pattern is correct about 96 files and wrong
about four, and a pattern that is 96% right is the shape of mistake that reads as safe.

### 3. Items the audit could not resolve are left alone

`getProductsByCategory`, the `CreateOrderRequest` type, `descriptions.md`, and
the four fixture images above were flagged as uncertain. Uncertain is not a finding. They stay
until something establishes they are dead, and this ADR is not that something.

### 4. Two missing ADRs are recorded as missing rather than invented

Eleven source files linked to `ADR-014-payment-verification-and-confirmation.md` and
`ADR-031-admin-whatsapp-notification.md`. Neither file has ever existed.

- **014** was never written. ADR-013 named payment verification as the next prompt's work;
  that prompt shipped the code and no record, and prompt 14 chose to leave the slot empty
  rather than renumber an accepted ADR.
- **031** was claimed by the in-flight admin-notification work, then taken by
  [ADR-031](ADR-031-mobile-scale.md) before the notification ADR was written. It never was.

Writing the two missing ADRs now would mean inventing contemporaneous reasoning for decisions
made weeks ago by someone who is not here to check it — a fabricated record in a folder whose
entire value is that its records are real. Instead the links point at documents that describe
the same routes and are honest about their own provenance:
[`docs/api/verify-order.md`](../api/verify-order.md), newly written from the route's actual
behaviour, and [`docs/api/notify-admin.md`](../api/notify-admin.md), which already existed.
The [ADR index](README.md) gained a *Numbering gaps and known drift* section stating both gaps
outright, so the next reader meets the explanation before the dangling reference.

### 5. Immutable ADR bodies are not edited

ADR-015 through ADR-028 omit the `Prompt:` field the index requires, and several use an
em-dash subtitle where the convention asks for a plain title. Both are real drift and neither
is repaired. Back-filling a metadata field into fourteen accepted records would rewrite history
to fix a cosmetic inconsistency, which is the precise thing the immutability rule exists to
prevent. The drift is recorded in the index instead, along with the requirement that new ADRs
follow the convention.

The one apparent exception is the build log's missing row 13, which is inserted rather than
edited — the prompt finished without appending a row, and two other documents cite a row that
was never there. The inserted row states in its first sentence that it is a reconstruction,
lists only what the surviving record proves, and names what is unrecoverable rather than
filling it in. The git history is squashed at prompt 12, so there is no commit boundary to
recover the rest from.

### 6. Documentation corrected where it was factually wrong

Accuracy only. No prose was rewritten for style and no substantive claim was softened.

| Document | Was | Now |
| --- | --- | --- |
| `CLAUDE.md` | Hosting: Vercel | Coolify on a Hostinger VPS, with ADR-001's superseded row noted |
| `docs/design/IMAGES.md` | 21 real photos / 79 placeholders in one section, 100 in another, 49 elsewhere | 49 real photographs, 2 stand-ins, 4 kept fixtures — 55 files, reconciled against the directory |
| `docs/design/IMAGES.md` | `public/og/default.png` | `public/og/default.webp`, the file that exists ([ADR-034](ADR-034-seo-audit-remediation.md)) |
| `docs/design/IMAGES.md` | An empty `## What validation checks` heading above a populated `## What the validator checks` | Duplicate removed |
| `docs/design/IMAGES.md` | "`sharp` never runs on Vercel" | `sharp` is traced into the standalone image and does serve `/_next/image`; the devDependency trap is stated where it bites |
| `docs/testing/README.md` | 10 of 11 plans and results indexed, 23 of 38 suites listed | All indexed; the 15 missing suites documented by what they cover |
| `docs/api/README.md` | 2 of 3 routes documented | All 3, with `verify-order.md` written from the route |

## Alternatives considered

**Delete the four fixture images too and repoint the tests at P-codes.** Rejected as scope. It
is a test-fixture refactor touching ten suites, it is not a cleanup, and bundling it here would
mean the gate no longer isolates the effect of the deletions.

**Write ADR-014 and ADR-031 from the code.** Rejected. An ADR reconstructed from its own
outcome records what was built, not what was decided or what was rejected, and it would sit in
the folder indistinguishable from the records that are genuine.

**Renumber the ADRs to close the 014 gap.** Rejected for the reason prompt 14 rejected it: the
numbers are cited from source comments, other ADRs, and the build log. Closing a gap breaks
every one of those to tidy a sequence.

**Leave the stale documentation and fix it when someone trips.** Rejected. That is the policy
that produced a page contradicting itself three times about how many photographs exist.

## Consequences

The deployed bundle drops the ~1.2 MB of orphaned placeholders. `public/products/` holds 55
files, and the four non-P-code survivors are documented by name in `IMAGES.md` alongside the
suites that need them, so the next cleanup does not have to rediscover why they are there.

Every markdown link in the repository now resolves. Every route under `app/api/` has a
contract; every plan, result and test suite appears in the testing index. A reader who follows
a reference gets a document.

Two routes remain without an ADR, and that stays true — the contract files carry their
reasoning and the index says why. The `Prompt:` drift in ADR-015 through ADR-028 also stays;
it is recorded rather than repaired, and only new ADRs are held to the convention.

What would force a revisit: any of the four kept images losing its last fixture reference, at
which point it becomes deletable and the `IMAGES.md` table is the place that says so.

## Verification

No application behaviour changed. The removals were two unexported-in-practice functions, an
empty file, and images nothing loads.

`npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run validate:products` and
`npm run build` all green, with the suite unchanged at its pre-cleanup count — no test was
edited, skipped or deleted in this change.
