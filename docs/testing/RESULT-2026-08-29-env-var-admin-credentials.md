# Test Result: Admin authentication and subdomain routing — 2026-08-29

- **Plan:** [PLAN-admin-auth.md](PLAN-admin-auth.md)
- **Commit:** working tree at the ADR-061 prompt
- **Environment:** GitHub Codespace, Node 24. `postgres:16-alpine` in Docker on `localhost:5432`
  (`morchadi-gems-postgres`, healthy), migration
  `20260829061318_drop_admin_table_env_credentials` applied. `ADMIN_USERNAME`/`ADMIN_PASSWORD`
  set in `.env.local` for the manual cases; `lib/admin-auth.test.ts` and the two mocked-Postgres
  suites stub their own values per test with `vi.stubEnv`. Manual cases were run against
  `npm run dev`, not a production build — this prompt does not touch anything
  `NODE_ENV`-dependent, and TC-53–56 only need a live server.

Scoped to what ADR-061 actually changed: credential storage and everything downstream of it.
Hostname routing, middleware mechanics, crawler guards and the seed-script prompt-handling
suite (TC-01–TC-40, TC-53 partially, TC-58–TC-87) are unaffected by this prompt and were not
re-run — [RESULT-2026-08-20-admin-auth.md](RESULT-2026-08-20-admin-auth.md) already covers them
and nothing in this prompt touches `middleware.ts`, `lib/admin-routing.ts` or the crawler guards.

## Gate

| ID | Result | Notes |
| --- | --- | --- |
| G-01 | Pass | `npm run typecheck` — clean, no output |
| G-02 | Pass | `npm run lint` — no ESLint warnings or errors |
| G-03 | Pass | `npm run test:run` — **1869 passed, 92 files**, 0 failed. Two pre-existing suites (`lib/admin-login-sweep.test.ts`, `lib/admin-order-database-failure.test.ts`) needed updating: they mocked `prisma.admin.findUnique` to supply credentials, which `authenticateAdmin` no longer reads at all — both now `vi.stubEnv` `ADMIN_USERNAME`/`ADMIN_PASSWORD` instead, and their actual assertions (sweep-failure-doesn't-block-login, Postgres-down-during-login) are unchanged and still pass |
| G-04 | Pass | `npm run validate:products` — `PASS — all checks green`; unrelated to this prompt |
| G-05 | Pass | `npm run build` — compiled, 475/475 static pages generated, exit 0, middleware 27.1 kB |

**A skip-count discrepancy surfaced mid-verification and was run to ground rather than assumed.**
An early re-run of `test:run` reported `1860 passed | 9 skipped` instead of `1869 passed`. Because
this prompt touched authentication itself, the possibility of a real auth check silently
skipping — rather than failing loudly — was treated as the priority hypothesis until ruled out
by direct evidence, per the standing instruction not to wave off a skip in a just-changed code
path as flakiness.

Investigation, in order: (1) confirmed no dev server was running and port 3000 was free; (2) ran
`test:run` three separate clean times with nothing else running in between, `--reporter=verbose`,
recording exact test names — all three runs skipped the **identical 9 tests**, all nine inside
one file, `lib/track-build-output.test.ts`, none in `lib/admin-auth.test.ts`,
`lib/admin-session.test.ts`, `lib/admin-orders-access.test.ts`,
`lib/admin-login-sweep.test.ts` or `lib/admin-order-database-failure.test.ts` — those five files'
admin-specific assertions passed **56/56 in every one of the three runs**, with no variance; (3)
confirmed zero occurrences of the "no database at DATABASE_URL" skip guard in any run, and
Postgres's own connection count returned to its pre-run baseline (6) afterward — the DB-backed
session code (`createAdminSession`/`readAdminSession`/`sweepExpiredAdminSessions`, still
Postgres-backed per ADR-061) was exercised for real in all three runs, not silently skipped; (4)
each skip's own message named the cause: `.next/BUILD_ID is not there — run npm run build first,
and after any next lint`, and `.next/BUILD_ID` was confirmed absent at that moment — the file's own
docstring documents that `next lint` can leave a previous build's `.next` half-standing, and a
prior, unrelated prompt's result
([RESULT-2026-08-28-cod-order-notification.md](RESULT-2026-08-28-cod-order-notification.md))
already recorded the identical "9 skipped" figure with the identical explanation, months before
this prompt existed. The mechanism here was this session's own `npm run dev`, run afterward for
the manual login verification below, invalidating the `.next` a prior `npm run build` had
produced. (5) **Conclusion: (a), genuine and fully explained — not a defect in this prompt's
code.** Confirmed definitively by rebuilding and running `test:run` immediately afterward with
nothing in between: `1869 passed, 0 skipped`, reproduced twice more including in the final gate
recorded above. The skip is a deterministic, pre-existing property of one build-artifact-reading
test file, keyed to `.next` freshness, unconnected to `ADMIN_USERNAME`/`ADMIN_PASSWORD`,
`authenticateAdmin`, or any session code this prompt touched.

## Cases

### Authenticating an admin (`lib/admin-auth.test.ts`)

| ID | Result | Notes |
| --- | --- | --- |
| TC-41–TC-49 | Pass | Re-verified against env-var credentials: right credentials accepted, case/whitespace-insensitive username, wrong password rejected, unknown username rejected identically, empty fields rejected, byte-identical failure body, no echo, `no-store`, case-insensitive username on the live endpoint |
| TC-46 | Pass | Both the wrong-password and unknown-username paths still take at least `FAILED_LOGIN_FLOOR_MS` (600 ms) |
| TC-50 | Pass | A one-character and a 500-character password are both rejected exactly like a same-length wrong password — no length-based early return. Code-reviewed: `timingSafeStringEqual` hashes both sides to a fixed 32 bytes with SHA-256 before calling `crypto.timingSafeEqual`, so the underlying comparison always runs on equal-length buffers regardless of input length, matching the PLAN's stated approach of confirming the property rather than measuring nanosecond timing in CI |
| TC-50a | Pass | Unset `ADMIN_USERNAME`, unset `ADMIN_PASSWORD`, and both unset together all reject — fails closed — with the same message and the same ≥600 ms floor as a wrong password. A blank (whitespace-only) `ADMIN_USERNAME` is treated the same as unset |
| TC-51–TC-52 | Pass | Logout ends the session server-side and clears the cookie; logout with no session still returns `SIGNED_OUT` |
| New | Pass | The login endpoint answers byte-identically whether `ADMIN_USERNAME`/`ADMIN_PASSWORD` are configured-but-wrong or entirely unset |

### Sessions (`lib/admin-session.test.ts`, `lib/admin-orders-access.test.ts`)

| ID | Result | Notes |
| --- | --- | --- |
| TC-26–TC-40 | Pass | Session create/read/expire/destroy/sweep and cookie-attribute cases, now against `AdminSession.adminId` as a plain string rather than a foreign key. `readAdminSession`'s returned `username` is re-derived from `ADMIN_USERNAME` on every read (there is no stored username to join to); the one test asserting the returned identity now stubs `ADMIN_USERNAME` to make that explicit |
| TC-54 (automated half) | Pass | `lib/admin-orders-access.test.ts`'s "renders for a live session rather than redirecting" now creates its fixture session directly against `ADMIN_IDENTITY_ID` instead of a throwaway `Admin` row, since there is no `Admin` table left to create one in |

### Route protection, manual (TC-53–TC-56)

Run against `npm run dev` with `ADMIN_USERNAME=adminmorchadi2026` / `ADMIN_PASSWORD=admin@morchadi2026` from `.env.local`, via `curl` standing in for a browser (cookie jar carried by hand between requests).

| ID | Result | Notes |
| --- | --- | --- |
| TC-41 (live) | Pass | `POST /admin/api/login` with the correct pair → `200 {"status":"SIGNED_IN"}`, `Set-Cookie: morchadi_admin_session=…; Path=/; HttpOnly; SameSite=lax`, 7-day `Expires` |
| TC-43/44 (live) | Pass | Wrong password and unknown username both → `401`, no `Set-Cookie` |
| TC-54 | Pass | `GET /admin/orders` with the session cookie → `200`. `GET /admin` → `307` to `/admin/orders` (the root page's own redirect, unrelated to auth) and the rendered payload contains `"Signed in as adminmorchadi2026"` from `AdminNav`, proving the session resolved to the env-configured identity end to end |
| TC-55 | Pass | `POST /admin/api/logout` → `{"status":"SIGNED_OUT"}`; the **same** cookie against `GET /admin/orders` afterward → `307` to `/admin/login`, confirming server-side revocation, not just a cleared cookie |

## Summary

**All gate commands green. 1869/1869 tests passing (2 suites updated, 0 skipped beyond the
pre-existing Postgres-unavailable skip guards). Manual login/logout verified live.** Shippable.

The two things this result does not cover — because ADR-061 explicitly did not touch them —
are DNS/Coolify wiring for `admin.morchadigems.com` (still pending, per ADR-041) and the
seed-script prompt-handling suite, now historical per the note added to
[PLAN-admin-auth.md](PLAN-admin-auth.md#seed-script).
