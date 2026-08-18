# CLAUDE.md — Morchadi Gems

Operating manual for any agent working in this repository. Read this before writing code.

## Project overview

Morchadi Gems is a production-grade ecommerce website for jewelry.

| Aspect | Decision |
| --- | --- |
| Framework | Next.js 14, App Router |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS |
| Payments | Cashfree, hosted checkout redirect |
| Database | None — product catalogue is a static `data/products.json` |
| Admin panel | None — catalogue changes ship as code |
| Accounts | None — guest checkout only, no login, no user records |
| Hosting | Vercel |

The absence of a database and an admin panel is deliberate, not a shortcut. See
[ADR-001](docs/decisions/ADR-001-tech-stack.md).

## Autonomy directive

Act autonomously. No permission is needed before:

- creating, editing, moving, or deleting files inside this repository
- installing npm dependencies
- running the dev server, builds, linters, type checks, or tests
- creating or updating documentation

Pause and ask only for a genuine external blocker — a decision that cannot be made from
inside the repository. Examples: production API keys and secrets, brand or design assets,
legal copy, a domain, a pricing or business-policy call. State the blocker, deliver
everything that does not depend on it, then wait.

## Coding conventions

**TypeScript strict mode.** `strict: true` stays on. No `any`. No `@ts-ignore` — fix the
type. Every exported function has explicit parameter and return types. Shared types live in
`/types`.

**No inline code comments.** Express intent through naming instead: descriptive function
names, named intermediate variables in place of clever one-liners, small single-purpose
functions. Reserve prose for `/docs` and for JSDoc on non-obvious exported utilities. If a
block feels like it needs a comment to be understood, restructure it.

**Functional components only.** No class components. Server Components are the default;
add `"use client"` only where interactivity, browser APIs, or React context genuinely
require it, and push that boundary as far down the tree as possible.

**Server-side price validation is mandatory.** Prices, discounts, shipping, and order
totals are computed on the server from `data/products.json` at request time. A price,
total, or item amount arriving from the client is treated as untrusted input and is never
used to create a payment order. The client sends product IDs and quantities; the server
decides what those cost. Any code path that skips this is a bug, regardless of tests
passing.

**Secrets never reach the client bundle.** `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are
read only inside route handlers and server-only modules. Only `NEXT_PUBLIC_*` variables may
appear in client components. Never inline a secret into a `"use client"` file, and never
call the Cashfree API from the browser.

**General.** Named exports over default exports except for Next.js route/page files that
require a default. Keep components presentational and put logic in `/lib`. Prefer
composition over configuration flags.

## Documentation rule

**Every prompt must update the relevant docs in `/docs` before finishing.** A change is not
complete until its documentation lands in the same change.

At minimum, every prompt appends a row to
[`docs/progress/BUILD_LOG.md`](docs/progress/BUILD_LOG.md). Beyond that, update whatever
the work touched:

| If the work... | Then update |
| --- | --- |
| makes or reverses an architectural choice | a new `docs/decisions/ADR-NNN-*.md` |
| adds or changes an API route | `docs/api/` |
| adds or changes a design token or UI primitive | `docs/design/DESIGN_SYSTEM.md` and `/style-guide` |
| involves debugging, an outage, or a tricky fix | `docs/logs/` |
| adds, changes, or runs tests | `docs/testing/` |

## Docs hierarchy

```
docs/
├── decisions/   Architecture Decision Records — one file per decision, immutable once accepted
├── api/         Endpoint contracts — request, response, errors, validation rules
├── design/      Design tokens and component reference — updated in place, not immutable
├── progress/    BUILD_LOG.md, the running record of what each prompt built
├── logs/        Diagnosis and error-resolution logs — symptom, root cause, fix
└── testing/     Test plans and their results
```

Each subfolder has a `README.md` describing its purpose and file-naming convention. Read
that README before adding a file there.

## Project structure

```
app/          Routes, layouts, and API route handlers (App Router)
components/   Reusable presentational UI
lib/          Utilities, cart context, Cashfree client, server-side pricing
data/         products.json — the static catalogue, the single source of truth for prices
types/        Shared TypeScript types
docs/         Documentation (see above)
```

## Environment

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is gitignored and must stay
that way. Never commit real credentials.
