#!/usr/bin/env node
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const manifest = path.resolve('examples/manifests/hub.yaml');
  if (!fs.existsSync(manifest)) throw new Error('manifest missing');
  const port = 3200;
  const env = { ...process.env, HUB_MANIFEST: manifest, HUB_ALLOW_TEST_SHUTDOWN: '1' };
  const server = spawn(process.execPath, ['runtime/src/hub.js', '--ws', String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env });

  await delay(250);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { protocol: 'mcp' });
  let ok = 0;
  let listed = false;

  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.result) {
        ok++;
        if (msg.result.tools) {
          listed = msg.result.tools.some(t => t.name === 'echo.say');
        }
      }
    } catch {}
  });

  let id = 1;
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'initialize', params: {} }));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} }));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'echo.say', arguments: { text: 'hi' } } }));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'hub/test/exit', params: {} }));

  await delay(1000);
  ws.close();
  server.kill();
  if (ok >= 3 && listed) {
    console.log('Hub-Core WS integration passed');
    process.exit(0);
  } else {
    console.error('Hub-Core WS integration failed; responses:', ok, 'listed=', listed);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

