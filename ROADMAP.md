# Hub Roadmap

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

