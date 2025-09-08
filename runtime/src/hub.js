#!/usr/bin/env node
// Minimal scaffold: MCP-like STDIO and WebSocket servers with a single echo tool.
// This is a stub for validation only; adjust to the evolving MCP spec as needed.

import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';

const args = process.argv.slice(2);

const ECHO_TOOL = {
  name: 'echo.say',
  description: 'Echo back provided text',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text']
  }
};

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
  return {
    jsonrpc: '2.0',
    id,
    result: { tools: [ECHO_TOOL] }
  };
}

function mcpCallToolResponse(id, params) {
  const text = params?.name === ECHO_TOOL.name ? String(params?.arguments?.text ?? '') : '';
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text }],
      isError: false
    }
  };
}

function handleJsonRpc(message) {
  // Very small router for MCP-like methods used by Connections
  const { id, method, params } = message || {};
  if (!method) return null;
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
if (args.includes('--stdio')) {
  startStdio();
} else if (args.includes('--ws')) {
  const idx = args.indexOf('--ws');
  const port = Number(args[idx + 1]) || 3000;
  startWebSocket(port);
} else {
  // Default help
  // eslint-disable-next-line no-console
  console.log('Usage: hub --stdio | --ws <port>');
  process.exit(0);
}

