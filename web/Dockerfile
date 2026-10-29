# Production image for the province data-catalog support system (Next.js + Payload).
# Build from the web/ folder:  docker build -t agencyas-web .

FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build never talks to the database; these only satisfy config loading.
ENV PAYLOAD_SECRET=build-time-placeholder
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STORAGE_DIR=/app/storage

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# user manuals served to signed-in staff at /manual
COPY --from=builder /app/manuals ./manuals

# Uploaded files live here; mount a volume on it.
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
VOLUME /app/storage

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
