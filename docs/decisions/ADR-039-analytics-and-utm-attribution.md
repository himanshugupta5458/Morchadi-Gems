# ADR-039: GA4 as the analytics tool, and first-touch UTM attribution stored in the browser

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 42

## Context

The site has been live and taking payments with no measurement of any kind. The
[round-three SEO audit](../testing/RESULT-2026-08-19-seo-audit-round-three.md) ranks this its
single Critical finding (C1) — not because it changes rankings, but because it makes every
other recommendation unfalsifiable. Nobody can currently answer how many of the 70 URLs are
indexed, what the site already ranks for, or whether any change made this month moved
anything.

Two facts shape how analytics can be added here.

**The Content-Security-Policy is deliberately narrow.** `config/security-headers.mjs`
([ADR-034](ADR-034-seo-audit-remediation.md)) allows `'self'` and five Cashfree origins on
`script-src` and `connect-src`, and nothing else. A tag added without editing it is blocked by
the browser while still appearing correctly installed in the page source — it would report
zero and look fine.

**There is no database** ([ADR-001](ADR-001-tech-stack.md)). Analytics answers "how many
sessions came from that campaign"; it cannot answer "this ₹746 order came from that campaign",
because the order record is the Cashfree dashboard and a WhatsApp message, and neither knows
anything about the visit that produced it. Attribution the owner can act on has to travel with
the order itself.

Everything optional in this project already shares one shape: `NEXT_PUBLIC_WEB3FORMS_KEY`
([ADR-012](ADR-012-static-and-policy-pages.md)) and the CallMeBot pair (`lib/notify.ts`) are
each read at their point of use, and each degrades to doing nothing at all when unset. A
deployment without them sells exactly as well as one with them.

## Decision

**GA4, behind `NEXT_PUBLIC_GA_MEASUREMENT_ID`, rendering nothing when the id is unset.**
`components/GoogleAnalytics.tsx` returns `null` with no id: no script tag, no request to
Google, no `dataLayer`. With an id it loads `gtag.js` from `googletagmanager.com` through
`next/script` at `afterInteractive` and issues one `config` call. The id itself is public — it
is visible in the page source of every site that uses one — which is what makes the
`NEXT_PUBLIC_` prefix correct rather than merely convenient. No id is committed anywhere; it
is an owner-supplied value.

**The CSP is widened by exactly three origins, in the same change.**
`https://www.googletagmanager.com` on `script-src`; `https://www.google-analytics.com` and
`https://region1.google-analytics.com` on `connect-src`. Nothing is added to `img-src`,
`form-action` or `frame-src`, and `lib/security-headers.test.ts` asserts both the additions and
their absence everywhere else.

**UTM capture is first touch, stored in `localStorage`, expiring at 90 days.** On mount,
`components/UtmCapture.tsx` calls `captureUtmParams()` from `lib/utm.ts`, which reads the five
`utm_*` parameters off the current URL and, **only if no unexpired record already exists**,
writes them plus a `capturedAt` ISO timestamp to the single key `morchadi_utm_first_touch`. A
shopper who arrives from an ad, leaves, and comes back through a search result is still
credited to the ad.

Expiry does two jobs deliberately: `getStoredUtmParams()` reports nothing past 90 days,
**and** a record past 90 days no longer blocks a fresh capture. Only the second half makes the
window roll — without it the first campaign a device ever saw would own it permanently, which
is not first-touch attribution but a frozen one.

**Where the campaign ends up, given there is no database:**

| Destination | What lands there | How |
| --- | --- | --- |
| GA4 | Everything, natively, including `utm_term` and `utm_content` | The tag, when an id is set |
| The Cashfree order | `utm_source`, `utm_medium`, `utm_campaign` as `order_tags` | `/api/create-order` merges them into the tag map the recorded option choices already use |
| The owner's WhatsApp | A `*Came from*` section listing the same three | `/api/notify-admin` passes the posted campaign to `composeAdminOrderMessage` |

`order_tags` needed no fallback: this integration has written the engraving choices there since
[ADR-019](ADR-019-product-options.md), so it is a proven field on the same create-order call,
not a new one. UTM tags are merged into that existing map. Six tags is the most this can
produce against Cashfree's cap of ten.

`utm_term` and `utm_content` are captured and stored but not tagged or messaged. They are
reporting detail GA4 handles natively, and neither is something the owner acts on while packing
a parcel.

**The campaign is marketing metadata and never a decision input.** `parseUtmParams` validates
shape only; `buildOrderTags` cannot reach an amount; every value is trimmed of control
characters, whitespace-collapsed and truncated at 120 characters before it can reach a Cashfree
tag or a WhatsApp line, because a campaign URL is written by whoever links to the site.

**Everything is optional end to end.** An order placed with no `utm_*` in the URL sends the
byte-identical Cashfree request it sent before this change and produces a WhatsApp message with
no campaign section. Tests assert that equality directly rather than inferring it.

## Alternatives considered

**Plausible instead of GA4.** Genuinely the better-behaved tool: cookieless, ~1KB, no consent
banner needed in most jurisdictions, a simpler dashboard. Rejected for this site, now, on three
counts. It costs money per month at a point where the shop has no measured revenue at all;
Search Console integration and the Google Ads / Merchant Center path both assume GA4, and this
catalogue's growth plan runs through Google surfaces; and the audit's Critical is "there is no
measurement", which the free tool closes today. The cost of being wrong is low — the tag is one
component and three CSP origins, and swapping it is a same-shaped change. Revisit if the cookie
banner below becomes required, or if GA4's reporting proves unusable at this traffic volume.

**Last-touch attribution.** Rejected. It is the easier implementation (overwrite on every
visit) and it systematically over-credits branded search and direct traffic, which is exactly
the channel a shopper uses *after* an ad has already done the work. For a shop deciding whether
an Instagram campaign paid for itself, first touch is the question being asked.

**A session cookie, or `sessionStorage`, instead of `localStorage`.** Rejected: attribution has
to survive the shopper closing the tab and coming back days later, which is the normal path
between seeing an ad and buying. `sessionStorage` would lose it, and a cookie would be sent on
every request for data only the browser needs.

**Server-side attribution — read `utm_*` in a route handler or middleware.** Rejected. Every
content page is statically prerendered ([ADR-029](ADR-029-seo-foundations.md)); reading a query
parameter server-side means either middleware on every request or opting pages into dynamic
rendering, both of which cost more than the feature is worth. The same reasoning kept
`useSearchParams` out of `UtmCapture` in favour of `window.location.search` inside an effect.

**Reading the campaign back from Cashfree in `/api/notify-admin` instead of accepting it from
the browser.** Attractive, because the notification route already re-verifies the order against
Cashfree and a campaign read from that response would be server-verified rather than
client-supplied. Rejected for now: whether the Get Order response returns `order_tags` cannot be
established from inside this repository, and a notification path that silently prints nothing is
worse than one that prints what the browser said. The message's item and address content is
already client-supplied and documented as descriptive-only, so the campaign sits at exactly the
trust level it belongs at. Worth revisiting the moment a live sandbox order confirms the
round-trip.

**Putting the UTM summary in `order_note` rather than `order_tags`.** Not needed — see above.
`order_tags` was already in use and structured, and a tag map is what a future CRM import reads
cleanly.

## Consequences

**What this makes easy.** The Critical audit finding closes as soon as the owner pastes in a
measurement id — no code change, no redeploy shape to think about, because the CSP already
allows the hosts. A paid campaign becomes measurable at two levels at once: sessions and
conversions in GA4, and a per-order "came from" the owner reads on WhatsApp and can see in the
Cashfree dashboard without opening anything else.

**What it makes harder.** Three third-party origins are now allowed by a policy whose whole
value is being narrow, and two of them are allowed even on a deployment with no measurement id,
where nothing ever contacts them. That is the price of keeping the policy static and testable
rather than computed per deployment.

**GA4 sets cookies, and this ships with no consent UI.** Deliberately out of scope for this
change and recorded here as the follow-up it is. India's DPDP Act 2023 is in force but its
rules were still being finalised as this shipped, and the site serves India only. Before running
paid campaigns at scale, or before serving EU visitors in any volume, a consent banner gating
`GoogleAnalytics` behind an accepted choice is the next piece of work — the component's
all-or-nothing shape is what makes that a one-condition change. **[VERIFY WITH OWNER]** whether
any EU traffic is expected.

**One thing needs a live check the repository cannot perform.** No order carrying UTM tags has
been sent to Cashfree yet. The tag map is merged into a field this integration has used since
ADR-019, the values are bounded well inside Cashfree's limits, and an order without a campaign
is byte-identical to today's — but before a paid campaign runs, place one sandbox order through
a URL carrying `?utm_source=test&utm_medium=test&utm_campaign=test` and confirm both that the
order is created and that the tags appear on it. If Cashfree ever rejects the field, the failure
is contained to campaign traffic and the fix is one line in `buildOrderTags`.

**What would force a revisit.** A consent requirement that GA4 cannot satisfy cheaply; the v2
database, which would take attribution off `localStorage` and into an order record where
multi-touch becomes possible; or a decision to consolidate onto morchadijewels.com, at which
point the measurement property, not just the domain, has to move.
