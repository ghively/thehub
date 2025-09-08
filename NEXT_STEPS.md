# Next Steps / Resume Notes

Context: Barebones Hub with manifest validation, hot-reload, STDIO+WS transports, logging, `/healthz`, and a template Core. Tested locally; WS tests may require elevation in restricted sandboxes.

Immediate follow-ups (within vision):
- Add per-client concurrency caps and simple rate limiting at the Hub.
- Add optional tool input/output validation hooks (warn-only) for development.
- Add simple metrics counters (requests, errors, latencies) and placeholders for OTel.

Operational:
- Create CI to build/push Docker images on main/tag.
- Provide reverse proxy example (Caddy/Traefik) for `wss://` with Authorization header pass-through.

Docs to maintain:
- Keep DEVELOPING_CORES.md aligned with any interface changes.
- Update GUIDE_HUB_AND_CORES.md as transports/policy expand.

