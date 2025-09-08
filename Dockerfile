# Simple Dockerfile for the stub runtime (adjust when runtime evolves)
FROM node:20-alpine AS base
WORKDIR /app
COPY runtime/package.json ./runtime/package.json
RUN --mount=type=cache,target=/root/.npm <<EOF
set -e
cd runtime
npm ci || npm install
EOF
COPY runtime/src ./runtime/src

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/runtime /app/runtime
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD node -e "process.exit(0)"
ENTRYPOINT ["node", "/app/runtime/src/hub.js", "--ws", "3000"]

