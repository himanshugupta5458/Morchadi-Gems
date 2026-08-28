# Docker build fails type-checking on `Cannot find module '@/scripts/keyword-normalisation.mjs'`, while the same commit builds clean locally

- **Date:** 2026-08-28
- **Prompt:** 98
- **Severity:** Blocker
- **Status:** Resolved

## Symptom

A Coolify deployment failed in the builder stage. `next build` reached its type-checking
phase and stopped:

```
./lib/keyword-collision-check.ts:5:8
Type error: Cannot find module '@/scripts/keyword-normalisation.mjs' or its corresponding type
declarations.
```

The same commit passed `npm run typecheck` and `npm run build` in the Codespace with no
errors. Production was unaffected — the previous image kept serving, and the failure was
caught before anything went live.

## Investigation

1. **Confirmed the import is real, not a leftover.** `lib/keyword-collision-check.ts:5`
   imports `canonicaliseKeyword` and `looselyNormaliseKeyword` from
   `@/scripts/keyword-normalisation.mjs`. Commit `e493e4c` introduced it deliberately: the
   keyword rules have one implementation, written as plain ESM so both the typed `.ts` module
   and `scripts/validate-products.mjs` can consume it. So the module has to exist at build
   time; deleting the import was never an option.

2. **Ruled out a path-alias or `moduleResolution` difference.** `tsconfig.json` is copied
   into the image by `COPY . .` and is byte-identical to the local one — same `paths`
   (`"@/*": ["./*"]`), same `"moduleResolution": "bundler"`, same `"allowJs": true`. Nothing
   about resolution configuration differs between the two environments.

3. **Ruled out the Prisma-generate class of failure (ADR-047).** That one fails on
   `@prisma/client` exports, not on a repository-relative path, and `npx prisma generate`
   runs and succeeds in the builder stage.

4. **Looked at what the builder can actually see.** `COPY . .` copies the *build context*,
   not the working tree, and `.dockerignore` decides what the build context contains. It
   listed:

   ```
   # not read by the production build
   docs
   scripts
   ```

   That comment was true when it was written. `e493e4c` made it false without touching
   `.dockerignore`, and nothing connected the two.

5. **Checked whether the local gate could ever have caught this.** It could not.
   `.dockerignore` is read only when a build context is assembled; `npm run typecheck` and
   `npm run build` in the Codespace run against the real filesystem, where `scripts/` is
   present. A green local gate carries no information about this failure mode.

6. **Checked whether one negation line would be enough.**

   ```bash
   grep -rn '"@/scripts/' --include="*.ts" --include="*.tsx" app/ lib/ components/
   ```

   Ten hits, but nine are `.test.ts` files, which `.dockerignore` already excludes via
   `**/*.test.ts` — absent from the context, so `tsc` never type-checks them there and they
   cannot demand their imports. `lib/keyword-collision-check.ts` is the only non-test file.
   A wider grep across `app/ lib/ components/ config/ types/` for any `scripts/` mention
   found the rest are prose in comments, not imports. `scripts/keyword-normalisation.mjs`
   itself has no imports at all — 57 self-contained lines — so re-including it pulls in
   nothing else.

## Root cause

`.dockerignore` excluded `scripts/` wholesale on the premise that the production build never
reads it. Commit `e493e4c` broke that premise by making one file in `scripts/` a runtime
import of `lib/`, and the exclusion was not revisited. The build context therefore arrived in
the builder stage without a module that `next build` requires.

The surface error says "cannot find module". The mechanism is that the file was never copied
in — it exists in git, it exists in the working tree, and it is absent from the only
filesystem the builder can see.

## Fix

`.dockerignore` only. `scripts` stays excluded, and the single required file is re-included
with a negation pattern:

```
docs
scripts
!scripts/keyword-normalisation.mjs
```

Removing `scripts` from `.dockerignore` altogether was rejected: most of it is batch pipeline
and one-off migration tooling with no business in the production image, and blanket-including
it works against the same build-context-weight discipline that keeps `content-pipeline/`
(124 MB) out. The comment above the line now records *why* the exception exists and which
commit created the dependency, so the next person to tidy it up finds the reason before the
delete key.

## Verification

Three builds, in order.

**1. A throwaway probe, to test the negation pattern itself rather than assume the documented
syntax works on this BuildKit.** An `alpine` image with `COPY . .` against the same context,
listing what arrived:

```
--- scripts/ in context ---
total 12
drwxrwxrwx    2 root     root          4096 Aug 28 10:11 .
drwxr-xr-x    1 root     root          4096 Aug 28 14:40 ..
-rw-rw-rw-    1 root     root          2268 Aug 28 10:06 keyword-normalisation.mjs
--- docs/ in context (should be absent) ---
ls: docs/: No such file or directory
--- content-pipeline (should be absent) ---
ls: content-pipeline: No such file or directory
```

Exactly one file in `scripts/`, and the other exclusions intact. Docker 29.3.0, buildx
0.32.1 — exclude-then-negate resolves last-match-wins as documented, on this version.

**2. The real production image**, which is the check that matters:

```bash
docker build -f Dockerfile -t morchadi-gems-test:verify . \
  --build-arg APP_BASE_URL=https://morchadigems.com \
  --build-arg CASHFREE_ENV=production
```

`DOCKER BUILD EXIT: 0`, and the phases that matter:

```
#17 51.94  ✓ Compiled successfully
#17 51.94    Linting and checking validity of types ...
#17 78.04    Collecting page data ...
#17 121.4  ✓ Generating static pages (475/475)
#17 121.4    Finalizing page optimization ...
#17 DONE 132.0s
#22 naming to docker.io/library/morchadi-gems-test:verify done
```

The type-checking phase now runs to completion — `grep -c "Cannot find module\|Type error"`
over the whole build log returns **0** — and the static page count is intact at **475/475**.

**3. A negative control, to prove the negation line is what changed the outcome** rather than
some incidental cache or rebuild effect. The same probe against the same context, with only
`!scripts/keyword-normalisation.mjs` stripped out of the ignore file:

```
--- scripts/ WITHOUT the negation line ---
ls: scripts/: No such file or directory
```

One line accounts for the entire difference between an absent directory and the one file the
build needs.

Cashfree credentials were deliberately left unset for this build. They are runtime values and
play no part in type-checking; their absence proves nothing about the fix either way.

The five-command local gate was run as usual and is green — `typecheck` clean, `lint`
`✔ No ESLint warnings or errors`, `test:run` **87 files / 1774 tests passed**,
`validate:products` **PASS — all checks green**, `build` exit 0. Note that it was green
*before* this fix too. For this class of bug the local gate is necessary and not sufficient,
which is the whole reason the Docker build was added to the gate for this change.

## Prevention

The generalisable lesson is that **`.dockerignore` is a dependency declaration, and nothing
type-checks it.** A `# not read by the production build` comment is an assertion about the
import graph that no tool re-verifies when the import graph changes.

Three things reduce the chance of a repeat:

- The comment in `.dockerignore` now names the importing file and the commit, so the
  exception survives a future cleanup pass.
- `DEPLOY.md` section 7 has a troubleshooting row keyed on the exact error text, pointing at
  `.dockerignore` rather than at the import.
- **Any future `@/scripts/*` import from a non-test file under `app/`, `lib/` or
  `components/` needs its own negation line in the same breath as the import.** If that list
  ever grows past two or three, the exclusion should be inverted — ignore `scripts/` by
  explicit subdirectory and keep the shared modules in a directory that is never excluded.

A local `npm run build` will never catch the next one of these. Building the actual image is
the only check that reproduces what Coolify does.
