# The admin panel shows a different customer name from the address on the same order

- **Date:** 2026-08-20
- **Prompt:** 53
- **Severity:** Major
- **Status:** Resolved

## Symptom

Reported against order `PQS8PSSGBC` in the local development database as a "customer name
discrepancy". The admin order detail screen headed the order with one name while the shipping
address panel below it showed another, and searching the admin order list for the name on the
address returned nothing.

## Investigation

**1. Read the row that was reported.** `PQS8PSSGBC` is internally consistent — both its
`customer.name` and its own `shipping_address.name` read `Test user`:

```
shippingAddress: { name: "Test user", line1: "43t5yt", line2: "536",
                   city: "675", pincode: "202020", state: "Jharkhand" }
customer:        { name: "Test user", phone: "8939149209" }
```

`line1: "43t5yt"` and `city: "675"` are keyboard mashing, so `Test user` on this order is what
somebody typed, not something the code substituted. The customer row was also created 63 ms
before the order (`11:49:02.538Z` against `11:49:02.601Z`), so it was minted *by* this checkout
and is not a stale row from an earlier one. **There is no bug in the order that was reported.**

**2. Rule out a placeholder leaking into a value.** `grep -rn "Test user"` across `*.ts`,
`*.tsx`, `*.mjs` and `*.json` returns nothing — the string is not in the source at all.
`EMPTY_ADDRESS_FORM` initialises every field to `""`, and the name field's `placeholder` is
`"Ananya Iyer"`, which is an HTML placeholder attribute and cannot be submitted as a value.
Ruled out.

**3. Rule out the capture reading the wrong field.** Traced `app/(storefront)/address/page.tsx`
→ `AddressCheckout` → `writeCheckoutData` → `/payment` → `POST /api/create-order`, where
`validateAddressForm` produces the `address` that `captureOrder` receives, and
`lib/order-capture.ts` writes `name: input.address.name`. One field, one hop, no aliasing.
Ruled out.

**4. Compare every customer against every order they placed.** This is the step that found it.

```
customer 8939149209 | name: "Test user"
    order PQS8PSSGBC  | address.name: "Test user"       (matches customer)
    order KRYXCMSN89  | address.name: "Himanshu Gupta"   *** DIFFERS ***
```

A second order from the same phone, five hours later, was placed under a real name. The
`customers` row still said `Test user`. Autofill is not involved: the address on `KRYXCMSN89`
carries the name that was actually submitted — it is the `customers` row that did not move.

## Root cause

`captureOrder` finds a customer by phone and, when it finds one, **writes nothing to it**. The
name and email were set once, at the row's creation, and no later order revisited them.

```ts
const existingCustomer = await client.customer.findUnique({
  where: { phone: input.address.phone },
  select: { id: true },
});

const customerId = existingCustomer?.id ?? (await client.customer.create({ ... })).id;
```

This was correct for the first-touch UTM columns beside it — the campaign that won somebody is
a historical event and must survive every later purchase (ADR-039) — and the same treatment was
extended to the name, which is the opposite kind of fact. A name is a current description of a
person, and the *oldest* one is the wrong answer.

The visible symptom follows from where each name is read. `lib/admin-orders.ts` and
`lib/admin-order-detail.ts` both select `customer: { select: { name: true } }` for the list and
the detail header, and the admin search matches `customer.name`; the address panel renders the
order's own `shipping_address`. So one screen showed two names for one order, and the real one
was not searchable.

Whoever typed `Test user` into a throwaway checkout did not corrupt that order — they pinned
the name of that phone number for every order it would ever place again.

## Fix

`lib/order-capture.ts` — a returning customer's `name` and `email` are now refreshed from the
order being placed, in a new `refreshCustomerContactDetails` helper:

- The lookup selects `name` and `email` alongside `id`.
- The update runs only when one of them has actually changed, so an ordinary repeat order still
  writes nothing and does not churn `updated_at` on a row nothing about which moved.
- An email is only ever upgraded: a submitted address with no email leaves a stored one alone.
- The first-touch UTM columns are untouched, and remain create-only.
- Each order's own `shipping_address` is untouched. It is a per-parcel snapshot, and a later
  order must not rewrite an earlier one's label.

## Verification

Six cases added to `lib/checkout-capture-route.test.ts`, driving the real `/api/create-order`
route against the real local Postgres. With the fix reverted, three of them fail with exactly
the reported symptom:

```
× is corrected by a later order rather than frozen at the first one
    AssertionError: expected 'Test user' to be 'Himanshu Gupta'
× takes a corrected email too, and never forgets one it already has
    AssertionError: expected 'typo@example.com' to be 'correct@example.com'
× does not disturb the campaign that won the customer
    AssertionError: expected 'Test user' to be 'Himanshu Gupta'
   Tests  3 failed | 8 passed (11)
```

With the fix in place, 11/11 in that file and 1226/1226 across the suite.

**The existing rows are not migrated.** Customer `8939149209` in the development database still
reads `Test user` until an order is placed from that phone under a real name, at which point
the fix corrects it. Production is unaffected in the sense that it has no such row yet; any
that exist there will self-correct on the customer's next order.

## Prevention

The regression tests above are the guard, and the first of them — *"is the exact name submitted,
on a first order"* — asserts against `""`, `"Test user"` and the form's own `"Ananya Iyer"`
placeholder by name, so a future default leaking into a value fails there rather than being
discovered in the admin panel months later.

The wider lesson is in the ADR-039 comment that this bug grew out of: **"written only when the
row is created" is a decision that has to be made per column, not per table.** The docstring on
`captureOrder` now says which columns are first-touch and which are current-state, and why they
differ.
