# Core Interface (Hub Contract)

This document defines the expected interface between the Hub and a Core MCP server.

## Transport & Handshake
- Transport: STDIO MCP required. The Hub connects and performs MCP handshake.
- Readiness: Core is considered ready once tools are registered and pingable.

Note: The Core-to-Hub interface is transport-agnostic from the client’s perspective. Whether a client connects to the Hub over STDIO (Command) or WebSocket (URL), the same namespaced tools and behaviors are exposed without Core-specific reconfiguration.

See also: DEVELOPING_CORES.md for a step-by-step Core template and implementation notes.

## Namespacing & Tool IDs
- The Hub assigns a namespace (e.g., `action1:`) and exposes tools as `<ns>.<tool>`.
- Core tool names should be stable and descriptive.

## Inputs & Validation
- Core validates inputs (zod/JSON Schema) and returns structured MCP content. The Hub does not rewrite payloads.

## Guardrails
- Destructive operations require Core-level confirmation (e.g., `confirm:"YES"`) and environment flags. The Hub may apply stricter policy.

## Errors
- Core returns actionable errors with status and snippet if available; do not leak secrets.

## Observability Hooks
- Core logs structured JSON; include request IDs when provided.
- Optional: emit metrics/traces; the Hub correlates by passing correlation IDs.

## Versioning
- Core should expose a semantic version string; Hub can reject incompatible versions.

## Health
- Ping/Pong via MCP; optional HTTP `/healthz` if available.
