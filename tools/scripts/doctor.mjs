#!/usr/bin/env node

/**
 * doctor.mjs — repo diagnostics for mcp-devtools.
 *
 * What it checks:
 *   1. Node version vs `package.json#engines.node`
 *   2. dist/ built (server.js + tools/*.js)
 *   3. PROJECT_ROOT resolvable
 *   4. Playwright available in PATH (or as devDependency)
 *   5. OS-specific: npx.cmd on Windows, npx on POSIX
 *   6. .vscode/mcp.json + .github/copilot-instructions.md present
 *
 * Output: list of green ✓ / yellow ⚠ / red ✗ items. Exit 0 when no reds.
 *
 * Flags:
 *   --json            emit JSON instead of text (CI / monitoring)
 *
 * Cross-platform: uses node:path + node:os; no shell-specific commands.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform, release } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const IS_WIN = platform() === 'win32';

// ── ANSI helpers ────────────────────────────────────────────────────────────
// Windows Terminal, PowerShell 7+, macOS Terminal, iTerm2 — all support ANSI.
// Old cmd.exe shows raw escapes; harmless.
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** @typedef {{ section: string; status: 'ok'|'warn'|'err'; msg: string; hint?: string }} Finding */
/** @type {Finding[]} */
const findings = [];

function add(section, status, msg, hint) {
  findings.push({ section, status, msg, ...(hint ? { hint } : {}) });
}

function emit(section, status, msg, hint) {
  add(section, status, msg, hint);
  if (ARGS.has('--json')) return;
  const icon = status === 'ok' ? c.ok('✓') : status === 'warn' ? c.warn('⚠') : c.err('✗');
  process.stdout.write(`  ${icon} ${msg}\n`);
  if (hint) process.stdout.write(`    ${c.dim(hint)}\n`);
}

function step(name) {
  if (ARGS.has('--json')) return;
  process.stdout.write(`\n${c.bold(`▶ ${name}`)}\n`);
}

// ── 1. Node version ─────────────────────────────────────────────────────────
step('Node version');
const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const enginesNode = pkgJson.engines?.node;
const have = process.versions.node;
const requiredMajor = enginesNode?.match(/(\d+)/)?.[1];
const haveMajor = have.split('.')[0];
if (!enginesNode) {
  emit('node', 'warn', `Node ${have} (no engines.node declared in package.json)`);
} else if (Number(haveMajor) >= Number(requiredMajor)) {
  emit('node', 'ok', `Node ${have} (satisfies engines.node ${enginesNode})`);
} else {
  emit('node', 'warn', `Node ${have} but engines.node requires ${enginesNode}`, 'Use nvm / volta / fnm to switch');
}

// ── 2. OS detection ─────────────────────────────────────────────────────────
step('Operating system');
const osName = IS_WIN ? `Windows ${release()}` : `${platform()} ${release()}`;
emit('os', 'ok', osName, IS_WIN ? 'Using npx.cmd for spawn calls' : 'Using npx for spawn calls');

// ── 3. Build artifacts ──────────────────────────────────────────────────────
step('Build artifacts');
const distServer = join(ROOT, 'dist', 'server.js');
if (existsSync(distServer)) {
  emit('build', 'ok', `dist/server.js present`);
} else {
  emit('build', 'err', `dist/server.js missing`, 'Run: npm run build');
}

const distTools = ['analyze-code', 'compliance-report', 'propose-fix', 'run-playwright'];
const missingTools = distTools.filter((t) => !existsSync(join(ROOT, 'dist', 'tools', `${t}.js`)));
if (missingTools.length === 0) {
  emit('build', 'ok', `all 4 tools compiled to dist/tools/`);
} else {
  emit('build', 'err', `missing tools in dist/: ${missingTools.join(', ')}`, 'Run: npm run build');
}

// ── 4. PROJECT_ROOT ─────────────────────────────────────────────────────────
step('PROJECT_ROOT sandbox');
const projectRoot = process.env['PROJECT_ROOT'];
if (!projectRoot) {
  emit('sandbox', 'warn', `PROJECT_ROOT not set — sandbox defaults to cwd`, `cwd = ${ROOT}`);
} else {
  const resolved = resolve(projectRoot);
  if (existsSync(resolved)) {
    emit('sandbox', 'ok', `PROJECT_ROOT = ${resolved}`);
  } else {
    emit('sandbox', 'err', `PROJECT_ROOT path does not exist: ${resolved}`);
  }
}

// ── 5. Playwright availability ──────────────────────────────────────────────
step('Playwright');
// Look for @playwright/test in devDependencies and node_modules.
const hasPlaywrightDep = !!pkgJson.devDependencies?.['@playwright/test'];
const hasPlaywrightInstalled = existsSync(join(ROOT, 'node_modules', '@playwright', 'test'));
if (hasPlaywrightDep && hasPlaywrightInstalled) {
  emit('playwright', 'ok', `@playwright/test installed (${pkgJson.devDependencies['@playwright/test']})`);
} else if (hasPlaywrightDep) {
  emit('playwright', 'warn', `@playwright/test declared but not installed`, 'Run: npm ci');
} else {
  emit('playwright', 'warn', `@playwright/test not in devDependencies — run_playwright tool will fail in target repo unless they have it`);
}

// Look for npx in PATH.
const npxName = IS_WIN ? 'npx.cmd' : 'npx';
const pathDirs = (process.env['PATH'] ?? '').split(delimiter);
const npxFound = pathDirs.some((d) => d && existsSync(join(d, npxName)));
if (npxFound) {
  emit('playwright', 'ok', `${npxName} found in PATH`);
} else {
  emit('playwright', 'err', `${npxName} not in PATH`, 'Reinstall Node — npx ships with npm');
}

// ── 6. IDE config files ─────────────────────────────────────────────────────
step('IDE config');
const ideFiles = [
  { path: '.vscode/mcp.json', label: 'VS Code MCP registry' },
  { path: '.vscode/settings.json', label: 'VS Code settings' },
  { path: '.vscode/extensions.json', label: 'VS Code recommended extensions' },
  { path: '.github/copilot-instructions.md', label: 'Copilot rulebook' },
];
for (const { path, label } of ideFiles) {
  if (existsSync(join(ROOT, path))) {
    emit('ide', 'ok', `${path} (${label})`);
  } else {
    emit('ide', 'warn', `${path} missing (${label})`);
  }
}

// ── 7. User home for config (informational) ─────────────────────────────────
step('User home');
emit(
  'home',
  'ok',
  `homedir() = ${homedir()}`,
  IS_WIN
    ? 'Windows-style path returned by Node — used by future tools needing user-profile config'
    : 'POSIX-style path returned by Node — used by future tools needing user-profile config',
);

// ── Output ──────────────────────────────────────────────────────────────────
if (ARGS.has('--json')) {
  process.stdout.write(`${JSON.stringify({ findings }, null, 2)}\n`);
}

const errors = findings.filter((f) => f.status === 'err').length;
const warnings = findings.filter((f) => f.status === 'warn').length;

if (!ARGS.has('--json')) {
  process.stdout.write(`\n${c.bold('Summary')}\n`);
  process.stdout.write(`  ${c.ok(`${findings.length - errors - warnings} ok`)}`);
  if (warnings) process.stdout.write(`, ${c.warn(`${warnings} warn`)}`);
  if (errors) process.stdout.write(`, ${c.err(`${errors} err`)}`);
  process.stdout.write('\n');
}

process.exit(errors > 0 ? 1 : 0);
