/**
 * `compile` command — discovers `*.workflow.*` files, dynamic-imports each,
 * registers under one `App`, calls `app.emit({ outDir })` (Handlebars-renders
 * + writes each `.prompt.md`).
 *
 * Exit codes returned by `compileCommand()`:
 *   0 — all workflows compiled and written
 *   1 — discovery / import / render / write failed
 */
import { readdir } from 'node:fs/promises';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { App, Workflow } from '../../cdk/core/index.js';

export interface CompileArgs {
  readonly outDir: string;
  readonly workflowsDir: string;
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

function toPascal(input: string): string {
  return input.replaceAll(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
}

export async function compileCommand(args: CompileArgs): Promise<number> {
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
