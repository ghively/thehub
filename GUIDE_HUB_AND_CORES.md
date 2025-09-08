# Hub and Cores: End-to-End Guide

This guide explains how the Hub works, how to run it locally or in Docker, how it integrates with ChatGPT Connections, and how to build new Cores.

## Overview
- The Hub is a transport-agnostic MCP server that exposes many Cores (standalone MCP servers) under a single connection.
- Clients connect via STDIO (Command) or WebSocket (URL). The Hub lists namespaced tools from all Cores (e.g., `template.echo`).
- A single manifest defines which Cores to run; both transports use the same manifest—no per-transport reconfiguration.

## Architecture
- Manifest Loader: reads `HUB_MANIFEST` (YAML), validates with JSON Schema (`schemas/manifest.schema.json`), enforces unique namespaces.
- Supervisor: spawns Cores as child processes (STDIO MCP) and performs handshake and tool discovery.
- Tool Registry: aggregates tools from all Cores and maps `<namespace>.<tool>` to the owning Core.
- Router: forwards `tools/call` from clients to the correct Core.
- Transports: STDIO (Command) and WebSocket (URL), sharing the same registry and router.
- Hot-Reload: watches the manifest, reconciles processes and registry on changes.
- Observability: structured JSON logs (redacted), `/healthz` endpoint, optional OTel in future.
 - Limits & Metrics: per-core concurrency (semaphores), per-client caps and rate limits, Prometheus `/metrics`.

## Running the Hub
- Install deps: `cd runtime && npm install`
- STDIO (Command): `HUB_MANIFEST=<repo>/examples/manifests/hub.yaml node runtime/src/hub.js --stdio`
- WebSocket (URL): `HUB_MANIFEST=<repo>/examples/manifests/hub.yaml node runtime/src/hub.js --ws 3000`
  - Optional: `HUB_TOKEN=yourtoken` and provide `Authorization: Bearer yourtoken` header.
- Docker: `docker compose up --build` (probes `/healthz`).
- Health: `curl http://localhost:3000/healthz` → `{ ok, cores, tools }`.
 - Metrics: `curl http://localhost:3000/metrics` → Prometheus text format.

## ChatGPT Connections
- URL mode: See `examples/chatgpt_connection_url.json` (ws://localhost:3000). Use TLS (`wss://`) when hosted.
- Command mode: See `examples/chatgpt_connection_command.json` (STDIO). The manifest makes Cores visible to both modes.

## Developing Cores
- Start from `runtime/examples/cores/template-core.js` (echo tool implementation).
- Implement: `initialize`, `tools/list`, `tools/call`, `ping` over STDIO with LSP framing.
- Keep tool IDs stable and provide `inputSchema`. The Hub validates schemas and logs warnings for invalid ones.
 - Optional validation: The Hub can warn-only if provided schemas don’t compile; it does not block execution.
- Add to manifest once:
```yaml
cores:
  mycore:
    command: node
    args: ["runtime/examples/cores/template-core.js"]
    namespace: mycore
    cwd: /path/to/repo
```
- The Hub will expose your tools as `mycore.<tool>` automatically for both transports.

## Hot-Reload
- Edit the manifest (e.g., change a namespace or args). The Hub detects changes and reconciles:
  - Stops removed cores, restarts changed cores, and refreshes the tool registry.
- Clients can call `tools/list` to see updates immediately.

## Concurrency & Rate Limits
- Per-core concurrency: `policy.max_concurrency` in the manifest controls parallel calls into a Core.
- Per-client concurrency: `HUB_MAX_CONCURRENCY_PER_CLIENT` (default 4) limits simultaneous `tools/call` per client connection.
- Per-client RPS: `HUB_RATE_LIMIT_RPS` throttles calls per second (token bucket) for each client.

## Logging
- Structured JSON on stderr with field redaction.
- Examples: `spawning_core`, `core_initialized`, `tools_registered`, `registry_reconciled`, `ws_listening`, `manifest_invalid`.

## Security
- Secrets are not stored in the manifest; only secret keys would be referenced (future secret manager integration).
- Use `HUB_TOKEN` and WSS + reverse proxy for hosted deployments.
- Never echo secrets in tool outputs; redact in logs.

## Testing
- STDIO: `HUB_ALLOW_TEST_SHUTDOWN=1 node runtime/tests/test_hub_core_stdio.js`
- WebSocket: same, but may require elevated permissions to bind localhost ports in restricted environments.
- Hot-Reload: `HUB_ALLOW_TEST_SHUTDOWN=1 node runtime/tests/test_hotreload_stdio.js`.

## Next Steps
- Add per-client concurrency caps and rate limiting.
- Add OTel tracing/metrics and dashboards.
- Add fan-out tools for aggregation.
