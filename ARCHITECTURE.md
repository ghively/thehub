# Hub Architecture (Transport-Agnostic)

This document describes a runtime design where adding a Core (via the manifest) makes it available to both ChatGPT Connections and generic MCP clients without reconfiguration.

## High-Level
- Single Source of Truth: `manifest` defines all Cores once.
- Shared Tool Registry: a centralized catalog of namespaced tools generated from active Cores.
- Multiple Transports, One Router: STDIO MCP server and WebSocket MCP server attach to the same HubServer instance and shared Tool Registry.
- Session Policies: optional per-connection limits (concurrency, rate limits) applied at the connection layer, without changing Core configuration.

## Components
- Manifest Loader
  - Loads/validates YAML; supports hot-reload.
  - Emits events (added/removed/updated core definitions).
  - Validates against `schemas/manifest.schema.json` with Ajv; enforces unique namespaces.

- Supervisor
  - Spawns Core processes with env/secrets; monitors liveness/readiness; restarts with backoff.
  - Maintains per-Core concurrency caps and queues.

- Tool Registry
  - Builds a namespaced catalog from each Core’s MCP tool list.
  - Provides lookup (`<namespace>.<tool> → core`) and metadata.
  - Emits change events when Cores add/remove tools.

- Router
  - Receives MCP tool calls from any transport.
  - Resolves the target Core by namespace; applies policy checks; forwards requests; normalizes errors.
  - Aggregation/fan-out tools implemented here when needed.

- Transports
  - STDIO Server: exposes MCP over STDIO for local MCP clients and ChatGPT “Command” mode.
  - WebSocket Server: exposes MCP over WS/WSS for multi-client sharing and ChatGPT URL mode.
  - Both register with the same HubServer and Tool Registry; no Core reconfiguration required.

- Policy & Auth
  - Global policy (allow/deny, destructive guardrails) and per-connection limits.
  - WS auth via bearer token or mTLS. STDIO typically trusted local.

- Telemetry
  - Structured logs with redaction; OTel traces/metrics tagged by `{client, session, core, tool}`.

## Data Flows
1) Startup: Manifest Loader → Supervisor spawns Cores → Tool Registry populated.
2) Client connects (STDIO or WS): Transport creates a session; Hub lists namespaced tools from the Registry.
3) Tool call: Transport → Router → Core; response routed back; telemetry recorded.
4) Hot-reload: Manifest changes update Supervisor and Tool Registry; clients see updated tools without restart.

## Configuration Model
- `hub.yaml` defines Cores; transports read only Hub-level settings (e.g., `listen`, `token`).
- No duplication: adding a Core only touches the manifest once; both transports reflect it automatically.

## Minimal Interfaces
- HubServer
  - `registerTransport(transport)`
  - `listTools(session)` → namespaced list
  - `invoke(session, namespacedTool, params)`

- Transport
  - `onList(handler)` / `onInvoke(handler)` / `onPing(handler)`
  - `send(result)` / `sendError(err)`
  - Authentication hooks (WS only)

## Rollout Plan
1) Implement STDIO server + core supervision + tool registry.
2) Add WebSocket server bound to the same HubServer APIs.
3) Add session policies and auth; expose metrics; containerize.

## Compliance
- Protocol: JSON-RPC 2.0 messages for MCP. Methods to support early:
  - `initialize` (handshake), `tools/list`, `tools/call`, and `ping`.
- STDIO Transport: Use LSP-style framing with `Content-Length` headers. No per-transport Core config.
- WebSocket Transport: Accept `Sec-WebSocket-Protocol: mcp` if offered; otherwise default. Use `wss://` for non-local deployments.
- ChatGPT Connections: Both Command (STDIO) and URL (WS/WSS) modes should list the same namespaced tools from the shared registry.
- Auth: For WS, allow `Authorization: Bearer <token>` header. For local STDIO command mode, treat as trusted or use env-based policy.
