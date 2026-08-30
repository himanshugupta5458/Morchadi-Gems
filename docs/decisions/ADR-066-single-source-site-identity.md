# ADR-066: One source of truth for brand, contact and policy values

- **Status:** Accepted
- **Date:** 2026-08-30
- **Prompt:** 111

## Context

The brief was to create a central configuration file for every brand, contact and policy value
hardcoded across the codebase. The investigation found that most of that file already existed,
and that the interesting work was at its edges.

`config/business.ts` has held the owner-editable business facts since ADR-012, and `lib/config.ts`
derives every rendered form from them — `SITE_CONFIG`, `CONTACT_CONFIG`, `LEGAL_CONFIG`,
`STORY_CONFIG`, `POSTAL_ADDRESS_CONFIG`, the shipping constants and the returns window. The
storefront's four policies, the contact page, the footer, the schema graph and the WhatsApp button
all read from it correctly and have done for a long time.

**So a new `lib/site-config.ts` would have been a second competing config file, not a first one.**
The brief anticipated this and said to extend rather than duplicate, which is what this ADR does.

What escaped the existing pair fell into four groups.

| Group | What was found |
| --- | --- |
| **Brand name in code** | Thirteen surfaces wrote `"Morchadi Gems"` as a literal — the wordmark's `alt`, `aria-label` and two-tone lockup, the admin title template, the admin sidebar and login eyebrow, four checkout-funnel meta descriptions, the contact form's default subject, the confirmation email's `From:` display name, the style-guide type specimen, and two section headings using the lead word alone |
| **Brand name in scripts** | Eight `.mjs` scripts printed `Morchadi Gems — …` as a banner |
| **Values only in one place, but the wrong one** | The admin hostname fallback lived in `lib/admin-routing.ts`; the Resend sending mailbox lived in `lib/notify-customer-email.ts` |
| **The one genuine numeric duplicate** | `scripts/product-record-rules.mjs` held `const FREE_SHIPPING_THRESHOLD = 799`, with a comment explaining that it could not import `lib/config.ts` and a test in `lib/product-seo.test.ts` keeping the two numbers in step |

The last row is the one that shaped the design. The duplicate was not carelessness — it was
correct, documented, and load-bearing: the catalogue gate must stay runnable as
`node scripts/validate-products.mjs`, with no path aliases and no TypeScript loader, and it needs
the threshold to check that a product's meta copy quotes no amount but the price or that
threshold. A TypeScript config file genuinely cannot serve it.

Test files were the other surprise. Twelve of them wrote a contact detail or the brand name as a
literal — the real phone number sat in three CallMeBot fixtures beside an obviously fake API key.
A test is as capable of going stale on a rename as a page is, and a stale assertion is worse
because it passes.

## Decision

**`config/site-facts.mjs` holds the values both runtimes need; `config/business.ts` stays the file
to read.**

The mechanical constraint is that plain-Node scripts cannot import TypeScript. Rather than accept
a documented duplicate, the few values both sides need — the brand names and the three policy
numbers — move into a plain `.mjs`, which both a bundler and bare `node` can read. It is the same
move `config/security-headers.mjs` already makes for `next.config.mjs`.

`config/business.ts` imports the brand names from it and republishes them as `BUSINESS` fields, so
it remains the single file an owner opens. `lib/config.ts` imports the policy numbers and
re-exports them under the names the site already uses, so no consumer changed an import.

**Three values moved into the config they belonged to:**

- `BUSINESS.adminHostname` — a domain the brand owns is a brand fact. `DEFAULT_ADMIN_HOSTNAME`
  now reads it through the new `ADMIN_CONFIG`. `ADMIN_HOSTNAME` still overrides it at runtime, so
  the deployment property ADR-041 wanted is unchanged; only the fallback's home moved.
- `BUSINESS.transactionalEmailFrom` — the verified Resend mailbox.
  `CONTACT_CONFIG.transactionalFromAddress` assembles the `Name <mailbox>` form from it and the
  brand name, and `ORDER_CONFIRMATION_FROM_ADDRESS` re-exports that under its existing name.
- `BUSINESS.brandNameLead` / `brandNameAccent` — the name split at the word the wordmark sets in
  italic gold.

**The split is stated, not computed.** `"Morchadi Gems".split(" ")` would produce the same two
strings today, but where the emphasis falls is a design decision rather than a property of the
string: a rename to a one-word or three-word brand would leave a derived split silently wrong. It
is stated as two fields and a test asserts they rejoin to `brandName` exactly.

**Doc comments may name a value; code may not.** `middleware.ts` explains the host rewrite by
naming the host it rewrites, and it should. Documentation *about* a value is not a copy *of* it —
nothing renders it, and a rename that leaves a stale comment behind is a wrong sentence rather
than a wrong page. The grep test strips comments before matching.

**Tests are held to the rule too.** The three CallMeBot fixtures now use an obviously fake
`910000000000`, matching the fake API keys beside them — the tests are about environment plumbing,
not about the owner's number. The nine that assert a rendered brand name or contact detail import
it. Exactly one file stays exempt, `lib/admin-routing.test.ts`, because host classification is
what it tests and it needs real host strings, including a mixed-case one.

**`CLAUDE.md` gains a standing instruction**, so the discipline outlives this prompt.

## Consequences

The free-shipping threshold now has exactly one definition reachable from both the Next.js build
and bare `node`. `lib/product-seo.test.ts`'s sync test inverts: there is no copy to keep in step,
so it asserts the import is present and that no `const FREE_SHIPPING_THRESHOLD =` has crept back
in beside it.

Two tests enforce the property going forward:

- `lib/site-identity.test.ts` walks `app/`, `components/`, `lib/`, `types/`, `config/`, `scripts/`
  and the three root config files, strips comments, and fails on any occurrence of a contact
  detail, the brand name or the legal entity name outside the two config files.
- `lib/free-shipping-threshold-propagation.test.tsx` mocks `config/site-facts.mjs` to 1499 and
  asserts that the calculation, the shortfall, the site description, the trust strip, the header
  announcement and the order summary all move — which is the part a grep cannot prove. A component
  could import the constant, ignore it, and print `₹799` beside it, and every other test would
  still pass because 799 is what the constant says today.

**Three config files rather than one is a real cost**, and it is worth naming. `config/business.ts`
is the file to read and edit; `config/site-facts.mjs` exists for one mechanical reason and says so
in its own header; `config/security-headers.mjs` was already separate. The alternative was
converting `config/business.ts` to `.mjs` wholesale, which would have cost the `as const` literal
types every consumer depends on.

**Nothing about the catalogue's position changes.** Prices still live in `data/products.json` and
still ship as code. This ADR narrows no row of ADR-001.
