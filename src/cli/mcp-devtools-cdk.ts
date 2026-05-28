#!/usr/bin/env node
/**
 * `mcp-devtools-cdk` — CLI for the Copilot CDK.
 *
 * Usage:
 *   npx mcp-devtools-cdk compile [--out=.github/prompts] [--workflows=src/cdk/workflows]
 *
 * The `compile` command:
 *   1. Discovers all `*.workflow.{ts,js}` files under `--workflows`.
 *   2. Dynamic-imports each. The workflow file MUST default-export a class
 *      extending `Workflow`.
 *   3. Instantiates one `App` and registers every workflow under it.
 *   4. Calls `app.emit({ outDir })` — Handlebars-renders + writes each
 *      `.prompt.md`.
 *
 * Exit codes:
 *   0 — all workflows compiled and written.
 *   1 — discovery / import / render / write failed.
 *
 * Layout note: today we have 2 commands (compile + help) in one file. When the
 * CLI grows to 4+ commands, split into `src/cli/commands/<verb>.ts` mirroring
 * the `github/spec-kit` 0.8.14 refactor (`commands/init.py` extracted from
 * `__init__.py`). YAGNI until then — single file is easier to read.
 */
import { readdir } from 'node:fs/promises';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { App, Workflow } from '../cdk/core/index.js';

interface CliArgs {
  readonly command: 'compile' | 'help';
  readonly outDir: string;
  readonly workflowsDir: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const command = (argv[0] ?? 'help') as CliArgs['command'];
  let outDir = '.github/prompts';
  let workflowsDir = 'dist/cdk/workflows';
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('--out=')) outDir = arg.slice('--out='.length);
    else if (arg.startsWith('--workflows=')) workflowsDir = arg.slice('--workflows='.length);
  }
  return { command, outDir, workflowsDir };
}

async function discoverWorkflows(workflowsDir: string): Promise<string[]> {
  const resolved = nodePath.resolve(workflowsDir);
  const entries = await readdir(resolved, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.workflow\.(js|ts)$/.test(e.name))
    .map((e) => nodePath.resolve(resolved, e.name));
}

/** Dynamic import — workflow file MUST default-export a `Workflow` subclass. */
async function loadWorkflowClass(file: string): Promise<new (scope: App, id: string) => Workflow> {
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  const candidates = Object.values(mod).filter(
    (v): v is new (scope: App, id: string) => Workflow =>
      typeof v === 'function' &&
      Object.prototype.isPrototypeOf.call(Workflow.prototype, (v as { prototype: object }).prototype),
  );
  if (candidates.length === 0) {
    throw new Error(`${file}: no exported Workflow subclass found`);
  }
  if (candidates.length > 1) {
    throw new Error(`${file}: expected exactly one exported Workflow subclass per file`);
  }
  const candidate = candidates[0];
  if (!candidate) {
    throw new Error(`${file}: no exported Workflow subclass found`);
  }
  return candidate;
}

async function compileCommand(args: CliArgs): Promise<number> {
  const files = await discoverWorkflows(args.workflowsDir).catch((err: unknown) => {
    process.stderr.write(`mcp-devtools-cdk: cannot read ${args.workflowsDir}: ${(err as Error).message}\n`);
    return null;
  });
  if (!files) return 1;
  if (files.length === 0) {
    process.stderr.write(`mcp-devtools-cdk: no *.workflow.* files under ${args.workflowsDir}\n`);
    return 1;
  }

  const app = new App();
  for (const file of files) {
    const WorkflowClass = await loadWorkflowClass(file);
    const id = nodePath.basename(file).replace(/\.workflow\.(js|ts)$/, '');
    new WorkflowClass(app, toPascal(id));
  }

  const { written } = app.emit({ outDir: args.outDir });
  for (const path of written) {
    process.stdout.write(`✓ ${nodePath.relative(process.cwd(), path)}\n`);
  }
  return 0;
}

function toPascal(input: string): string {
  return input.replaceAll(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
}

function printHelp(): void {
  process.stdout.write(
    [
      'mcp-devtools-cdk — Copilot CDK compiler',
      '',
      'Commands:',
      '  compile           Compile all *.workflow.* files to .prompt.md',
      '  help              Show this message',
      '',
      'Options for `compile`:',
      '  --out=<dir>       Output directory (default: .github/prompts)',
      '  --workflows=<dir> Workflow source directory (default: dist/cdk/workflows)',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'compile': {
      const code = await compileCommand(args);
      process.exit(code);
      break;
    }
    case 'help':
      printHelp();
      break;
    default: {
      const unknown: never = args.command;
      process.stderr.write(`mcp-devtools-cdk: unknown command "${String(unknown)}"\n`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`mcp-devtools-cdk: ${(err as Error).message}\n`);
  process.exit(1);
});
