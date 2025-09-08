# Operations & Runbooks (Hub)

## SLOs (suggested)
- Availability: 99.9%
- p95 Latency (single Core call): < 300 ms (excluding Core/API latency)
- Error Budget: 0.1%

## Common Procedures
- Core crash loop: open circuit, quarantine, notify on-call, inspect logs, restart with backoff.
- Secret rotation: drain traffic, respawn Core with new env, verify health, resume.
- Rate-limit storms: reduce per-Core concurrency, respect Retry-After/headers, surface 429s.

## Deployment Checklist
- Manifests validated; secrets provisioned.
- OTel endpoints reachable; dashboards updated.
- Canary Hub instance healthy before full rollout.

## Incident Response
- Correlate `req_id` across Hub/Core logs.
- Identify failing Core(s); isolate with circuit breaker.
- Communicate blast radius and expected recovery time.

