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

async function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function main(){
  const manifestPath = path.resolve('examples/manifests/hub.yaml');
  const orig = fs.readFileSync(manifestPath, 'utf8');
  const env = { ...process.env, HUB_MANIFEST: manifestPath, HUB_ALLOW_TEST_SHUTDOWN: '1' };
  const hub = spawn(process.execPath, ['runtime/src/hub.js', '--stdio'], { stdio: 'pipe', env });
  let out = Buffer.alloc(0);
  let sawTemplateEcho = false;
  let sawTemplate2Echo = false;
  let id = 1;

  hub.stdout.on('data', chunk => {
    out = Buffer.concat([out, chunk]);
    const { messages, rest } = parseFrames(out);
    out = rest;
    for (const m of messages){
      if (m.result?.tools) {
        const names = m.result.tools.map(t=>t.name);
        if (names.includes('template.echo')) sawTemplateEcho = true;
        if (names.includes('template2.echo')) sawTemplate2Echo = true;
      }
    }
  });

  // initial list
  hub.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'initialize', params: {} }));
  hub.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} }));
  await delay(400);

  // modify manifest: change namespace from template to template2
  const modified = orig.replace('namespace: template', 'namespace: template2');
  fs.writeFileSync(manifestPath, modified, 'utf8');
  await delay(600);

  // list again
  hub.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} }));
  await delay(400);

  // restore manifest and exit
  fs.writeFileSync(manifestPath, orig, 'utf8');
  hub.stdin.write(frame({ jsonrpc: '2.0', id: id++, method: 'hub/test/exit', params: {} }));
  await delay(200);

  if (sawTemplateEcho && sawTemplate2Echo){
    console.log('Hot-reload STDIO test passed');
    process.exit(0);
  } else {
    console.error('Hot-reload STDIO test failed', { sawTemplateEcho, sawTemplate2Echo });
    process.exit(1);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });

