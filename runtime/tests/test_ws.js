#!/usr/bin/env node
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const port = 3100;
  const server = spawn(process.execPath, ['runtime/src/hub.js', '--ws', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  let ok = 0;

  await delay(200); // give server a moment to start
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { protocol: 'mcp' });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.result) ok++;
    } catch {}
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let id = 1;
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'initialize', params: {} }));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} }));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'echo.say', arguments: { text: 'hello' } } }));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'ping', params: {} }));

  await delay(500);
  ws.close();
  server.kill();

  if (ok >= 3) {
    console.log('WS test passed');
    process.exit(0);
  } else {
    console.error('WS test failed; responses:', ok);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

