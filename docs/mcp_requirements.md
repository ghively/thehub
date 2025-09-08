# MCP Requirements (Reference)

This summary captures practical requirements to interop with MCP clients (including ChatGPT Connections). Consult the official spec for authoritative details.

## Protocol
- JSON-RPC 2.0 for requests/responses.
- Recommended baseline methods:
  - `initialize` (client → server). Response includes `serverInfo` and `capabilities`.
  - `ping` for liveness checks.
  - `tools/list` to discover tool catalog.
  - `tools/call` to invoke a tool with arguments.
- Tool responses typically include `result.content` (e.g., `{ type: "text", text: "..." }`).

## STDIO Transport
- Framing: LSP-style headers, at minimum `Content-Length: <N>\r\n\r\n` followed by a JSON payload of length N.
- Each message is a complete JSON-RPC object.
- Server should be robust to partial frames and coalesced frames.

## WebSocket Transport
- Subprotocol: Prefer `Sec-WebSocket-Protocol: mcp` when offered by the client.
- Payloads: JSON per message. One JSON-RPC object per WS frame is common.
- TLS: Use `wss://` for any non-localhost exposure.
- Auth: Typically via `Authorization: Bearer <token>` header on the WS upgrade request.

## Namespacing & Tools
- Hub exposes `<namespace>.<tool>` names constructed from Core name + tool id.
- Tool schemas should be stable and use JSON Schema-compatible structures.

## Errors
- Use JSON-RPC error format `{ code, message, data? }`.
- Avoid leaking secrets in messages.

## Observability
- Correlate requests with IDs. Redact tokens and sensitive fields in logs.

## Notes
- This summary will be reconciled with the official MCP spec as we implement. Update as the spec evolves.

