# Security Model (Hub + Cores)

## Principles
- Least privilege (per-Core scopes).
- Secret isolation and rotation.
- Strong identity (mTLS with SPIFFE/SPIRE when networked).
- Defense in depth (sandboxing, egress limits, policy checks).

## Secrets
- Stored in a secret manager; the manifest references keys only.
- Injected via env at spawn time; never logged.
- Rotation via drain + restart; verify health before resuming traffic.

## Identity & Transport
- Local: STDIO channels; OS-level isolation.
- Remote: mTLS between Hub and Cores; SPIFFE identities; short-lived certs.

## Policy & Authorization
- Hub-level allow/deny of tools and destructive ops.
- Per-tenant quotas and concurrency caps.
- Optional OPA/Rego for declarative and auditable policy.

## Isolation & Sandboxing
- Run Cores in containers; apply seccomp/AppArmor profiles.
- Restrict filesystem and network egress where feasible.

## Auditing & Compliance
- Log Core lifecycle events (spawn, crash, restart, policy change).
- Correlate requests with IDs across Hub and Cores.
- Keep deviation logs when Core specs drift.

