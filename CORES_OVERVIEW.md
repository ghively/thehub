# Cores Overview

A Core is a standalone MCP server focused on a single external API. The Hub orchestrates many Cores and provides a unified client connection. This document explains what the Hub assumes about Cores.

## Core Responsibilities
- Implement MCP tools for an API using a well-defined endpoint map.
- Validate inputs (zod/JSON Schema), handle auth, retries, and pagination.
- Enforce destructive guardrails at the Core boundary.
- Emit structured logs with secret redaction; support basic health checks.

## Lifecycle
- Spawned by the Hub with environment variables for auth/config.
- MCP handshake: ready when able to list tools and respond to a ping.
- Graceful shutdown on SIGTERM with draining (finish inflight, reject new).

## Configuration
- Env vars for base URLs, tokens, and toggles (e.g., ALLOW_DESTRUCTIVE).
- No secrets in code; everything is injected at launch time.

## Tool Semantics
- Generic tools: list/get/create/update/delete/call_action/search/orchestrate.
- Namespacing: the Hub prepends a Core namespace; tool names themselves remain stable.
- Idempotency: GETs are idempotent; Hub retries only idempotent calls.

## Observability
- Logs: JSON with request IDs/correlation IDs when provided.
- Metrics/traces: recommended via STDIO side-channel or process metrics export; the Hub correlates across Cores.

## Security & Isolation
- Principle of least privilege: only required scopes.
- Redaction of tokens/secrets in logs.
- Process/container isolation per Core instance where practical.

## Contract Summary
- MCP transport: STDIO (required), optional WebSocket when supported by Core.
- Stability: declare a simple semantic version for tool signatures.
- Health: respond to MCP ping; optional `/healthz` if Core exposes HTTP.

