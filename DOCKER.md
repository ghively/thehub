# Docker & ChatGPT Connections

This document outlines how to run the Hub in a container and connect it to ChatGPT via MCP Connections. The Hub is concept-only today; these steps describe the target operational model for when the runtime exists.

## Modes
- Command/STDIO (local dev): ChatGPT launches a command. A small wrapper can run the Hub in Docker and attach STDIO.
- WebSocket server (recommended for sharing): Run one Hub container exposing `ws://localhost:<port>` (desktop) or `wss://<domain>` (web). Multiple ChatGPT chats can connect concurrently.

## Images
- Tag: `ghively/thehub:<version>` (to be produced by CI).
- Runs as non-root, with `HEALTHCHECK` endpoint and env-driven config.
- Validates `HUB_MANIFEST` against `schemas/manifest.schema.json` on startup.

## Sample docker-compose.yml
```yaml
services:
  hub:
    image: ghively/thehub:latest
    environment:
      HUB_MANIFEST: /etc/hub/hub.yaml
      HUB_LISTEN: 0.0.0.0:3000          # WebSocket MCP server
      HUB_TOKEN: ${HUB_TOKEN}           # optional bearer token for auth
    volumes:
      - ./examples/manifests/hub.yaml:/etc/hub/hub.yaml:ro
    ports:
      - "3000:3000"
    restart: unless-stopped
```

## ChatGPT Connections

### A) WebSocket URL (recommended for sharing)
- Desktop (local): URL `ws://localhost:3000` (no TLS), set Header `Authorization: Bearer <HUB_TOKEN>` if configured.
- Web (hosted): URL `wss://your-domain.example/hub`; terminate TLS at a reverse proxy and forward to the container. Add the same Authorization header.

### B) Command/STDIO (local-only)
Use a wrapper script as the ChatGPT command:
```bash
#!/usr/bin/env bash
exec docker run --rm -i \
  -e HUB_MANIFEST=/etc/hub/hub.yaml \
  -v "$PWD/examples/manifests/hub.yaml":/etc/hub/hub.yaml:ro \
  ghively/thehub:latest
```
This allows ChatGPT to speak MCP over STDIO with the containerized Hub. This mode is not shared across chats unless you keep the process persistent.

## Reverse Proxy for WSS
- Use Caddy, NGINX, or Traefik to terminate TLS and proxy to `hub:3000`.
- Enforce Authorization header or mTLS; set tight idle/read timeouts.

## Security Notes
- Prefer localhost-only for desktop development.
- For public `wss://` exposure: use short-lived tokens or mTLS, IP allowlists, and rate limits.
- Redact secrets in logs; never echo Core secrets back to clients.

## Health & Observability
- Health: `/healthz` on the WebSocket HTTP server returns `{ ok, cores, tools }`.
- Observability: enable OTel exporter via env (e.g., `OTEL_EXPORTER_OTLP_ENDPOINT`).
 - Logs: Hub emits structured JSON to stderr with redaction. Fields include `{ ts, level, msg, component, ...context }`.
 - Metrics: Prometheus endpoint at `/metrics`. Example scrape config (Prometheus):
   
   ```yaml
   scrape_configs:
     - job_name: thehub
       static_configs:
         - targets: ['localhost:3000']
   ```

## Next Steps (Implementation Plan)
- Add WebSocket transport to the Hub runtime and a connection manager for multi-client sessions.
- Implement token auth and per-client concurrency limits.
- Provide the Dockerfile and Compose examples above; publish images via CI.
- Document ChatGPT Connection setup with screenshots and templates.

## Compliance Notes
- MCP over WebSocket: Prefer `Sec-WebSocket-Protocol: mcp` when clients offer it. Use `wss://` when exposed beyond localhost.
- MCP over STDIO: Speak JSON-RPC over LSP-style framing (Content-Length headers). ChatGPT Command connections expect this.
- ChatGPT URL connections: You can provide custom headers; use `Authorization: Bearer <HUB_TOKEN>` for token auth.
