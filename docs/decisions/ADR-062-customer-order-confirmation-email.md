# ADR-062: A customer order-confirmation email, sent from the two places the owner's WhatsApp already is

- **Status:** Accepted
- **Date:** 2026-08-29
- **Prompt:** 103

## Context

Since [ADR-060](ADR-060-cod-order-notification.md), placing an order tells the owner about it —
over WhatsApp, from one of two warranted places: `/api/create-order`'s cash-on-delivery branch,
where the just-written Postgres row is the warrant, and `/api/notify-admin`, where a fresh
Cashfree lookup is. Nothing tells the *customer*. They see the confirmation screen once, and if
they close the tab, refresh past the notification window, or simply want a record to search
their inbox for later, there is nothing.

Resend was set up for this outside the codebase: an account, a domain
(`updates.morchadijewels.com`) verified with SPF and DKIM, and a from-address
(`orders@updates.morchadijewels.com`). `RESEND_API_KEY` was supplied the same way
`CASHFREE_SECRET_KEY` and `CALLMEBOT_APIKEY` are — a runtime environment variable, read
server-side and nowhere else.

## Decision

### 1. Two trigger points, matching the WhatsApp architecture one-to-one — not one unified function

The task that started this work suggested a single `sendOrderConfirmationEmail(order)`. That
shape was rejected in favour of mirroring `lib/notify.ts` / `lib/notify-cod.ts` exactly:
`sendCodOrderConfirmationEmail` in `lib/notify-customer-email.ts` is called from the same
`/api/create-order` branch that calls `notifyOwnerOfCodOrder`, and `dispatchOrderConfirmationEmail`
is called from `/api/notify-admin`, sharing that route's Cashfree-verified `PAID` guard exactly
as `dispatchAdminNotification` does. A single unified function would have had to reconstruct,
inside itself, the very distinction — *which warrant applies* — that the two-function WhatsApp
design exists to keep visible at the call site. Mirroring the existing shape as closely as
possible was the explicit brief, and the existing shape is two functions for a reason.

### 2. The email reuses the WhatsApp warrant. No second verification was built

For the paid and partial-payment paths, the customer email is dispatched from inside
`/api/notify-admin`, immediately after the same `lookupCashfreeOrder` call and the same
`verifiedStatus !== "PAID"` guard that gates the owner's WhatsApp. This was a deliberate choice
among three read in the task brief: ride `/api/notify-admin`, or fire from `/api/verify-order`
once it establishes `PAID`.

`/api/verify-order` was rejected. It is polled — the confirmation page calls it on mount and
again on every pending-payment retry — so sending from there would need its own idempotency
mechanism (the candidate considered was "only on the state transition that
`recordVerifiedPaymentStatus` reports as `UPDATED`"), which is exactly the kind of second warrant
mechanism [ADR-060](ADR-060-cod-order-notification.md) already rejected building for the COD
case, for the same reason: it re-derives a fact the existing route already establishes, and a
second construction is a second thing that can drift out of sync with the first. `/api/notify-admin`
already re-verifies `PAID` with Cashfree, already receives the client's `summary` (items,
address, and therefore the customer's email — Cashfree has no idea who to email), and already
has the browser's `sessionStorage`-flag dedup in front of it. Reusing it costs nothing and adds
no new surface.

For the cash-on-delivery path, the reasoning is [ADR-060](ADR-060-cod-order-notification.md)'s
own, restated: `/api/create-order`'s COD branch just wrote the row that is the whole
verification, no browser is involved, and the send is `void`-called rather than awaited because
a placed order must not wait on a hobby-tier email API any more than it waits on CallMeBot.

### 3. The customer email closes a gap the WhatsApp message still has, deliberately

[ADR-060](ADR-060-cod-order-notification.md)'s consequences section records, as a known and
accepted gap: `composeAdminOrderMessage` prints `*Paid:* ₹300` on a `partial_cod` order and says
nothing about the ₹446 still owed at the door, because closing it "is a separate change to the
paid message rather than to this one, deliberately out of scope here."

That separate change is this one, and it lands in the new channel, not the old one.
`dispatchOrderConfirmationEmail` reads `orders.amount_due` via
`findCapturedOrderForPaymentReference` — the same function `/api/verify-order` already calls —
specifically so `composePaidOrderConfirmationEmail` can state the balance honestly:
`Your payment went through … ₹300 has been paid online, and the remaining ₹446 is due in cash
when it is delivered`, with a `Due on delivery: ₹446` line beside the payment breakdown.

The decision to close the gap here rather than in `composeAdminOrderMessage` itself is
deliberate, not an oversight carried forward: the WhatsApp message is the operator's own
paperwork, read by someone who can open the admin panel and see `amount_due` on the order
detail screen if they need it; the customer has no such screen, no order detail view, and no
other channel this shop controls that tells them anything is still owed. The two messages
serving the same fact with different completeness stops being acceptable once one of them is
customer-facing. Widening `composeAdminOrderMessage` to read `orders.amount_due` too remains
open, tracked exactly where ADR-060 left it — genuinely out of scope for this prompt, and
no longer newly acquired scope creep now that a second, independent implementation of the same
honesty rule exists to compare it against.

An unreadable `amount_due` (no captured row, or Postgres not answering) is treated as though
nothing is due, matching the precedent `OrderConfirmation.tsx` already set for the identical
ambiguity (`result.amountDue !== null && result.amountDue > 0`) rather than inventing a new
convention for it.

### 4. Two functions in transport, two in composition — mirroring `lib/notify.ts` / `lib/notify-message.ts`

`lib/notify-customer-email.ts` is the send layer: `readResendApiKey`, `sendCustomerEmail` (the
email sibling of `sendOwnerWhatsApp`, injectable and never throwing), and the two
orchestration functions from decision 1. `lib/customer-email-message.ts` is the composition
layer: `composeCodOrderConfirmationEmail` and `composePaidOrderConfirmationEmail`, the email
siblings of `composeCodOrderMessage` and `composeAdminOrderMessage`. Splitting transport from
composition, and cash-on-delivery from paid, was already the shape two files and four functions
took for WhatsApp; this reuses it rather than inventing a third pattern for a second channel.

### 5. Resend's SDK has no abort signal, so the timeout is a `Promise.race`, not `AbortSignal.timeout`

`sendOwnerWhatsApp` passes `AbortSignal.timeout(CALLMEBOT_TIMEOUT_MS)` straight into `fetch`,
which genuinely cancels the request. `resend.emails.send()` accepts no such option and calls
`fetch` internally, out of reach. `sendCustomerEmail` instead races the send against a timer and
returns `FAILED` when the timer wins; the underlying HTTP call, if it is still in flight, is left
to resolve on its own rather than being torn down. This is a weaker guarantee than
`AbortSignal.timeout` gives — a slow Resend call keeps a promise alive in the background for up
to its own timeout past the 8s this module gives up at — and it is accepted because nothing
downstream is waiting on either promise: both call sites `void`-call or otherwise never block a
response on the outcome.

`RESEND_TIMEOUT_MS` is 8s against `CALLMEBOT_TIMEOUT_MS`'s 5s. The number differs because the
reason for CallMeBot's five seconds — a shopper is looking at a spinner — does not apply to
either call site here: the COD send has no Cashfree redirect to hide behind because nothing
after it in the response is affected either way, and the paid/partial send fires from a route
the browser already treats as fire-and-forget. Eight seconds is still short and still finite,
chosen only to bound how long a hung call is allowed to matter, not to protect a UI from it.

### 6. The from-address and domain are constants, not configuration

`ORDER_CONFIRMATION_FROM_ADDRESS` (`"Morchadi Gems <orders@updates.morchadijewels.com>"`) is
written once in `lib/notify-customer-email.ts`, the same way `CALLMEBOT_ENDPOINT` is a constant
in `lib/notify.ts` rather than an environment variable. `updates.morchadijewels.com` is verified
in Resend for this one purpose and is not deployment-specific the way `CASHFREE_ENV` or
`ADMIN_HOSTNAME` are — there is no sandbox/production split to parameterise, only the API key
that authenticates against it.

### 7. No unsubscribe link, and no preference centre — checked against Resend's own documentation, not assumed

This is a required transactional message — order placed, or payment confirmed — and carries no
promotional content, so it does not need one. Checked directly against
[Resend's own unsubscribe-link documentation](https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails)
rather than treated as settled by house convention: Resend states plainly that it "doesn't
manage contact lists for transactional emails" and that adding an unsubscribe header to one is
optional. CAN-SPAM draws the same line — the exemption holds only while the message stays
transactional, so this email carries an order's own facts and a tracking link and nothing that
reads as an offer.

**The one condition that would flip this is volume, not content.** Gmail and Yahoo have required
RFC 8058 one-click unsubscribe compliance for *bulk senders* — over 5,000 messages a day to
either domain — since February 2024, regardless of whether the mail is transactional. This shop
is nowhere near that volume; the day it is, this decision is the one to revisit, not before.

Building a preference centre for a message a shopper's own checkout produces was out of scope
regardless, and would have added a control surface with nothing behind it to control.

## Alternatives considered

**A single `sendOrderConfirmationEmail(order: ...)` taking a discriminated union.** The shape
the task suggested. Rejected in decision 1: it would re-encode inside itself the distinction the
two-function WhatsApp architecture keeps visible at the call site, working against the explicit
brief to mirror that architecture as closely as possible.

**Firing the paid/partial email from `/api/verify-order` on the `UPDATED` transition.**
Considered as the more "obviously idempotent" trigger — Postgres reporting a genuine status
change, rather than relying on Cashfree re-verification plus a browser-side session flag.
Rejected in decision 2 for building a second warrant mechanism where reusing the first one that
already exists costs nothing.

**Widening `composeAdminOrderMessage` to state the balance due, closing the gap in both
channels at once.** Would have made the WhatsApp message and the email consistent with each
other from day one. Rejected as out of scope for this prompt: the task was to add a new,
additive customer channel, not to modify the existing owner-facing one, and the gap has stood
since ADR-060 without operational cost — the operator can already see `amount_due` on the order
detail screen.

**A raw `fetch` to Resend's REST API, mirroring `sendOwnerWhatsApp` byte-for-byte and getting a
real `AbortSignal.timeout` in the bargain.** Would have solved decision 5's weaker-timeout
trade-off outright. Rejected because the task explicitly asked for `resend.emails.send()` and
the SDK — "follow whatever the simplest correct pattern is for calling `resend.emails.send()`"
— and the weaker timeout costs nothing given that neither call site ever awaits the outcome
for a response.

## Consequences

- A shopper gets a written record of every order in their own inbox, for all three payment
  paths, without any change to the owner-facing WhatsApp notifications.
- The partial-payment email states a balance the equivalent WhatsApp message does not — the two
  channels are now honest to different degrees about the same order, and closing that gap in
  `composeAdminOrderMessage` too remains explicitly open, exactly as ADR-060 left it.
- A Resend outage, a missing `RESEND_API_KEY`, or a shopper with no captured email address are
  all silent, logged, non-failing outcomes — a deployment with none of this configured checks
  out exactly as it did before this prompt.
- The email's timeout is enforced by a race rather than a true cancellation, so a slow Resend
  call can keep running in the background past the point this module has given up on it. Accepted,
  since neither caller ever awaits or depends on that outcome.
- `resend` is a new runtime dependency, installed and pinned in `package.json`; no other
  dependency changed.

**Addendum (prompt 106): the plain-paragraph HTML replaced with a branded, table-based template — no trigger, warrant or content decision above changed.**
`renderEmailShell` in `lib/customer-email-message.ts` now builds a 600px, table-laid-out email —
an accent-banded header carrying `public/logo.png`, an order-journey graphic (four steps, only
"Order Placed" ever filled, since there is no live shipment feed behind this email), an
order-details block, a bordered/shaded payment box, and a dark footer band — instead of the
single unstyled `<div>` shell this ADR originally shipped. Every colour and font is a literal
restated from `tailwind.config.ts` and `app/layout.tsx`, because an email client loads neither
Tailwind nor Google Fonts. Both composers gained a `createdAt: Date | null` input for the
order-details timestamp: `OrderCaptureOutcome`'s `CAPTURED` case and `CapturedOrderSummary`
(`lib/order-capture.ts`) now carry Postgres' own `created_at`, read via the `order.create` and
`order.findUnique` calls that already ran. For the COD path it travels through
`CustomerEmailDependencies` exactly as `trackingUrl` already does, since `CodOrderMessageInput`
is shared with the unrelated WhatsApp composer and was left untouched; for the paid/partial path
it is part of `PaidOrderConfirmationEmailInput` directly, alongside `trackingId` and `amountDue`,
and `DispatchOrderConfirmationEmailInput` omits it the same way it omits `trackingUrl` so
`dispatchOrderConfirmationEmail` still supplies it from the deps bag. No subject line, no wording
decision, no honesty rule and no trigger point moved — every string this ADR's decisions 2, 3
and 7 depend on is byte-identical, only its container changed.
