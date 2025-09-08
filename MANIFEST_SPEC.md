# Hub Manifest Specification

Defines how the Hub discovers, launches, and manages Cores.

## Transport Neutrality
- The manifest is the single source of truth for Cores across all client transports.
- Adding or modifying a Core in the manifest makes it available to:
  - ChatGPT via MCP Connections (Command/STDIO or WebSocket URL), and
  - Any other MCP client (STDIO or WebSocket),
  without additional per-transport configuration.

## Schema (YAML)
```yaml
cores:
  <coreName>:
    command: <string>
    args: [<string>, ...]
    cwd: <string>
    env: { KEY: VALUE, ... }          # non-secret env
    secrets:                          # secret keys resolved by the Hub
      - BEARER_TOKEN
    namespace: <string>               # e.g., "action1"
    policy:
      allow_destructive: false        # hub-level override
      max_concurrency: 8
      rate_limit_rps: 50
      deny_tools: []                  # optional list
      allow_tools: []                 # optional list
    health:
      startup_timeout_ms: 10000
      ping_interval_ms: 30000
      restart_backoff_ms: 2000
    scaling:
      min: 1
      max: 3                          # optional, if Hub supports multi-instance per core
    tags: ["prod", "us-east"]
```

## Resolution and Reload
- The Hub loads this manifest at startup and on change (hot-reload).
- Secret values come from a secret manager; only keys are listed in the manifest.

## Validation Rules
- `namespace` must be unique per Core.
- `command` required; `args` optional.
- `max_concurrency` defaults to 4 if omitted.

## Example
```yaml
cores:
  action1:
    command: node
    args: ["--enable-source-maps", "dist/server.js"]
    cwd: /opt/cores/action1
    env:
      API_BASE: https://app.action1.com/api/3.0
    secrets:
      - BEARER_TOKEN
    namespace: action1
    policy:
      allow_destructive: false
      max_concurrency: 8
    health:
      startup_timeout_ms: 15000
      ping_interval_ms: 20000
      restart_backoff_ms: 3000
    tags: ["prod"]
```
