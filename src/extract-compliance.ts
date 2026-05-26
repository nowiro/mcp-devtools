#!/usr/bin/env node
/**
 * extract-compliance — non-interactive CLI dla `compliance_report` tool.
 *
 * Deterministic alternative do MCP stdio: pozwala uruchomić compliance_report
 * w CI / cron / batch bez Copilot round-trip. Dzieli 100% kodu z tool
 * handlerem, tylko dodaje CLI wrapper + markdown / SARIF reporting.
 *
 * Usage:
 *   npm run extract:compliance -- --project-root=. --standards-path=docs/standards
 *   npm run extract:compliance -- --project-root=. --standards-path=docs/standards --format=sarif --output=compliance.sarif
 *   npm run extract:compliance -- --project-root=. --standards-path=docs/standards --json
 *
 * Flags:
 *   --project-root=<dir>      root do scoringu (default: cwd)
 *   --standards-path=<dir>    directory z *.md rule files (required)
 *   --format=json|sarif       output format (default: json — markdown report)
 *   --output=<path>           output path (default: output/<date>-compliance.<json|sarif|md>)
 *   --json                    emit raw JSON to stdout (skip file output)
 *
 * Exit codes: 0 score ≥ 80, 1 score < 80, 2 usage error.
 *
 * @see src/tools/compliance-report.ts — runtime definition
 * @see templates/responses/compliance-finding.md — markdown rendering
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { definition } from './tools/compliance-report.js';
import { renderTemplate } from './shared/response-template.js';
import type { ToolContext } from './shared/types.js';

const { values } = parseArgs({
  options: {
    'project-root': { type: 'string' },
    'standards-path': { type: 'string' },
    format: { type: 'string' },
    output: { type: 'string', short: 'o' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

if (values.help === true || !values['standards-path']) {
  process.stderr.write(
    'Usage: npm run extract:compliance -- --project-root=<dir> --standards-path=<dir> [--format=json|sarif] [--output=<path>] [--json]\n',
  );
  process.exit(values.help === true ? 0 : 2);
}

const projectRoot = nodePath.resolve(String(values['project-root'] ?? process.cwd()));
const ctx: ToolContext = {
  log: (entry) => process.stderr.write(JSON.stringify(entry) + '\n'),
  projectRoot,
};

const format = (values.format !== undefined ? String(values.format) : 'json') as 'json' | 'sarif';

const input = {
  project_root: projectRoot,
  standards_path: String(values['standards-path']),
  format,
};

const result = (await definition.handle(input, ctx)) as {
  score: number;
  findings: Record<string, unknown>[];
  sarif?: unknown;
};

if (values.json === true) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.score < 80 ? 1 : 0);
}

const today = new Date().toISOString().slice(0, 10);
const defaultExt = format === 'sarif' ? 'sarif' : 'md';
const defaultOut = `output/${today}-compliance.${defaultExt}`;
const outPath = nodePath.resolve(projectRoot, String(values.output ?? defaultOut));

let payload: string;
if (format === 'sarif' && result.sarif !== undefined) {
  payload = JSON.stringify(result.sarif, null, 2);
} else {
  // Render markdown via response-template
  const passed = result.findings.filter((f) => f['verdict'] === 'pass').length;
  const failed = result.findings.filter((f) => f['verdict'] === 'fail').length;
  const warnings = result.findings.length - passed - failed;
  payload = renderTemplate('compliance-finding', {
    target: nodePath.relative(process.cwd(), projectRoot) || '.',
    rulesScanned: result.findings.length,
    passed,
    failed,
    warnings,
    score: result.score,
    findings: result.findings.length > 0 ? result.findings : undefined,
  });
}

// eslint-disable-next-line security/detect-non-literal-fs-filename -- outPath is CLI-controlled output, resolved under projectRoot
await mkdir(nodePath.dirname(outPath), { recursive: true });
// eslint-disable-next-line security/detect-non-literal-fs-filename -- same as above
if (existsSync(outPath)) {
  process.stderr.write(`⚠ ${nodePath.relative(projectRoot, outPath)} exists — overwriting\n`);
}
// eslint-disable-next-line security/detect-non-literal-fs-filename -- same as above
await writeFile(outPath, payload, 'utf8');
process.stderr.write(
  `✓ wrote ${nodePath.relative(projectRoot, outPath)} (score ${result.score}/100, ${result.findings.length} findings)\n`,
);

process.exit(result.score < 80 ? 1 : 0);
