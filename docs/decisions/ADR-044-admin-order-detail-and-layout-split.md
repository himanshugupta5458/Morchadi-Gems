# ADR-044: The order detail screen, and the layout split that let it have one

- **Status:** Accepted
- **Date:** 2026-08-20
- **Prompt:** 50

## Context

[ADR-043](ADR-043-order-id-as-primary-identifier.md) shipped the admin order *list* and linked
every row to `/admin/orders/{id}`, a page that did not exist. This is that page, and it is the
first screen in the project that **writes** to Postgres on an operator's behalf. Everything
before it either read (`/admin/orders`) or was written by a shopper's own checkout.

That changes three things at once, and each of them needed deciding before a control could be
drawn:

1. **Where the lifecycle lives.** `OrderStatus` is a Postgres enum with seven values and no
   ordering. Nothing in the database stops an order going from `placed` straight to
   `returned`, or from `cancelled` back to `packed`. Somebody has to hold the rule.
2. **What a bad ending has to carry with it.** The owner was explicit: an order that is
   cancelled, turned around or returned must record *why*, and must settle the refund question
   in the same act rather than leaving it for a second visit.
3. **What the panel looks like.** [ADR-041](ADR-041-admin-subdomain-and-auth.md) put the panel
   under `app/admin/`, inside the storefront's root layout, and said so in a comment in
   `app/admin/layout.tsx`: separating the two "belongs with the prompt that builds the
   order-management UI rather than this one". Until then it cost a stray header. On a screen
   with a status dropdown in the bottom-right corner, the floating WhatsApp button sits on top
   of the control.

## Decision

### The storefront moves into a route group, and the two shells become siblings

`app/layout.tsx` is now the document and nothing else: one `<html>`, one `<body>`, the two
typefaces, `globals.css` and `metadataBase`. Everything shopper-facing that used to live there
— header, footer, WhatsApp button, cart provider, toast host, GA4, UTM capture, the site schema
graph, and the whole of the Open Graph and title metadata — moved down into
`app/(storefront)/layout.tsx`, and every storefront route moved into that group with it.

**A nested layout cannot decline an ancestor.** That is the whole reason a dedicated
`app/admin/layout.tsx` was never going to be enough on its own, and it is the question the
prompt asked to have confirmed: no arrangement of layouts *below* `app/layout.tsx` can remove
what `app/layout.tsx` renders. Only moving the chrome out of the root does that, and a route
group is how it moves without a single URL changing — `(storefront)` contributes no path
segment, so `/shop` is still `/shop`.

**One root layout, not two.** Next also permits deleting `app/layout.tsx` entirely and giving
each group its own root layout with its own `<html>`. That was rejected: it buys nothing here
(both shells want the same document, the same fonts and the same stylesheet), it moves
`favicon.ico` and the global 404 onto shakier ground, and it makes every navigation between the
shop and the panel a full document load for no gain. The panel already reloads across that
boundary because it is a different hostname.

`app/admin/layout.tsx` is now a shell in its own right, and it wraps **both** halves of the
panel — the login page at `app/admin/login`, which is deliberately outside the `(protected)`
group, and everything inside it. A login screen with a shop header on it was the same bug
wearing a different hat, and it is fixed by the same mechanism rather than by a second one. The
panel also gets its own title template (`%s · Morchadi Gems admin`) instead of inheriting the
shop's.

### The global 404 moves into the storefront group, behind a catch-all route

This is the part of the split that is not obvious, and it is worth writing down because the
first attempt got it wrong twice.

Next resolves an address matching no route against `app/not-found.tsx`, at the root of the file
tree and above both groups. A 404 written there is outside the shop's layout and has to
reassemble the chrome itself — but worse, **whatever tree it renders is serialised into the
payload of every route in the application**, as the subtree to swap in should that page call
`notFound()`. Measured on the login page: 22 KB of a 39 KB response was the shop header, the
footer, the WhatsApp button and the entire catalogue index, invisible on screen and travelling
with every admin page.

Moving the 404 into `app/(storefront)/not-found.tsx` alone does not work either — Next does not
consult a group's `not-found` for an address that matched no route at all, and an unknown URL
fell through to Next's built-in error screen. So:

- `app/(storefront)/[...unmatched]/page.tsx` is a route whose entire body is `notFound()`. It
  is the lowest-priority match in the router, so only an address nothing else claimed reaches
  it, and reaching it *inside* the group means the group's `not-found` is the nearest boundary.
- `app/(storefront)/not-found.tsx` is the shop's 404, rendered inside the shop's layout.
- `app/admin/not-found.tsx` is the panel's own, which an unknown order number lands on.

The admin login page is now 10 KB, and contains no `wa.me`, no `site-schema` and no catalogue.

### The lifecycle is one table, read twice

`lib/order-transitions.ts` holds `ORDER_STATUS_TRANSITIONS`, and it is the only statement of
what may follow what:

| From | May become |
| --- | --- |
| `placed` | `packed`, `cancelled` |
| `packed` | `shipped`, `cancelled` |
| `shipped` | `delivered`, `rto`, `cancelled` |
| `delivered` | `returned` |
| `rto`, `returned`, `cancelled` | nothing |

Three rows of that table are decisions rather than defaults:

**`cancelled` is reachable from `shipped`.** The owner said cancellation can happen "at any
stage after placed" and did not exclude `shipped`. A parcel in a courier's van is genuinely
cancellable — the operator calls the courier, the money goes back, and what the parcel does
afterwards is an RTO the order no longer cares about. Reading the owner's words as
"before dispatch only" would have been the code narrowing a business rule that had already been
decided the other way, so it is not narrowed, and a test asserts the `shipped → cancelled` edge
by name so it cannot be removed later as an apparent oversight.

**`returned` is reachable only from `delivered`.** A parcel refused at the door never arrived,
and that is `rto`. A return is a customer who received the goods and sent them back. The two
need different money and different questions asked of the courier.

**The three bad endings lead nowhere**, and `delivered` leads only to `returned`. There is no
un-cancel: an order that reached the wrong ending is a row to correct in the database with its
audit trail intact, not a button that quietly rewrites history.

### The rule is enforced in the UI **and** on the server

The dropdown offers only `nextOrderStatuses(current)`, so an invalid move cannot be selected.
`planOrderStatusChange` — the same pure function the form calls — runs again inside the route
handler before anything is written.

The prompt asked whether the server check was reasonable scope or overbuilding. **It is
reasonable, and it is not really a second implementation.** The form is HTML, the operator holds
a session cookie, and `curl -X POST` with that cookie is one line. Both callers read the same
constant, so the cost is a function call rather than a duplicated rule, and what it buys is the
difference between "the lifecycle is a property of the dropdown" and "the lifecycle is a
property of the order". Every rejection is a typed error code with a sentence attached, which is
what makes the endpoint testable at all.

The update is also guarded on the status the plan was made against
(`updateMany({ where: { id, status: currentStatus } })`). If the order moved between the read
and the write, nothing is written and the operator is told to reload, rather than being shown a
success for a decision made about a different order state.

### A bad ending carries a reason and a refund decision, in one transaction

`rto`, `returned` and `cancelled` require a reason (300 characters, checked on both sides) and
force a refund decision. `placed`, `packed`, `shipped` and `delivered` require neither, and the
refund columns of an order moved to one of those are **not touched at all**.

The refund question is asked differently depending on what was collected:

- **`cod`** — nothing was prepaid, so there is no amount to enter. The panel shows a statement
  ("No refund needed. This was COD and no payment was collected up front.") and a checkbox the
  operator has to tick. Any amount such a submission happens to carry is ignored. This satisfies
  the owner's "reason will be captured for both" without inventing a number.
- **`prepaid` / `partial_cod`** — an amount field, prefilled with `amountPrepaid` as a
  suggestion, adjustable down for a partial refund, and capped at `amountPrepaid` rather than at
  `total`. You cannot give back money that was never collected, which is the distinction that
  matters on a `partial_cod` order.

All of it is one form submission, one handler and one `prisma.$transaction`: the `orders` row
and the `order_status_history` row are written together or not at all. A crash between them
would otherwise leave an order that moved with nobody's name against it.

### `isRefunded` is derived from the amount, not chosen beside it

`refundAmount > 0 → isRefunded = true`. `refundAmount = 0 → isRefunded = false`.

The prompt asked whether this derivation makes sense or whether `isRefunded` should be an
independent choice. It should not. An independent flag buys exactly one new capability: writing
down `isRefunded = true` beside `refundAmount = 0`, or the reverse. A column whose only extra
power is to contradict the column next to it is the precise shape
[ADR-040's addendum](ADR-040-postgres-for-orders.md#addendum--prompt-44-a-terminal-status-is-stated-once-and-pricingcost-joins-the-catalogue)
deleted six columns to make unwritable. A refund is money moving; the amount is the fact, and
the flag is a reading of it.

**`refundedAt` is set only when money actually moved.** The prompt's sketch had `refundedAt =
now` on every refund decision including a zero one, and that is the one instruction here that
was not followed literally: ADR-040 records the invariant `isRefunded ≡ refundedAt IS NOT NULL`,
and a timestamp on a refund that never happened would say a refund occurred on a day nothing
did. A zero decision is still recorded — `refundAmount` becomes `0`, which is distinct from the
`null` of an order nobody has decided about — and *who* decided and *why* are in the history
row that the same transaction wrote.

### The shipping address is editable before dispatch, and audited in `order_status_history`

Editable while the order is `placed` or `packed`; read-only from `shipped` onwards and in every
terminal state. The owner's reasoning is that a corrected address is only useful while somebody
can still write it on the label. The panel renders plain text rather than a disabled control,
because a greyed-out button invites an operator to hunt for the reason it is greyed out and the
sentence that replaces it is that reason. The window is enforced in the handler too, for the
same reason the lifecycle is.

An edit is validated by `validateAddressForm` — the storefront's own checkout validator, reused
rather than reimplemented, so a corrected address is held to exactly the standard the original
was. The form itself is the storefront's `AddressForm` component, which gained one optional
`submitLabel` prop for this.

**The audit row goes in `order_status_history`, carrying the order's unchanged status.** The
prompt offered a choice between that and "a lightweight audit note appended to the order", and
this is the cleaner fit for a plain reason: the event needs exactly four facts — when, who,
what changed, and what state the order was in — and that table already has all four columns.
The alternative needs a migration, either a free-text column on `orders` (which holds one note,
or grows an unbounded string) or a whole new table bought for a single event type. A reader of
the timeline sees `14:02 · Packed · himanshu · Address updated (line1, pincode)`, which is a
true sentence, and the reason names the fields that moved so a fixed PIN code is distinguishable
from a completely different recipient. An edit that changes nothing writes nothing: an audit
trail full of rows recording that somebody opened a form and pressed save is an audit trail
nobody reads.

### The two receipt flags are independent of everything, including each other

`itemReceivedBack` / `itemReceivedBackAt` appear once the status is `rto` or `returned`.
`codAmountCollected` / `codCollectedAt` appear when the payment type is `cod` or `partial_cod`.
Each toggle posts only its own field, so neither can clear the other, and each stamps its own
timestamp when ticked and clears it when unticked.

Neither writes a history row. Unlike an address edit — which overwrites customer data, leaving
no trace of the old value — these two carry their own timestamp on the `orders` row, so the row
already records what happened and when. A second copy in the audit table would be the
duplication ADR-040's addendum argues against.

### Three JSON endpoints, not one, and not a server action

`POST /admin/api/orders/{id}/status`, `/address` and `/receipt`. Separate routes rather than one
handler switching on an intent, because they validate different things and refuse for different
reasons: the status endpoint asks the lifecycle, the address endpoint asks whether the parcel
has left, the receipt endpoint asks what kind of order this is.

They take JSON and are called with `fetch`, which is the shape `/admin/api/login` already
established and the reason its ADR could say a CSRF token was not yet needed: a cross-site
`<form>` cannot send `application/json` without a preflight the browser will not grant, and the
session cookie is `SameSite=Lax`, which does not ride a cross-site POST at all. Each handler
resolves the session against Postgres itself; middleware's cookie-presence gate is not
authentication and these routes are deliberately absent from `PUBLIC_ADMIN_PATHS`.

The cost, stated plainly: **the detail page's controls need JavaScript**, where the order list
ships none. That is a real step down from the list's standard, and it is taken because the two
things this screen must do — reveal the reason and refund fields the moment an unhappy status is
chosen, and reuse the storefront's live-validating address form — are interactive by nature. The
submit path is still a single POST to a route handler that re-validates everything, so nothing
about correctness depends on the browser.

## Alternatives considered

**A second root layout for the admin panel (deleting `app/layout.tsx`).** Rejected above:
identical result for the chrome, more moving parts, and it complicates `favicon.ico` and the
global 404 for no benefit.

**Leaving the storefront 404 at the root and accepting the payload.** Rejected once it was
measured. 22 KB of shop chrome and the whole catalogue index on every admin page is not visible,
but it is real, and "the button is not rendered" is a weaker claim than "the button is not in
the response".

**Server Actions instead of route handlers.** They would remove the `fetch` layer and give
progressive enhancement. Rejected for consistency: the panel already authenticates through a
JSON route handler, and adding a second server-mutation mechanism for the same panel is the
thing ADR-041 avoided when it refused a second auth mechanism. Route handlers are also directly
testable as functions, which is how the 401 path is covered.

**A `status` transition constraint in Postgres.** A trigger could enforce the lifecycle in the
database. Rejected as premature: the rule is stated once in TypeScript and read by both callers,
a trigger would be a third statement of it in a third language, and the migration history is a
worse place to iterate on a business rule the owner is still shaping.

**Making the refund a separate step after the status change.** Explicitly refused by the owner,
and the transaction is what makes the refusal real rather than a convention.

## Consequences

**What this makes easy.** Adding a screen to the panel is now adding a file under
`app/admin/(protected)/`, with no shop chrome to fight and no metadata to override. Adding a
lifecycle rule is editing one table in `lib/order-transitions.ts`, and both the dropdown and the
endpoint follow. The audit trail answers "what has been done to this order" in one query,
including address corrections.

**What this makes harder.** Anything shopper-facing added to `app/layout.tsx` reaches the panel
again, and the test at `lib/admin-layout-shell.test.tsx` is what catches it. The
`[...unmatched]` catch-all is a route that exists for a framework reason rather than a product
one, and it will look like dead code to anyone who does not read its docstring. The detail
page's controls need JavaScript.

**What would force a revisit.** A second operator, which turns the `updateMany` status guard
from a courtesy into load-bearing concurrency control and probably wants optimistic-lock
versions on the row. A refund that is issued through Cashfree's API rather than recorded by
hand, which makes `refundAmount` an outcome to reconcile rather than a number to type. A
partial return on a multi-item order, which ADR-040 already names: that is a per-line-item state
and wants a column on `order_line_items`, not more booleans on `orders`.
