// Minimal Prometheus-like metrics registry
class Counter {
  constructor() { this.value = 0; }
  inc(n = 1) { this.value += n; }
}

class LabeledCounter {
  constructor() { this.map = new Map(); }
  inc(labels, n = 1) {
    const key = JSON.stringify(labels || {});
    this.map.set(key, (this.map.get(key) || 0) + n);
  }
}

class Histogram {
  constructor(buckets = [0.01, 0.05, 0.1, 0.3, 1, 3, 10]) {
    this.buckets = buckets.sort((a,b)=>a-b);
    this.counts = new Array(this.buckets.length).fill(0);
    this.sum = 0;
    this.count = 0;
  }
  observe(v) {
    this.sum += v; this.count += 1;
    for (let i=0;i<this.buckets.length;i++) {
      if (v <= this.buckets[i]) { this.counts[i]++; break; }
    }
  }
}

export const metrics = {
  requests_total: new LabeledCounter(), // labels: { client, method, core }
  errors_total: new LabeledCounter(),
  request_latency_seconds: new Histogram(),
};

export function renderPrometheus() {
  let out = '';
  // requests_total
  out += '# HELP requests_total Total requests\n';
  out += '# TYPE requests_total counter\n';
  for (const [k,v] of metrics.requests_total.map.entries()) {
    out += `requests_total${labelsToProm(k)} ${v}\n`;
  }
  // errors_total
  out += '# HELP errors_total Total errors\n';
  out += '# TYPE errors_total counter\n';
  for (const [k,v] of metrics.errors_total.map.entries()) {
    out += `errors_total${labelsToProm(k)} ${v}\n`;
  }
  // histogram (export basic sum/count only for brevity)
  out += '# HELP request_latency_seconds Request latency (seconds)\n';
  out += '# TYPE request_latency_seconds summary\n';
  out += `request_latency_seconds_sum ${metrics.request_latency_seconds.sum}\n`;
  out += `request_latency_seconds_count ${metrics.request_latency_seconds.count}\n`;
  return out;
}

function labelsToProm(serialized) {
  const labels = JSON.parse(serialized);
  const parts = Object.entries(labels).map(([k,v]) => `${k}="${String(v).replace(/"/g,'\\"')}"`);
  return parts.length ? `{${parts.join(',')}}` : '';
}

