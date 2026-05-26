#!/usr/bin/env node
/**
 * extract-analyze — non-interactive CLI dla `analyze_code` tool.
 *
 * Deterministic alternative do MCP stdio: pozwala uruchomić analyze_code
 * w CI / cron / batch bez Copilot round-trip. Dzieli 100% kodu z tool
 * handlerem (importuje `definition` z `src/tools/analyze-code.ts`), tylko
 * dodaje CLI wrapper + markdown reporting.
 *
 * Usage:
 *   npm run extract:analyze -- --path=src/app --depth=3 --framework=angular
 *   npm run extract:analyze -- --path=. --no-metrics --json
 *   npm run extract:analyze -- --path=src --output=docs/runs/analyze.md
 *
 * Flags:
 *   --path=<dir>           directory to scan (required)
 *   --depth=<n>            max walk depth (default 3, max 5)
 *   --framework=<f>        auto | angular | react | vue | none (default auto)
 *   --no-metrics           skip per-framework metrics (faster)
 *   --output=<path>        markdown report path (default: output/<date>-analyze-<slug>.md)
 *   --json                 emit raw JSON to stdout (skips markdown report)
 *
 * Exit codes: 0 OK, 1 high findings detected, 2 usage error.
 *
 * @see src/tools/analyze-code.ts — runtime definition
 * @see templates/responses/analyze-code-finding.md — markdown rendering
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import nodePath from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { definition } from './tools/analyze-code.js';
import { renderTemplate } from './shared/response-template.js';
import type { ToolContext } from './shared/types.js';

const { values } = parseArgs({
  options: {
    path: { type: 'string', short: 'p' },
    depth: { type: 'string', short: 'd' },
    framework: { type: 'string', short: 'f' },
    metrics: { type: 'boolean' },
    'no-metrics': { type: 'boolean' },
    output: { type: 'string', short: 'o' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

if (values.help === true || !values.path) {
  process.stderr.write(
    'Usage: npm run extract:analyze -- --path=<dir> [--depth=3] [--framework=auto|angular|react|vue|none] [--no-metrics] [--output=<path>] [--json]\n',
  );
  process.exit(values.help === true ? 0 : 2);
}

const projectRoot = process.cwd();
const ctx: ToolContext = {
  log: (entry) => process.stderr.write(JSON.stringify(entry) + '\n'),
  projectRoot,
};

const input = {
  path: String(values.path),
  depth: values.depth !== undefined ? Number(values.depth) : 3,
  framework: (values.framework !== undefined ? String(values.framework) : 'auto') as
    | 'auto'
    | 'angular'
    | 'react'
    | 'vue'
    | 'none',
  metrics: values['no-metrics'] === true ? false : true,
};

const result = await definition.handle(input, ctx);

if (values.json === true) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  const today = new Date().toISOString().slice(0, 10);
  const slugSource = String(values.path);
  const slug = slugSource.replaceAll(/[/\\]/g, '_').replaceAll(/[^\w-]/g, '');
  const defaultOut = `output/${today}-analyze-${slug}.md`;
  const outPath = nodePath.resolve(projectRoot, String(values.output ?? defaultOut));

  // Use response-template to render — same shape as MCP stdio path.
  const findings = (result as { findings?: unknown[] }).findings ?? [];
  const framework = (result as { framework?: string }).framework ?? input.framework;
  const cacheHit = (result as { cache_hit?: boolean }).cache_hit ?? false;
  const metricsBlock = (result as { metrics?: Record<string, unknown> }).metrics;

  const markdown = renderTemplate('analyze-code-finding', {
    target: input.path,
    framework,
    filesScanned: metricsBlock?.['files_scanned'] ?? 0,
    linesScanned: metricsBlock?.['total_lines'] ?? 0,
    cacheHits: cacheHit ? 1 : 0,
    metrics: metricsBlock ? Object.entries(metricsBlock).map(([name, value]) => ({ name, value })) : undefined,
    findings,
    dependencies: [],
  });

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- outPath is CLI-controlled output, resolved under projectRoot
  await mkdir(nodePath.dirname(outPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- same as above
  if (existsSync(outPath)) {
    process.stderr.write(`⚠ ${outPath} exists — overwriting\n`);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- same as above
  await writeFile(outPath, markdown, 'utf8');
  process.stderr.write(`✓ wrote ${nodePath.relative(projectRoot, outPath)} (${findings.length} findings)\n`);
}

// Exit 1 if any finding is a high-severity legacy-pattern or dangerous-html
const findings = (result as { findings?: { kind?: string }[] }).findings ?? [];
const highSev = findings.some((f) => f.kind === 'dangerous-html' || f.kind === 'legacy-pattern');
process.exit(highSev ? 1 : 0);
