#!/usr/bin/env node

/**
 * bootstrap.mjs — one-command repo initialiser for mcp-devtools.
 *
 * Runs after `git clone` to:
 *   1. verify Node version against `package.json#engines.node`
 *   2. install dependencies (skips if `node_modules` already exists)
 *   3. set up git hooks (`npm run prepare` → husky)
 *   4. build the TypeScript sources to `dist/`
 *   5. run `doctor` for final sanity
 *
 * Cross-platform: pure Node stdlib, no external deps. Works identically on
 * Windows / macOS / Linux. Safe to re-run (idempotent).
 *
 * Flags:
 *   --reinstall      force `npm install` even if node_modules exists
 *   --skip-install   do not run `npm install`
 *   --skip-build     do not run `npm run build`
 *   --skip-doctor    do not run `npm run doctor` at the end
 *
 * @see docs/getting-started/vscode-setup.md
 * @see docs/getting-started/intellij-setup.md
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const IS_WIN = platform() === 'win32';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const findings = [];
let exitCode = 0;

function step(name) {
  process.stdout.write(`\n${c.bold(`▶ ${name}`)}\n`);
}
function log(msg) {
  process.stdout.write(`  ${msg}\n`);
}
function record(severity, msg) {
  findings.push({ severity, msg });
  if (severity === 'err') exitCode = 1;
}
function shell(command, args = [], options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.silent ? 'pipe' : 'inherit',
    // shell:true on Windows is needed for `npm` / `npx` (they're .cmd shims).
    // On POSIX we avoid shell:true to dodge meta-character interpretation.
    shell: IS_WIN,
    ...options,
  });
}

// ─── 1. Node version ────────────────────────────────────────────────────────
step('Verify Node.js');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const enginesNode = pkg.engines?.node;
const requiredMajor = enginesNode?.match(/(\d+)/)?.[1];
const haveMajor = process.versions.node.split('.')[0];
if (requiredMajor && Number(haveMajor) < Number(requiredMajor)) {
  log(c.err(`✗ Node ${process.versions.node} but package.json engines.node requires ${enginesNode}.`));
  log(c.dim('  Use nvm / volta / fnm to switch (e.g. `nvm install 22 && nvm use 22`).'));
  record('err', `Node version below required (have ${process.versions.node}, want ${enginesNode})`);
} else {
  log(c.ok(`✓ Node ${process.versions.node}${enginesNode ? ` (satisfies engines.node ${enginesNode})` : ''}`));
}

// ─── 2. Install ─────────────────────────────────────────────────────────────
step('Install dependencies');
if (ARGS.has('--skip-install')) {
  log(c.dim('skipped (--skip-install)'));
} else if (!ARGS.has('--reinstall') && existsSync(join(ROOT, 'node_modules'))) {
  log(c.ok('✓ node_modules already present'));
  log(c.dim('  (pass --reinstall to force `npm install`)'));
} else {
  log(c.dim('running `npm install` (this may take a minute)...'));
  const result = shell('npm', ['install']);
  if (result.status === 0) {
    log(c.ok('✓ dependencies installed'));
  } else {
    log(c.err('✗ npm install failed'));
    record('err', 'npm install failed');
  }
}

// ─── 3. Git hooks (via `npm run prepare`) ───────────────────────────────────
step('Install git hooks');
// `prepare` is auto-run by npm install but we do it explicitly so re-running
// bootstrap fixes hooks if they got out of sync.
const prepResult = shell('npm', ['run', 'prepare'], { silent: true });
if (prepResult.status === 0) {
  log(c.ok('✓ husky hooks installed (.husky/_)'));
  if (!IS_WIN) {
    log(c.dim('  POSIX: ensure .husky/commit-msg + pre-commit are executable'));
    log(c.dim('  (git tracks the executable bit — should be fine after clone)'));
  }
} else {
  log(c.warn('⚠ `npm run prepare` failed — git hooks may not run'));
  record('warn', 'husky prepare failed');
}

// ─── 4. Build ───────────────────────────────────────────────────────────────
step('Build TypeScript');
if (ARGS.has('--skip-build')) {
  log(c.dim('skipped (--skip-build)'));
} else {
  const result = shell('npm', ['run', 'build']);
  if (result.status === 0) {
    log(c.ok('✓ dist/ built'));
  } else {
    log(c.err('✗ npm run build failed'));
    record('err', 'build failed');
  }
}

// ─── 5. Doctor ──────────────────────────────────────────────────────────────
step('Doctor');
if (ARGS.has('--skip-doctor')) {
  log(c.dim('skipped (--skip-doctor)'));
} else {
  const result = shell('npm', ['run', '--silent', 'doctor']);
  if (result.status === 0) {
    log(c.ok('✓ doctor passed'));
  } else {
    log(c.warn('⚠ doctor reported issues — review output above'));
    record('warn', 'doctor found issues');
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────
step('Summary');
if (findings.length === 0) {
  log(c.ok('✓ bootstrap complete — repo is ready'));
  log(c.dim(`  Next: open ${IS_WIN ? '.\\\\' : './'}in your IDE; Copilot will discover .vscode/mcp.json automatically.`));
} else {
  for (const f of findings) {
    const icon = f.severity === 'ok' ? c.ok('✓') : f.severity === 'warn' ? c.warn('⚠') : c.err('✗');
    log(`${icon} ${f.msg}`);
  }
  if (exitCode === 0) {
    log(c.dim('  Warnings present but no hard failures — proceeding.'));
  }
}

process.exit(exitCode);
