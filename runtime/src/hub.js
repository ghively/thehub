#!/usr/bin/env node
// Minimal scaffold: MCP-like Hub with STDIO and WebSocket servers.
// Adds manifest-driven Core supervision (STDIO) and namespaced tool routing.

import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';
import { loadAndValidateManifest } from './manifest.js';

const args = process.argv.slice(2);

// In-memory registry: namespaced tool id -> { core, tool }
const registry = new Map();
const cores = new Map(); // coreName -> { proc, rpc, namespace, tools: [] }

// Basic JSON-RPC over STDIO (LSP framing) client
class JsonRpcStdioClient {
  constructor(child) {
    this.child = child;
    this.buffer = Buffer.alloc(0);
    this.idSeq = 1;
    this.pending = new Map();
    child.stdout.on('data', (chunk) => this._onData(chunk));
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const sep = this.buffer.indexOf('\r\n\r\n');
      if (sep === -1) break;
      const header = this.buffer.slice(0, sep).toString('utf8');
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) break;
      const len = parseInt(m[1], 10);
      const start = sep + 4;
      if (this.buffer.length < start + len) break;
      const body = this.buffer.slice(start, start + len).toString('utf8');
      this.buffer = this.buffer.slice(start + len);
      try {
        const msg = JSON.parse(body);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch {}
    }
  }
  _send(obj) {
    const payload = Buffer.from(JSON.stringify(obj), 'utf8');
    const headers = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, 'utf8');
    this.child.stdin.write(headers);
    this.child.stdin.write(payload);
  }
  request(method, params = {}) {
    const id = this.idSeq++;
    const req = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this._send(req);
    });
  }
}

async function spawnCore(name, cfg) {
  const { command, args = [], cwd = process.cwd(), env = {}, namespace = name } = cfg;
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env } });
  const rpc = new JsonRpcStdioClient(child);
  await rpc.request('initialize', {});
  const toolsResp = await rpc.request('tools/list', {});
  const tools = toolsResp.tools || [];
  const core = { proc: child, rpc, namespace, tools };
  cores.set(name, core);
  for (const t of tools) {
    const nsName = `${namespace}.${t.name}`;
    registry.set(nsName, { core, tool: t });
  }
}

async function initCoresFromManifest() {
  const { manifest, errors } = loadAndValidateManifest();
  if (!manifest) {
    // eslint-disable-next-line no-console
    console.error('Manifest validation failed:', errors.join('; '));
    process.exitCode = 2;
    return;
  }
  const names = Object.keys(manifest.cores || {});
  for (const n of names) {
    await spawnCore(n, manifest.cores[n]);
  }
}

function mcpInitializeResponse(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      serverInfo: { name: 'thehub-stub', version: '0.0.1' },
      capabilities: {
        // Keep capabilities minimal for now
        tools: { listChangedNotification: true }
      }
    }
  };
}

function mcpListToolsResponse(id) {
  const tools = [];
  for (const [name, { tool }] of registry.entries()) {
    tools.push({ ...tool, name });
  }
  return { jsonrpc: '2.0', id, result: { tools } };
}

function mcpCallToolResponse(id, params) {
  const full = params?.name || '';
  const entry = registry.get(full);
  if (!entry) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${full}` } };
  }
  const { core } = entry;
  const bareName = full.includes('.') ? full.split('.').slice(1).join('.') : full;
  return core.rpc
    .request('tools/call', { name: bareName, arguments: params?.arguments || {} })
    .then((result) => ({ jsonrpc: '2.0', id, result }))
    .catch((error) => ({ jsonrpc: '2.0', id, error }));
}

function handleJsonRpc(message) {
  // Very small router for MCP-like methods used by Connections
  const { id, method, params } = message || {};
  if (!method) return null;
  if (method === 'hub/test/exit') {
    if (process.env.HUB_ALLOW_TEST_SHUTDOWN === '1') {
      setTimeout(() => process.exit(0), 5);
      return { jsonrpc: '2.0', id, result: { ok: true } };
    }
    return { jsonrpc: '2.0', id, error: { code: 403, message: 'test shutdown not allowed' } };
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: { ok: true } };
  if (method === 'initialize') return mcpInitializeResponse(id);
  if (method === 'tools/list') return mcpListToolsResponse(id);
  if (method === 'tools/call') return mcpCallToolResponse(id, params);
  // Unknown method
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// STDIO server using LSP-style headers (Content-Length)
function startStdio() {
  let buffer = Buffer.alloc(0);

  function tryProcess() {
    while (true) {
      const sep = buffer.indexOf('\r\n\r\n');
      if (sep === -1) return;
      const header = buffer.slice(0, sep).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Drop until next separator if malformed
        buffer = buffer.slice(sep + 4);
        continue;
      }
      const length = parseInt(match[1], 10);
      const start = sep + 4;
      if (buffer.length < start + length) return; // wait for full body
      const body = buffer.slice(start, start + length).toString('utf8');
      buffer = buffer.slice(start + length);
      try {
        const msg = JSON.parse(body);
        const resp = handleJsonRpc(msg);
        if (resp) sendStdio(resp);
      } catch {
        // ignore parse errors in stub
      }
    }
  }

  function sendStdio(obj) {
    const payload = Buffer.from(JSON.stringify(obj), 'utf8');
    const headers = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, 'utf8');
    process.stdout.write(headers);
    process.stdout.write(payload);
  }

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    tryProcess();
  });

  // Optionally announce availability to clients that auto-ping
}

// WebSocket MCP server (JSON messages per frame). Implements optional token auth via env HUB_TOKEN
function startWebSocket(port = 3000, host = '0.0.0.0') {
  const server = createHttpServer();
  const wss = new WebSocketServer({ server, handleProtocols: (protocols) => {
    // Prefer 'mcp' subprotocol if client offers it
    if (protocols.has('mcp')) return 'mcp';
    return true; // accept any
  }});

  const TOKEN = process.env.HUB_TOKEN;

  wss.on('connection', (ws, req) => {
    if (TOKEN) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${TOKEN}`) {
        ws.close(4401, 'unauthorized');
        return;
      }
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const resp = handleJsonRpc(msg);
        if (resp) ws.send(JSON.stringify(resp));
      } catch {
        // ignore
      }
    });
  });

  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Hub WS listening on ws://${host}:${port}`);
  });
}

// CLI
(async () => {
  await initCoresFromManifest();
  if (args.includes('--stdio')) {
    startStdio();
  } else if (args.includes('--ws')) {
    const idx = args.indexOf('--ws');
    const port = Number(args[idx + 1]) || 3000;
    startWebSocket(port);
  } else {
    // eslint-disable-next-line no-console
    console.log('Usage: hub --stdio | --ws <port>');
    process.exit(0);
  }
})();
