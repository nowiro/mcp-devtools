#!/usr/bin/env node

/**
 * validate-inputs.mjs — sanity-check that every tool under `src/tools/`
 * declares the full ToolDefinition contract from `.github/instructions/
 * tool-contract.instructions.md`.
 *
 * Per tool file (excludes *.spec.ts):
 *   - exports `Input` Zod schema (top-level)
 *   - exports `Output` Zod schema (top-level)
 *   - exports `definition: ToolDefinition` (or `default`)
 *   - definition wires `inputSchema: Input` (not inline) — drift catcher
 *   - definition wires `outputSchema: Output` (not inline) — drift catcher
 *   - definition has `name:` (string literal) and `description:` (non-empty)
 *   - definition has `handle(input, ctx)` method
 *
 * Static-only (regex over source). No type-checker round-trip → fast,
 * runnable in pre-commit. tsc catches wiring issues only after full build;
 * this script gates faster.
 *
 * Wired into `npm run verify` — contract drift blocks commits.
 *
 * Usage:
 *   npm run validate:inputs
 *   npm run validate:inputs -- --json
 *
 * Exit codes: 0 clean, 1 any findings.
 *
 * @see .github/instructions/tool-contract.instructions.md
 * @see src/shared/types.ts — ToolDefinition shape
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = parseArgs(process.argv.slice(2));
const JSON_OUT = ARGS.json === true;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** @type {Array<{ file: string; severity: 'ok'|'warn'|'err'; msg: string }>} */
const findings = [];

function record(file, severity, msg) {
  findings.push({ file, severity, msg });
}

const TOOLS_DIR = nodePath.resolve(ROOT, 'src', 'tools');
const files = listFiles(TOOLS_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));

if (files.length === 0) {
  if (!JSON_OUT) process.stdout.write(`${c.warn('⚠')} no tool files found at src/tools/\n`);
  process.exit(0);
}

if (!JSON_OUT) process.stdout.write(`${c.bold('▶ Validating')} ${files.length} tool file(s) under src/tools/\n`);

for (const file of files) {
  const rel = relPath(file);
  const src = readFileSync(file, 'utf8');
  validate(rel, src);
}

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n');
} else {
  const errors = findings.filter((f) => f.severity === 'err');
  const warns = findings.filter((f) => f.severity === 'warn');
  for (const f of findings) {
    const icon = f.severity === 'ok' ? c.ok('✓') : f.severity === 'warn' ? c.warn('⚠') : c.err('✗');
    process.stdout.write(`  ${icon} ${c.dim(f.file)}  ${f.msg}\n`);
  }
  process.stdout.write(`\n${c.bold('Summary:')} ${c.ok(`${files.length - errors.length}/${files.length} clean`)}`);
  if (warns.length > 0) process.stdout.write(`  ${c.warn(`${warns.length} warn`)}`);
  if (errors.length > 0) process.stdout.write(`  ${c.err(`${errors.length} err`)}`);
  process.stdout.write('\n');
}

process.exit(findings.some((f) => f.severity === 'err') ? 1 : 0);

// ── checks ─────────────────────────────────────────────────────────────────

function validate(rel, src) {
  // Tolerate whitespace / newlines between `z` and `.` (e.g. multi-line chain
  // `z\n  .object({...}).refine(...)`).
  const hasExportInput = /export\s+const\s+Input\s*=\s*z\s*\./.test(src);
  const hasExportOutput = /export\s+const\s+Output\s*=\s*z\s*\./.test(src);

  // Match `export const definition: ToolDefinition...= { ... }` block, balanced braces.
  const definitionMatch =
    /export\s+(?:const|default)\s+(?:definition|default)\s*(?::\s*ToolDefinition[^=]*)?\s*=\s*\{([\s\S]*?)\n\}\s*;?/.exec(
      src,
    ) ?? /export\s+default\s+\{([\s\S]*?)\n\}\s*;?/.exec(src);

  if (!hasExportInput) record(rel, 'err', 'missing `export const Input = z.<...>(...)`');
  if (!hasExportOutput) record(rel, 'err', 'missing `export const Output = z.<...>(...)`');

  if (!definitionMatch) {
    record(rel, 'err', 'missing `export const definition: ToolDefinition = { ... }`');
    return;
  }
  const defBody = definitionMatch[1];

  if (!/\bname\s*:\s*['"`][\w.-]+['"`]/.test(defBody)) {
    record(rel, 'err', 'definition.name missing or not a string literal');
  }
  if (!/\bdescription\s*:\s*['"`][^'"`]+['"`]/.test(defBody)) {
    record(rel, 'err', 'definition.description missing or empty literal');
  }
  if (!/\binputSchema\s*:\s*Input\b/.test(defBody)) {
    record(rel, 'err', 'definition.inputSchema must reference exported `Input` (not inline) — drift catcher');
  }
  if (!/\boutputSchema\s*:\s*Output\b/.test(defBody)) {
    record(rel, 'err', 'definition.outputSchema must reference exported `Output` (not inline) — drift catcher');
  }
  if (!/\bhandle\s*[(:]/.test(defBody)) {
    record(rel, 'err', 'definition.handle missing');
  }

  if (
    hasExportInput &&
    hasExportOutput &&
    /inputSchema\s*:\s*Input\b/.test(defBody) &&
    /outputSchema\s*:\s*Output\b/.test(defBody) &&
    /\bhandle\s*[(:]/.test(defBody)
  ) {
    record(rel, 'ok', 'contract OK');
  }
}

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
