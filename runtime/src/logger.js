export function createLogger(context = {}) {
  function base(level, msg, extra) {
    const now = new Date().toISOString();
    const entry = redact({ ts: now, level, msg, ...context, ...(extra || {}) });
    process.stderr.write(JSON.stringify(entry) + "\n");
  }
  return {
    info: (msg, extra) => base('info', msg, extra),
    warn: (msg, extra) => base('warn', msg, extra),
    error: (msg, extra) => base('error', msg, extra)
  };
}

const SECRET_KEYS = ['authorization', 'token', 'secret', 'password', 'bearer', 'api_key', 'apikey'];

function redact(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.includes(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

