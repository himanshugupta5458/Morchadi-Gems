# syntax=docker/dockerfile:1

# Production image for Coolify / Docker (ADR-032). Not used by `npm run dev`.
#
# Built on Next.js `output: "standalone"`, which emits a self-contained server at
# .next/standalone/server.js carrying only the traced node_modules it actually needs.
# Standalone does NOT include public/ or .next/static — both are copied explicitly in the
# runner stage below. Omit either and every image, font and JS chunk 404s in production.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat


# ---------- deps: install once, cached on the lockfile alone ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./

# The full install, dev dependencies included. `next build` needs typescript, tailwindcss,
# postcss and eslint, and `sharp` must be installed here for Next's build trace to copy it
# into .next/standalone — it is what optimises next/image in production. Switching this to
# `npm ci --omit=dev` builds a green image whose product photos are all broken.
RUN npm ci


# ---------- build: produce .next/standalone, .next/static ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The generated Prisma Client, without which `npm run build` fails type-checking on the first
# `import type { OrderStatus } from "@prisma/client"`. It cannot happen in the deps stage: that
# stage carries only the lockfile, so @prisma/client's own postinstall finds no schema and
# silently generates nothing. Here prisma/schema.prisma has arrived with `COPY . .` above, and
# generate reads that file alone — no DATABASE_URL, no migrations, no database. DATABASE_URL is
# runtime-only by deliberate choice (ADR-047) and stays absent from this stage.
RUN npx prisma generate

# Build-time only. Next inlines every NEXT_PUBLIC_* into the client bundle, and the sitemap,
# robots.txt, canonical tags and JSON-LD @ids are prerendered here — so the base URL has to be
# correct at build time, not just at runtime. No secret is ever passed as a build ARG: an ARG
# value is readable in the image history.
ARG APP_BASE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_WEB3FORMS_KEY
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV APP_BASE_URL=$APP_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_WEB3FORMS_KEY=$NEXT_PUBLIC_WEB3FORMS_KEY
# The GA4 measurement id, listed as a build variable in DEPLOY.md §3 since ADR-039 but never
# declared here, so Coolify passed a --build-arg this file did not accept and Docker discarded
# it. Unset it inlines as an empty string and GoogleAnalytics renders nothing, which is the
# behaviour the image already had; declared, a configured id now actually reaches the bundle.
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ---------- runner: the shipped image ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The standalone server binds to HOSTNAME. Left at its default it listens on localhost only,
# which is unreachable from outside the container and reads as a dead app to Coolify's proxy.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# The three copies, in the order the layout requires. `public` and `.next/static` are the
# standalone gotcha: the build output contains neither. The generated Prisma Client is NOT a
# fourth: Next's build trace resolves node_modules/.prisma/client and copies it into
# .next/standalone itself, query-engine binary included. Verified, not assumed — see ADR-047.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# A liveness probe, and deliberately only that: it asks whether this process is serving, not
# whether the shop is well. `/` renders from data/products.json and needs no database, which is
# exactly why it is the right target — Postgres going away for thirty seconds must not stop a
# container that can still serve every page and take every payment.
#
# The question this cannot answer — can the deployment actually reach and use its database —
# is answered by /api/health, which returns 503 when it cannot. That route is for a human and
# for an uptime monitor, and must NOT be wired up here or in Coolify's own health check
# setting: doing so couples the storefront's uptime to Postgres and takes the shop down for a
# fault it was designed to survive. See ADR-048 and §5b of DEPLOY.md.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "server.js"]
