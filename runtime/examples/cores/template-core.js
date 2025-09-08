#!/usr/bin/env node
// Template MCP Core over STDIO (JSON-RPC with LSP-style framing)
// Purpose: Demonstrate the minimal methods and a single 'echo' tool.
// This file is a reference template, not a production core.

const { stdin, stdout } = process;

// Define your tools with JSON Schema input
const TOOLS = [
  {
    name: 'echo',
    description: 'Echo back provided text',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    }
  }
];

let buffer = Buffer.alloc(0);

function send(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const headers = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`);
  stdout.write(headers);
  stdout.write(payload);
}

function handle(msg) {
  const { id, method, params } = msg || {};
  switch (method) {
    case 'initialize':
      return send({ jsonrpc: '2.0', id, result: { serverInfo: { name: 'template-core', version: '0.0.1' }, capabilities: { tools: {} } } });
    case 'ping':
      return send({ jsonrpc: '2.0', id, result: { ok: true } });
    case 'tools/list':
      return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    case 'tools/call': {
      const name = params?.name;
      if (name === 'echo') {
        const text = String(params?.arguments?.text ?? '');
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: false } });
      }
      return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } });
    }
    default:
      return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } });
  }
}

function pump() {
  for (;;) {
    const sep = buffer.indexOf('\r\n\r\n');
    if (sep === -1) return;
    const header = buffer.slice(0, sep).toString('utf8');
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) { buffer = buffer.slice(sep + 4); continue; }
    const len = parseInt(m[1], 10);
    const start = sep + 4;
    if (buffer.length < start + len) return;
    const body = buffer.slice(start, start + len).toString('utf8');
    buffer = buffer.slice(start + len);
    try { handle(JSON.parse(body)); } catch {}
  }
}

stdin.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); pump(); });

