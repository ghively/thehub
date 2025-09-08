#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function frame(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const headers = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, 'utf8');
  return Buffer.concat([headers, payload]);
}

function parseFrames(buffer) {
  const messages = [];
  while (true) {
    const sep = buffer.indexOf('\r\n\r\n');
    if (sep === -1) break;
    const header = buffer.slice(0, sep).toString('utf8');
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) break;
    const len = parseInt(m[1], 10);
    const start = sep + 4;
    if (buffer.length < start + len) break;
    const body = buffer.slice(start, start + len).toString('utf8');
    buffer = buffer.slice(start + len);
    messages.push(JSON.parse(body));
  }
  return { messages, rest: buffer };
}

async function main() {
  const manifest = path.resolve('examples/manifests/hub.yaml');
  if (!fs.existsSync(manifest)) throw new Error('manifest missing');
  const env = { ...process.env, HUB_MANIFEST: manifest, HUB_ALLOW_TEST_SHUTDOWN: '1' };
  const proc = spawn(process.execPath, ['runtime/src/hub.js', '--stdio'], { stdio: 'pipe', env });
  let out = Buffer.alloc(0);
  let ok = 0;
  let listed = false;
  let id = 1;

  proc.stdout.on('data', (chunk) => {
    out = Buffer.concat([out, chunk]);
    const { messages, rest } = parseFrames(out);
    out = rest;
    for (const msg of messages) {
      if (msg.result) {
        ok++;
        if (msg.result.tools) {
          listed = msg.result.tools.some(t => t.name === 'echo.say');
        }
      }
    }
  });

  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'initialize', params: {} }));
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} }));
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'echo.say', arguments: { text: 'hi' } } }));
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'hub/test/exit', params: {} }));

  const timeout = setTimeout(() => { console.error('hub-core stdio timed out'); process.exit(1); }, 4000);
  proc.on('exit', () => clearTimeout(timeout));

  setTimeout(() => {
    if (ok >= 3 && listed) {
      console.log('Hub-Core STDIO integration passed');
      process.exit(0);
    } else {
      console.error('Hub-Core STDIO integration failed; ok=', ok, 'listed=', listed);
      process.exit(1);
    }
  }, 1200);
}

main().catch((e) => { console.error(e); process.exit(1); });

