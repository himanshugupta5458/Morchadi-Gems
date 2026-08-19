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

# Build-time only. Next inlines every NEXT_PUBLIC_* into the client bundle, and the sitemap,
# robots.txt, canonical tags and JSON-LD @ids are prerendered here — so the base URL has to be
# correct at build time, not just at runtime. No secret is ever passed as a build ARG: an ARG
# value is readable in the image history.
ARG APP_BASE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_WEB3FORMS_KEY
ENV APP_BASE_URL=$APP_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_WEB3FORMS_KEY=$NEXT_PUBLIC_WEB3FORMS_KEY
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
# standalone gotcha: the build output contains neither.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "server.js"]
