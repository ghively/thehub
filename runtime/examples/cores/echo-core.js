#!/usr/bin/env node
// Minimal MCP Core over STDIO (JSON-RPC via LSP framing)
const { stdin, stdout } = process;

const TOOL = {
  name: 'say',
  description: 'Echo back provided text with prefix',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text']
  }
};

let buffer = Buffer.alloc(0);

function send(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const headers = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`);
  stdout.write(headers);
  stdout.write(payload);
}

function onMessage(msg) {
  const { id, method, params } = msg || {};
  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: { serverInfo: { name: 'echo-core', version: '0.0.1' }, capabilities: { tools: {} } } });
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: [TOOL] } });
  } else if (method === 'tools/call') {
    if (params?.name === 'say') {
      const text = String(params?.arguments?.text ?? '');
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `echo: ${text}` }], isError: false } });
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'unknown core tool' } });
    }
  } else if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: { ok: true } });
  } else {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method ${method}` } });
  }
}

function tryProcess() {
  while (true) {
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
    try { onMessage(JSON.parse(body)); } catch {}
  }
}

stdin.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); tryProcess(); });

