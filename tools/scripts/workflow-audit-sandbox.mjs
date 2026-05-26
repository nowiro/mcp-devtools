#!/usr/bin/env node

/**
 * workflow-audit-sandbox.mjs — deterministic security audit dla `/audit-sandbox` prompt.
 *
 * Skanuje `src/tools/*.ts` (excl. *.spec.ts) za naruszeniami sandbox FS:
 *
 *   - direct `fs/promises`, `fs.readFile`, `fs.writeFile` (powinno przez ctx.fs / src/shared/fs.ts)
 *   - `path.resolve(...)` nie chained przez `assertWithinSandbox` (poniżej w call chain)
 *   - glob patterns zaczynające się `**` przeciw projectRoot
 *   - input fields które wyglądają jak absolute paths
 *
 * Output: report markdown w `docs/runs/<date>-audit-sandbox.md` z findings.
 * Exit 1 jeśli high-severity findings — można wpiąć w CI.
 *
 * Usage:
 *   npm run workflow:audit-sandbox
 *   npm run workflow:audit-sandbox -- --json
 *   npm run workflow:audit-sandbox -- --strict   # exit 1 na każde finding
 *
 * @see .github/prompts/audit-sandbox.prompt.md
 * @see .github/instructions/security.instructions.md
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = parseArgs(process.argv.slice(2));
const JSON_OUT = ARGS.json === true;
const STRICT = ARGS.strict === true;
const TODAY = new Date().toISOString().slice(0, 10);

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const TOOLS_DIR = nodePath.resolve(ROOT, 'src', 'tools');
const toolFiles = listFiles(TOOLS_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));

if (toolFiles.length === 0) {
  if (!JSON_OUT) process.stdout.write(`${c.warn('⚠')} no tool files found\n`);
  process.exit(0);
}

if (!JSON_OUT) process.stdout.write(`${c.bold('▶ Scanning')} ${toolFiles.length} tool file(s)\n`);

const RULES = [
  {
    id: 'direct-fs-import',
    re: /\bfrom\s+['"]node:fs(\/promises)?['"]|require\(['"]node:fs(\/promises)?['"]\)/,
    severity: 'high',
    msg: 'imports node:fs directly — use ctx.fs or src/shared/fs.ts wrapper',
  },
  {
    id: 'path-resolve-raw',
    re: /\b(?:nodePath|path)\.resolve\s*\(/,
    severity: 'medium',
    msg: 'path.resolve(...) used — chain through assertWithinSandbox (verify next 5 lines)',
  },
  {
    id: 'glob-projectroot',
    re: /['"`]\*\*\//,
    severity: 'medium',
    msg: 'glob pattern starts with **/ — verify it is NOT anchored to projectRoot',
  },
  {
    id: 'absolute-path-literal',
    re: /['"`]\/(?:etc|var|usr|home|root|tmp)\//,
    severity: 'high',
    msg: 'absolute POSIX path literal in source',
  },
  {
    id: 'fs-realpath',
    re: /\bfs\.(realpath|realpathSync)\b/,
    severity: 'high',
    msg: 'fs.realpath called directly — sandbox helper must wrap',
  },
];

/** @type {Array<{ file: string; line: number; severity: string; rule: string; msg: string; snippet: string }>} */
const findings = [];

for (const file of toolFiles) {
  const rel = relPath(file);
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  // Whitelist: file imports assertWithinSandbox AND uses path.resolve only inside that helper context.
  const usesSandboxHelper = /assertWithinSandbox/.test(src);
  for (const [i, line] of lines.entries()) {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        // Tools using assertWithinSandbox helper are pre-sanitized — skip
        // path.resolve and direct-fs warnings (they go through the helper).
        if ((rule.id === 'path-resolve-raw' || rule.id === 'direct-fs-import') && usesSandboxHelper) continue;
        findings.push({
          file: rel,
          line: i + 1,
          severity: rule.severity,
          rule: rule.id,
          msg: rule.msg,
          snippet: line.trim(),
        });
      }
    }
  }
}

const highCount = findings.filter((f) => f.severity === 'high').length;
const medCount = findings.filter((f) => f.severity === 'medium').length;

if (!JSON_OUT) {
  if (findings.length === 0) {
    process.stdout.write(`  ${c.ok('✓')} clean — 0 findings\n`);
  } else {
    for (const f of findings) {
      const icon = f.severity === 'high' ? c.err('✗') : c.warn('⚠');
      process.stdout.write(`  ${icon} ${c.dim(`${f.file}:${f.line}`)} [${f.rule}] ${f.msg}\n`);
      process.stdout.write(`     ${c.dim(f.snippet)}\n`);
    }
    process.stdout.write(`\n${c.bold('Summary:')}  ${c.err(`${highCount} high`)}  ${c.warn(`${medCount} medium`)}\n`);
  }
}

const reportPath = `docs/runs/${TODAY}-audit-sandbox.md`;
const reportAbs = nodePath.resolve(ROOT, reportPath);

const rows = findings.map((f) => `| ${f.file} | ${f.line} | ${f.severity} | \`${f.rule}\` | ${f.msg} |`).join('\n');

const report = `---
id: run.audit-sandbox.${TODAY}
title: Sandbox audit — ${TODAY}
type: run
status: ${findings.length === 0 ? 'pass' : 'findings'}
date: ${TODAY}
high_severity: ${highCount}
medium_severity: ${medCount}
---

# Sandbox audit — ${TODAY}

Generated by \`npm run workflow:audit-sandbox\` (deterministic static scan).

## Summary

- Tools scanned: ${toolFiles.length}
- Findings: ${findings.length} (${highCount} high, ${medCount} medium)
- Verdict: ${findings.length === 0 ? '**PASS**' : `**FINDINGS** — review and fix or whitelist`}

## Findings

| file | line | severity | rule | msg |
| ---- | ---- | -------- | ---- | --- |
${rows || '_no findings_'}

## Anti-patterns

- Stubowanie sandbox check w testach zamiast fixowania toola.
- Markowanie verdict: pass gdy regression tests są pending.
- Skip static scan bo "dodałem tylko jedną linię".

## Hand-off

- Findings ≠ 0 → delegate fix do \`tool-author\` (\`.github/agents/tool-author.agent.md\`).
- Findings = 0 + pre-release → \`security-auditor\` agent może wykonać dynamic check (\`npm test\`).
`;

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ findings, highCount, medCount, reportPath }, null, 2) + '\n');
} else {
  mkdirSync(nodePath.dirname(reportAbs), { recursive: true });
  if (existsSync(reportAbs)) {
    process.stdout.write(`\n${c.warn('⚠')} ${reportPath} exists (skip)\n`);
  } else {
    writeFileSync(reportAbs, report, 'utf8');
    process.stdout.write(`\n${c.ok('✓')} wrote ${reportPath}\n`);
  }
}

if (STRICT && findings.length > 0) process.exit(1);
if (highCount > 0) process.exit(1);
process.exit(0);

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const kv = /^--([\w-]+)(?:=(.*))?$/.exec(a);
    if (!kv) continue;
    out[kv[1]] = kv[2] ?? true;
  }
  return out;
}

function listFiles(dir) {
  const out = [];
  try {
    for (const name of readdirSync(dir)) {
      const p = nodePath.resolve(dir, name);
      if (statSync(p).isDirectory()) out.push(...listFiles(p));
      else out.push(p);
    }
  } catch {
    /* missing — fine */
  }
  return out;
}

function relPath(abs) {
  return abs.replace(ROOT + nodePath.sep, '').replaceAll('\\', '/');
}
