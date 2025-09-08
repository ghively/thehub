# Developing Cores for the Hub

This guide explains how to build a standalone MCP Core that the Hub can supervise and expose to clients over both STDIO and WebSocket without any per-transport reconfiguration.

## Core Responsibilities
- Speak MCP over STDIO using LSP-style framing (Content-Length headers).
- Implement minimal JSON-RPC methods:
  - `initialize` → return `serverInfo` and `capabilities`.
  - `tools/list` → return the tools this Core provides.
  - `tools/call` → execute a tool and return structured content.
  - `ping` → lightweight health check.
- Validate inputs; redact secrets from logs; avoid leaking tokens in errors.

## Tool Design
- Stable tool IDs and JSON Schema-compatible `inputSchema`.
- Avoid hub-specific prefixes in tool names; the Hub adds the namespace (e.g., `template.echo`).
- Prefer small, composable tools with clear contracts.

## STDIO Framing (must-have)
- Each JSON-RPC message is framed as:
  - `Content-Length: <N>\r\n\r\n` + `<N bytes of UTF-8 JSON>`
- Robust to partial/coalesced frames.

## Minimal Core Template
- See `runtime/examples/cores/template-core.js` for a complete, heavily commented example implementing a single `echo` tool.
- To run it directly for debugging:
  - `node runtime/examples/cores/template-core.js` and send framed JSON-RPC messages over STDIN.

## Hub Integration
- Add your Core to the manifest once; no per-transport config required.
- Example manifest entry:
```yaml
cores:
  mycore:
    command: node
    args: ["runtime/examples/cores/template-core.js"]
    namespace: mycore
    cwd: /path/to/repo
```
- The Hub spawns your Core, calls `initialize`, collects tools via `tools/list`, and exposes them as `<namespace>.<tool>` to all clients.

## Guardrails & Policy
- Implement destructive-operation guardrails at the Core (e.g., confirm flags).
- The Hub may apply additional policy (allow/deny lists, concurrency caps).

## Observability
- Log JSON (redacted) with correlation/request IDs when provided.
- Optionally export metrics/traces; the Hub correlates session/core/tool IDs.

## Testing
- Develop locally by running the Core standalone with a small driver.
- Validate via the Hub using `HUB_MANIFEST` and the integration tests.

## Security Notes
- Inject secrets via environment variables from the Hub; never hardcode secrets.
- Never echo secrets back to clients; redact them in logs and errors.

## Next Steps
- Use `runtime/examples/cores/template-core.js` as a starting point.
- Keep tool contracts stable and version them when needed.

