#!/usr/bin/env node
/**
 * dev-client.mjs — minimalny klient stdio MCP do testów ręcznych bez IDE.
 *
 * Spawnuje serwer mcp-devtools jako podproces, robi `initialize`,
 * potem `tools/list`, opcjonalnie woła jedno narzędzie z argumentami.
 *
 * Użycie:
 *   node tools/scripts/dev-client.mjs
 *   node tools/scripts/dev-client.mjs <tool> '<json-args>'
 *
 * Przykłady:
 *   node tools/scripts/dev-client.mjs
 *   node tools/scripts/dev-client.mjs mcp-devtools.get_usage_history '{}'
 *   node tools/scripts/dev-client.mjs analyze_code '{"path":".","depth":2}'
 *   node tools/scripts/dev-client.mjs compliance_report '{"project_root":".","standards_path":"./standards"}'
 *
 * Wymagane uprzednio:
 *   - `npm run build` (skrypt woła `dist/server.js`)
 *   - PROJECT_ROOT ustawiony (lub defaultuje do cwd)
 *
 * Zmienne środowiskowe:
 *   PROJECT_ROOT   — sandbox root; jeśli nie ustawiony, używa cwd
 *   LOG_LEVEL      — trace/debug/info/warn/error/fatal (default: info)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const [toolName, rawArgs] = process.argv.slice(2);

const serverPath = resolve(REPO_ROOT, 'dist', 'server.js');
if (!existsSync(serverPath)) {
  process.stderr.write(`Server binary not found: ${serverPath}\nRun \`npm run build\` first.\n`);
  process.exit(2);
}

let parsedArgs = {};
if (rawArgs) {
  try {
    parsedArgs = JSON.parse(rawArgs);
  } catch (err) {
    process.stderr.write(`Invalid JSON for tool args: ${err.message}\n`);
    process.exit(2);
  }
}

const env = {
  ...process.env,
  PROJECT_ROOT: process.env['PROJECT_ROOT'] ?? process.cwd(),
  LOG_LEVEL: process.env['LOG_LEVEL'] ?? 'info',
};

const server = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env,
});

let buffer = '';
const pending = new Map();
let nextId = 1;

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: '2.0', id, method, params };
  server.stdin.write(JSON.stringify(msg) + '\n');
  return new Promise((resolveP, rejectP) => {
    pending.set(id, { resolve: resolveP, reject: rejectP });
  });
}

server.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stderr.write(`[non-JSON stdout from server]: ${line}\n`);
      continue;
    }
    const handler = pending.get(msg.id);
    if (handler) {
      pending.delete(msg.id);
      if (msg.error) handler.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      else handler.resolve(msg.result);
    }
  }
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    process.stderr.write(`Server exited with code ${code}\n`);
    process.exit(code);
  }
});

try {
  const init = await send('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'mcp-devtools-dev-client', version: '0.0.0' },
  });
  process.stdout.write(`# initialize\n${JSON.stringify(init, null, 2)}\n\n`);

  const tools = await send('tools/list', {});
  process.stdout.write(`# tools/list (${tools.tools?.length ?? 0} tools)\n`);
  for (const t of tools.tools ?? []) {
    process.stdout.write(`  - ${t.name}\n`);
  }
  process.stdout.write('\n');

  if (toolName) {
    const result = await send('tools/call', { name: toolName, arguments: parsedArgs });
    process.stdout.write(`# tools/call ${toolName}\n${JSON.stringify(result, null, 2)}\n`);
  }
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
