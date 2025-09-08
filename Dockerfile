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
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "import('node:http').then(({request})=>{const req=request({host:'127.0.0.1',port:3000,path:'/healthz'},res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.end();})"
ENTRYPOINT ["node", "/app/runtime/src/hub.js", "--ws", "3000"]
