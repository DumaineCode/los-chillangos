# syntax=docker/dockerfile:1.7

# Los Chillangos — Next.js 15 + Payload CMS production image.
#
# Multi-stage build tuned for: pnpm@11 (pinned), sharp/libvips native binaries,
# and Next.js standalone output. Postgres and R2 media storage are EXTERNAL —
# this image only runs the app server.
#
# Debian "slim" base (not Alpine) on purpose: sharp + Payload behave more
# reliably against glibc than musl.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
# Base — enable pnpm via corepack so the pinned packageManager version is used.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Deps — install full dependency tree (cached on lockfile changes only).
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Builder — generate Payload importmap, then build Next in standalone mode.
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* are inlined at build time, so this one must be a build ARG.
# Pass it from Dokploy "Build-time Arguments". Non-sensitive (it's a URL).
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# Payload generates an admin import map that must exist before `next build`.
# CRITICAL: the import map content depends on which storage plugin is active,
# which is decided by MEDIA_STORAGE in resolveStoragePlugins(). If we generate
# the map WITHOUT MEDIA_STORAGE=r2, the S3ClientUploadHandler is omitted and the
# admin panel crashes at runtime ("PayloadComponent not found in importMap").
# So generate:importmap MUST run with the same storage env as the runtime.
#
# `next build` also needs build-time secrets for two reasons:
#   - it imports the Stripe client module, which throws at import time if
#     STRIPE_SECRET_KEY is missing;
#   - generateStaticParams in /[locale]/tours/[slug] queries Payload, which
#     initialises against Postgres and requires PAYLOAD_SECRET + DATABASE_URL.
# All are mounted as BuildKit secrets (NOT ARGs) so they never land in an image
# layer. Each secret id MUST match the "Build-time Secrets" key in Dokploy.
# NOTE: Postgres must be reachable from the builder during the build.
RUN --mount=type=secret,id=STRIPE_SECRET_KEY \
    --mount=type=secret,id=PAYLOAD_SECRET \
    --mount=type=secret,id=DATABASE_URL \
    --mount=type=secret,id=MEDIA_STORAGE \
    --mount=type=secret,id=R2_ACCOUNT_ID \
    --mount=type=secret,id=R2_BUCKET \
    --mount=type=secret,id=R2_ACCESS_KEY_ID \
    --mount=type=secret,id=R2_SECRET_ACCESS_KEY \
    --mount=type=secret,id=R2_PUBLIC_URL \
    STRIPE_SECRET_KEY="$(cat /run/secrets/STRIPE_SECRET_KEY 2>/dev/null || true)" \
    PAYLOAD_SECRET="$(cat /run/secrets/PAYLOAD_SECRET 2>/dev/null || true)" \
    DATABASE_URL="$(cat /run/secrets/DATABASE_URL 2>/dev/null || true)" \
    MEDIA_STORAGE="$(cat /run/secrets/MEDIA_STORAGE 2>/dev/null || true)" \
    R2_ACCOUNT_ID="$(cat /run/secrets/R2_ACCOUNT_ID 2>/dev/null || true)" \
    R2_BUCKET="$(cat /run/secrets/R2_BUCKET 2>/dev/null || true)" \
    R2_ACCESS_KEY_ID="$(cat /run/secrets/R2_ACCESS_KEY_ID 2>/dev/null || true)" \
    R2_SECRET_ACCESS_KEY="$(cat /run/secrets/R2_SECRET_ACCESS_KEY 2>/dev/null || true)" \
    R2_PUBLIC_URL="$(cat /run/secrets/R2_PUBLIC_URL 2>/dev/null || true)" \
    sh -c 'pnpm generate:importmap && pnpm build'

# ---------------------------------------------------------------------------
# Runner — minimal runtime image (standalone server + static + media).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as the non-root user that the node image already provides.
RUN mkdir -p /app/media && chown -R node:node /app

# Standalone bundle includes a trimmed node_modules + server.js.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# server.js is emitted by Next's standalone output (NOT `next start`).
CMD ["node", "server.js"]
