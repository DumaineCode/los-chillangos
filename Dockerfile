# syntax=docker/dockerfile:1.7

# Los Chillangos — Next.js 15 + Payload CMS production image.
#
# Multi-stage build tuned for: pnpm@11 (pinned), sharp/libvips native binaries,
# and Next.js standalone output. Postgres and R2 media storage are EXTERNAL —
# this image only runs the app server.
#
# Debian "slim" base (not Alpine) on purpose: sharp + Payload behave more
# reliably against glibc than musl.

ARG NODE_VERSION=20-bookworm-slim

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

# Telemetry off; build needs DATABASE_URL + PAYLOAD_SECRET to be present.
ENV NEXT_TELEMETRY_DISABLED=1

# Payload generates an admin import map that must exist before `next build`.
RUN pnpm generate:importmap
RUN pnpm build

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
