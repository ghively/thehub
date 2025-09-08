# Observability (Hub + Cores)

## Tracing (OpenTelemetry)
- Propagate W3C trace context from client → Hub → Core.
- Tag spans with `{core, tool, tenant, req_id}`.
- Add exemplars to metrics for top slow/error paths.

## Metrics (Prometheus)
- Hub: requests_total, errors_total, latency_histogram, queue_depth, concurrency_in_use, circuit_open_total.
- Core-level: per-Core versions of the above; fan-out counts.
- Exporters: OTLP/gRPC or Prometheus scrape endpoints.

## Logging
- Structured JSON, redacted secrets.
- Include correlation IDs; log ingress/egress summaries (status codes, durations).

## Dashboards & Alerts
- Dashboards for per-Core latency, error rates, and queue depth.
- Alerts on error rate thresholds, circuit breaker opens, crash loops.

