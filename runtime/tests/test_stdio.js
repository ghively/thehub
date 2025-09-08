#!/usr/bin/env node
import { spawn } from 'node:child_process';

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
    messages.push(JSON.parse(body));
    buffer = buffer.slice(start + len);
  }
  return { messages, rest: buffer };
}

async function main() {
  const proc = spawn(process.execPath, ['runtime/src/hub.js', '--stdio'], { stdio: 'pipe' });
  let out = Buffer.alloc(0);
  let ok = 0;
  let id = 1;

  proc.stdout.on('data', (chunk) => {
    out = Buffer.concat([out, chunk]);
    const { messages, rest } = parseFrames(out);
    out = rest;
    for (const msg of messages) {
      if (msg.result) ok++;
    }
  });

  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'initialize', params: {} }));
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} }));
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'echo.say', arguments: { text: 'hello' } } }));
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'ping', params: {} }));
  // Ask child to exit cleanly (test-only)
  process.env.HUB_ALLOW_TEST_SHUTDOWN = '1';
  proc.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'hub/test/exit', params: {} }));

  const timeout = setTimeout(() => {
    console.error('STDIO test timed out');
    process.exit(1);
  }, 3000);

  proc.on('exit', () => clearTimeout(timeout));

  setTimeout(() => {
    if (ok >= 3) {
      console.log('STDIO test passed');
      process.exit(0);
    } else {
      console.error('STDIO test failed; responses:', ok);
      process.exit(1);
    }
  }, 800);
}

main().catch((e) => { console.error(e); process.exit(1); });
