# Test Result: Orders and CRM schema, and the catalogue cost field — 2026-08-20

- **Plan:** *(no plan — schema verification for the addendum to
  [ADR-040](../decisions/ADR-040-postgres-for-orders.md))*
- **Commit:** working tree at `ebd3e7e` + prompt 44 changes
- **Environment:** GitHub Codespace, `postgres:16-alpine` in Docker on `localhost:5432`
  (`morchadi-gems-postgres`, healthy), Prisma 6.19.2, Node 20. No production database exists and
  none was contacted.

The migration was applied against a real Postgres and the tables were inspected with `psql`.
Nothing here is review-only.

## Gate

| ID | Result | Notes |
| --- | --- | --- |
| G-01 | Pass | `npm run typecheck` — clean |
| G-02 | Pass | `npm run lint` — no ESLint warnings or errors |
| G-03 | Pass | `npm run test:run` — **814 passed, 43 files** (was 809 / 42) |
| G-04 | Pass | `npm run validate:products` — all checks green; 49/49 products carry `pricing.cost`, gross margin 40.0–40.1% |
| G-05 | Pass | `npm run build` — 70 pages, 3 dynamic API routes, exit 0 |

Advisories printed by G-04 are unchanged in kind: 9 discount-above-house-style, 4 short
descriptions, 9 price-quoting meta strings. The new margin advisory list is **empty** — no
product is priced at or below its cost.

## Migration

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| M-01 | `npx prisma validate` | Pass | Schema valid |
| M-02 | `npx prisma migrate dev --name init_orders_crm_schema` | Pass | Created and applied `20260820062848_init_orders_crm_schema` |
| M-03 | `npx prisma migrate status` | Pass | `1 migration found`, `Database schema is up to date!` |
| M-04 | `npx prisma generate` | Pass | Client v6.19.2 generated into `node_modules/@prisma/client` |
| M-05 | Tables exist in Postgres | Pass | `\dt` lists `orders`, `order_status_history`, `order_line_items`, `customers`, `admins`, `_prisma_migrations` |
| M-06 | Columns are snake_case | Pass | `\d orders` shows `created_at`, `customer_id`, `shipping_fee`, `total_cost`, `cashfree_order_id`, `utm_source`, `shipping_address`, `is_refunded`, `refunded_at`, `refund_amount` |
| M-07 | Money is exact | Pass | Every amount column is `numeric(10,2)`; no `double precision` anywhere in the schema |
| M-08 | `order_status` is a native enum | Pass | `status` is type `order_status`, default `'placed'::order_status` |
| M-09 | `orders.id` has no database default | Pass | `\d orders` shows `id | text | not null |` with an empty Default column — the 10-char code is application-generated, in a later prompt |
| M-10 | No terminal-state booleans | Pass | `orders` has `is_refunded` and no `is_rto`, `is_returned` or `is_cancelled`; see the ADR-040 addendum |
| M-11 | Foreign keys and indexes present | Pass | FKs from `orders.customer_id`, `order_line_items.order_id`, `order_status_history.order_id`; indexes on `customer_id`, `status`, `created_at`, `cashfree_order_id` |
| M-12 | `product_id` is not a foreign key | Pass | `order_line_items.product_id` is plain `text` — the catalogue is not in this database |

## Schema-shape smoke test — `lib/prisma-schema.test.ts`

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| S-01 | A customer, order, line item and status-history row written through the generated client | Pass | All four created in one interactive transaction, read back with `include` |
| S-02 | Defaults land as declared | Pass | `status = placed`, `isRefunded = false`, `refundedAt = null`, history `reason = null` |
| S-03 | `Json` columns round-trip | Pass | `shippingAddress` and `selectedOptions` (`{ Letter: "A" }`) come back as written |
| S-04 | A terminal status plus an orthogonal refund | Pass | `status = returned` with `isRefunded`, `refundedAt`, `refundAmount` and a history row carrying a `reason` |
| S-05 | The test leaves nothing behind | Pass | Both cases roll back via a thrown sentinel; post-transaction `count()` is 0 for the throwaway phone and order id |
| S-06 | Skips rather than fails with no database | Pass by construction | Same `ctx.skip(unavailableReason)` pattern as `lib/prisma-connection.test.ts` |

## `pricing.cost` is not reachable from the browser

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| C-01 | The only catalogue data crossing to the client is `CatalogueEntry` | Pass | `toCatalogueEntry` in `lib/products.ts` is an explicit field whitelist; `getCatalogueIndex()` is the sole feed into `CartProvider` (`app/layout.tsx`) |
| C-02 | No `"use client"` file imports the catalogue | Pass | Grep across `app/`, `components/`, `lib/` for `products.json`, `getAllProducts`, `getProductById` in files carrying the directive: no hit reaches a price |
| C-03 | `getCatalogueIndex()` carries no cost | Pass | New test in `lib/money-path.test.ts` |
| C-04 | `getOrderPricingCatalogue()` carries no cost | Pass | New test in `lib/money-path.test.ts`, alongside the existing `mrp` seal |
| C-05 | **Built client chunks contain no cost** | Pass | `grep -rl '"cost"' .next/static/chunks/` → no match, after a full `npm run build` |
| C-06 | **Prerendered HTML and RSC payloads contain no cost** | Pass | `grep -rl '"cost"' .next/server/app --include=*.html --include=*.rsc` → no match |
| C-07 | Control: `mrp` *is* in the client bundle | Pass | `.next/static/chunks/app/cart/page-*.js` matches `mrp` — so C-05 is a real absence, not a broken grep |

C-05 through C-07 are the load-bearing ones. C-01 to C-04 say the code is written correctly;
C-05 and C-06 say the compiler agreed, and C-07 proves the search would have found it.

## Not covered

- No application code reads or writes these tables yet. Order capture, the admin UI and the
  tracking page are later prompts, and the 10-character order id generator with them.
- `reason` being required when a status is `rto`, `returned` or `cancelled` is stated in the
  schema's doc comment and enforced nowhere yet — it is an application-level rule and belongs to
  the prompt that writes status transitions.
- Production Postgres does not exist. `prisma migrate deploy` has never been run.
- The `pricing.cost` figures are placeholders at 60% of price. Nothing verifies them against
  reality because there is no reality to verify them against until the owner supplies real ones.
