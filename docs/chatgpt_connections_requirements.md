# ChatGPT Connections Requirements (Reference)

This summary captures what is typically required to interoperate with ChatGPT’s Connections feature.

## Modes
- Command (STDIO): ChatGPT launches a local command and communicates over STDIO using MCP framing.
- URL (WebSocket): ChatGPT connects to a WebSocket endpoint (ws/wss) that speaks MCP.

## URL Connections
- Endpoint: `ws://localhost:<port>` for desktop development; `wss://<domain>` for hosted.
- Headers: Custom headers are supported; use `Authorization: Bearer <token>` for auth.
- Subprotocol: Prefer `Sec-WebSocket-Protocol: mcp` when possible.
- Multiple sessions: ChatGPT may open multiple concurrent connections (e.g., multiple chats); server must isolate sessions.

## Command Connections
- STDIO framing: LSP-style `Content-Length` headers.
- Command can be a wrapper that runs Docker with `-i` to preserve STDIO.
- Environment variables and arguments can be configured in the Connection.

## Security
- Local dev: Bind WS to `localhost` or require a token if bound to `0.0.0.0`.
- Hosted: Require `wss://`, token auth in headers, consider rate limits and IP allowlists.
- Avoid logging secrets; never echo Core secrets back to clients.

## Operability
- List tools consistently across transports; no per-transport reconfiguration.
- Handle basic methods: `initialize`, `tools/list`, `tools/call`, and `ping` for health.

## Notes
- This summary will be verified against the official Connections docs during implementation; update as the platform evolves.

