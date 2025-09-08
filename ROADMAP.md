# Hub Roadmap

## Containerization & ChatGPT Connections (New)
- Official Docker image (multi-stage, non-root, healthcheck).
- WebSocket server transport for MCP with configurable port.
- Multi-client session manager with per-client concurrency limits.
- Token-based auth for WebSocket; optional mTLS when exposed externally.
- docker-compose examples: local `ws://localhost` and reverse-proxied `wss://<domain>`.
- ChatGPT Connections docs: Command/STDIO (via `docker run -i`) and WebSocket URL modes.
- CI workflow to build and publish images.
 - Unified tool catalog across transports (no per-transport reconfiguration when adding Cores).

## P0 (MVP)
- STDIO Core management (spawn/supervise) from manifest.
- Namespaced routing of tools; basic policy (deny destructive).
- OTel traces/metrics/logs; structured logging with redaction.
- Health checks, restart with backoff; per-Core concurrency caps.

## P1
- Hot-reload of manifest; graceful drain of cores.
- Adaptive throttling from 429s; circuit breakers and bulkheads.
- Secret manager integration; rotation flow.
- Fan-out aggregation tools with provenance envelopes.

## P2
- Remote Core support (WebSocket/SSH/containers).
- mTLS with SPIFFE/SPIRE identities.
- Multi-tenant isolation and quotas.
- Policy as code (OPA) for allow/deny + routing constraints.

## P3
- HA Hub (stateless replicas), config store, leader election for scheduled tasks.
- Autoscaling guidance for containerized Cores.
- Advanced dashboards and SLO-based alerting.
