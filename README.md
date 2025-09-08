# The Hub (Concept Docs)

This folder contains conceptual documentation for a future "Hub" middleware that unifies multiple MCP "Core" servers (like this Action1 Core) behind a single client connection. No middleware code is included here.

Key docs:
- HUB_CONCEPT.md: concept, best practices, and an integration guide for managing many Cores.
- CORES_OVERVIEW.md: what a Core is, lifecycle, guardrails, and expectations.
- CORE_INTERFACE.md: expected Core contract for the Hub (naming, handshake, tool semantics).
- MANIFEST_SPEC.md: Hub manifest schema (command/args/env/secrets/policy/namespacing) with examples.
- SECURITY_MODEL.md: secrets/identity/isolation/policy hardening for the Hub and Cores.
- OBSERVABILITY.md: OpenTelemetry traces/metrics/logs, correlation, dashboards.
- OPERATIONS.md: runbooks, SLOs, incident response, deployment checklists.
- ROADMAP.md: phased plan and milestones for building the Hub.
- README.md: this index.
- hubprompt.md: an LLM prompt to plan the Hub at a later date using these docs.

## Deployment Goals
- Containerized Hub: official Docker image and Compose examples for local and server deployments.
- ChatGPT Connections: compatible with ChatGPT’s MCP Connections via:
  - Local command/STDIO mode (developer desktop).
  - WebSocket server mode (`ws://` for local desktop, `wss://` for hosted/web) to share one Hub across multiple chats.
  - Multi-client support so several ChatGPT chats can concurrently use the same Hub instance.
- Transport-agnostic configuration: a single manifest defines Cores once; the same Cores are immediately available to both ChatGPT Connections and generic MCP clients without per-transport reconfiguration.

See the main repository README for Core details. The Hub should remain thin: process management, namespacing, routing/policy, and observability — while each Core keeps API-specific logic.
