# Hub Middleware Concept (Cores + Hub)

This document brainstorms a middleware “Hub” that provides a single connection point for MCP clients and orchestrates multiple standalone MCP servers (called “Cores”) as plugins. No implementation is included in this repository.

## Goals
- One client connection (to the Hub) → many APIs via Cores.
- Dynamic discovery and lifecycle management of Cores.
- Unified auth model and per-core secret isolation.
- Consistent tool naming and namespacing.
- Observability (logs, metrics) across Cores.

## Terms
- Core: a standalone MCP server for a single API (this repo is a Core for Action1).
- Hub: a long-running mediator that connects to clients and loads/bridges multiple Cores.

## High-Level Architecture
```
+-----------+        STDIO/WebSocket        +--------------------+
| MCP      | <----------------------------> |        Hub         |
| Client   |                                 +---------+--------+
+-----------+                                           |
                                          (plugin bus)  |
                                                        v
                                          +-------------+--------------+
                                          |   Core A (Action1 MCP)     |
                                          +----------------------------+
                                          |   Core B (Another API)     |
                                          +----------------------------+
```

## Responsibilities
- Hub
  - Transport: accept STDIO or WebSocket from clients.
  - Registry: discover available Cores via a manifest (JSON/YAML) or directory scan.
  - Lifecycle: spawn/monitor Cores, restart on failure, enforce resource limits.
  - Routing: map namespaced tools (e.g., `action1.list_resources`) to the corresponding Core.
  - Auth: per-Core env injection from a secure store; never expose secrets back to clients.
  - Policy: guardrails, rate-limit, concurrency caps per Core or per tenant.
  - Observability: structured logs and metrics per Core; redaction in proxies.
- Cores
  - Provide tool contracts via MCP; keep code single-responsibility and stateless.

## Plugin Model
- Manifest example:
```yaml
cores:
  action1:
    command: node
    args: ["--enable-source-maps", "dist/server.js"]
    env:
      API_BASE: https://app.action1.com/api/3.0
    secrets:
      - BEARER_TOKEN  # stored in the Hub’s secret manager
  another_api:
    command: ./another-core
```
- Namespacing: Hub prepends core name to tool IDs (e.g., `action1.get_resource`).
- Health: periodic pings; Hub exposes a consolidated health endpoint/tool.

## Transport Options
- STDIO (local spawning): simple and robust, best for on-host deployment.
- WebSocket/TCP: Hub can proxy MCP messages to Cores running remotely (define framing & auth).
- SSH: Hub can spawn Cores remotely via SSH and tunnel STDIO.

## Security
- Secrets stored centrally (e.g., file-based vault, KMS). Hub injects env vars per Core at spawn.
- Audit logging: correlate requests across Hub and Cores with request IDs.
- Isolation: run each Core under a dedicated user/container with scoped permissions.

## Orchestration
- Tool catalog: Hub provides a discovery tool returning all namespaced tools.
- Fallback strategies: if multiple Cores implement the same capability, Hub chooses via policy or explicit override.
- Bulk operations: Hub can fan out requests to many Cores and aggregate results.

## Migration Plan
1) Keep Cores (this repo) single-purpose and transport-agnostic (already true).
2) Define a stable manifest format and namespacing convention.
3) Prototype a thin Hub that forwards STDIO to Cores locally.
4) Add WebSocket bridge if remote Cores are required.
5) Add secrets manager integration and per-Core policies.

## Known Challenges
- Error propagation & retries across Hub boundaries.
- Streaming or long-running jobs across multiple Cores.
- Tool name collisions and versioning.

## Non-Goals (for now)
- Re-implementing MCP; Hub should pass messages transparently whenever possible.
- Embedding business logic in the Hub that belongs in Cores.

---

## Integrating This Core with the Hub

This section details how a Hub would integrate with this Action1 MCP Core and how it would manage multiple Cores of the same pattern.

### Discovery and Registration
- Manifest-driven: The Hub loads a static or dynamic manifest that lists available Cores with their launch commands, arguments, and environment variables.
- Self-identification: On startup, the Hub spawns each Core and performs an MCP handshake, then queries tool metadata (name, input schema if exposed) to build a registry.
- Namespacing: The Hub assigns a stable namespace to each Core (e.g., `action1:`), prepended to tool names (e.g., `action1.list_resources`).

Example manifest entry for this Core:
```yaml
cores:
  action1:
    command: node
    args: ["--enable-source-maps", "dist/server.js"]
    cwd: /opt/cores/action1
    env:
      API_BASE: https://app.action1.com/api/3.0
    secrets:
      - BEARER_TOKEN   # injected from the Hub’s secret store at runtime
    policy:
      allow_destructive: false
      max_concurrency: 8
```

### Launch and Supervision
- Process model: Each Core runs in its own process (or container), connected via STDIO. The Hub supervises process lifecycle, restarts on crash with backoff, and enforces resource limits.
- Readiness: After spawn, the Hub waits for a successful MCP handshake and a tools list before marking the Core ready.
- Configuration reload: The Hub supports hot reload of the manifest (add/update/remove Cores without full restart) with graceful draining.

### Tool Metadata and Namespacing
- Registry: The Hub builds a map `{ namespacedTool -> { core, toolName } }`.
- Discovery: Hub exposes a `hub.list_tools` utility that merges tool catalogs from all Cores and returns namespaced IDs and short descriptions.
- Conflicts: If two Cores expose the same tool names without namespaces, the Hub resolves via namespace prefix and optionally policy.

### Request Routing and Validation
- Routing: For a request to `action1.list_resources`, the Hub routes to the Action1 Core and relays the MCP tool call without altering payloads.
- Validation: Input validation remains the Core’s responsibility (zod at the Core). The Hub performs only superficial checks (e.g., required namespace present) and policy enforcement (e.g., destructive denied).
- Guardrails: The Hub can enforce `ALLOW_DESTRUCTIVE=false` at the env/policy layer. Attempts to call destructive tools without the proper policy yield a clear text response from the Hub before reaching the Core.

### Secrets and Configuration
- Injection: The Hub injects secrets as env vars on process launch (e.g., `BEARER_TOKEN`). Secrets are never logged or echoed back. Redaction policies apply in Hub logs.
- Rotation: The Hub supports secret rotation by restarting the Core with new env values using a coordinated drain-and-replace flow.
- Per-core config: Base URLs, org defaults, and feature toggles are scoped to the Core instance to avoid cross-tenant leakage.

### Concurrency, Rate Limits, and Backpressure
- Concurrency caps: The Hub enforces a per-Core concurrent request limit (e.g., `max_concurrency`), queueing excess requests with fair scheduling (round-robin across Cores).
- Backpressure: If a Core reports rate-limit headers or returns many 429s, the Hub can temporarily reduce dispatch rate to that Core (adaptive throttling), while allowing other Cores to proceed.
- Timeouts and cancellation: The Hub applies per-request timeouts and propagates client cancellations to Core processes.

### Health Checks and Resilience
- Liveness: The Hub tracks Core process health via OS signals and read/write to STDIO.
- Readiness: MCP ping/tool-list checks. If the Core is unresponsive, the Hub isolates it and attempts supervised restart with exponential backoff.
- Circuit breaking: After repeated failures, the Hub opens a circuit for that Core and returns fast failures until a cool-down expires.

### Logging, Tracing, and Metrics
- Correlation ID: The Hub attaches a `req_id` to each request and passes it via MCP metadata (or logs it on ingress/egress) for cross-system traceability.
- Redaction: Hub log fields are redacted similarly to the Core (`authorization`, `token`, `secret`, etc.).
- Metrics: Per-Core counters (requests, errors, retries), latency histograms, queue sizes, and concurrency utilization. Export to Prometheus/OpenTelemetry.

### Fan-out and Aggregations
- Broadcast: The Hub can implement fan-out tools (e.g., `hub.search_all`) that invoke equivalent tools across selected Cores in parallel and aggregate results.
- Envelope: Aggregated responses include `{ core: "action1", tool: "list_resources", result }` to preserve provenance.
- Partial failures: Aggregate responses include per-Core statuses; client can choose retry or ignore strategy.

### Multi-Tenant Isolation
- Process/container isolation: Each tenant’s Core instance runs under a separate process/container with its own env to prevent cross-tenant data access.
- Policy boundaries: Tenants cannot call tools of other tenants; namespace includes tenant identifier if necessary (e.g., `tenantA:action1.list_resources`).

### Remote Cores (SSH, Containers, K8s)
- SSH: Hub spawns remote Cores via SSH and tunnels STDIO securely (authorized keys, restricted shells).
- Containers: Hub runs Cores as containers (Docker/K8s) with per-Core images and env. Use labels/annotations for discovery and lifecycle hooks.
- Service mesh: When bridging over TCP/WebSocket, secure channels with mTLS and mutual auth between Hub and Cores.

### Horizontal Scaling and HA
- Scale-out Hubs: Run multiple Hub instances behind a load balancer; use sticky sessions or shared state (e.g., Redis) for request routing if needed.
- State: Keep Hub stateless where possible; store manifests in a shared config store and secrets in a vault.
- Leader election: For coordinated tasks (e.g., scheduled jobs), use leader election to avoid duplication.

### Security Model
- Principle of least privilege: Scopes per Core; secrets scoped to one Core only.
- Audit trails: Log all Core spawn/stop events, policy changes, and fan-out tool usage for compliance.
- Sandboxing: Consider seccomp/apparmor constraints or restricted containers for untrusted Cores.

### Operational Runbooks
- On-call: Restart Core, rotate secrets, drain queues, validate health endpoints.
- Incident: Rate-limit spikes (apply global throttles), Core crash loops (quarantine and escalate), secret leak (revoke and rotate).

### Integration Notes Specific to This Action1 Core
- Env requirements: `API_BASE` for region, bearer token env var (e.g., `BEARER_TOKEN`), optional `ALLOW_DESTRUCTIVE`.
- Org-scoped operations: Many endpoints require `orgId`; the Hub should not inject these—let clients pass them or set per-tenant defaults at Hub config.
- Guardrails: The Core requires `confirm:"YES"` and `ALLOW_DESTRUCTIVE=true` for destructive tools. The Hub can add a safety net to block destructive calls globally.
- Tool catalog: The Core registers a stable set of generic tools. The Hub should list these and present namespaced versions to clients.
- Versioning/spec drift: Periodically run `npm run audit:endpoints` inside the Core workspace and collect the Spec Audit header for compliance records.

