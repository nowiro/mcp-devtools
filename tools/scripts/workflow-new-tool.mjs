#!/usr/bin/env node

/**
 * workflow-new-tool.mjs — deterministic scaffolder dla `/new-tool` prompt.
 *
 * Tworzy szkielet nowego MCP toola:
 *   - `src/tools/<slug>.ts` (Input/Output Zod + definition stub)
 *   - `src/tools/<slug>.spec.ts` (vitest stub)
 *   - `docs/specs/<slug>/spec.md` (analyst stub)
 *   - `docs/plans/<date>-new-tool-<slug>.md` (orchestrator plan)
 *
 * LLM agent (tool-author) wypełnia TODOs + rejestruje w src/server.ts.
 *
 * Usage:
 *   npm run workflow:new-tool -- \
 *     --slug=detect-flaky-tests \
 *     --description="Detect Playwright tests with high run-to-run variance." \
 *     --mutates=false
 *
 * @see .github/prompts/new-tool.prompt.md
 * @see .github/instructions/tool-contract.instructions.md
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARGS = parseArgs(process.argv.slice(2));
const TODAY = new Date().toISOString().slice(0, 10);

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const USAGE = 'Usage: npm run workflow:new-tool -- --slug=<kebab-case> --description="..." [--mutates=true|false]';

for (const key of ['slug', 'description']) {
  if (!ARGS[key]) {
    process.stdout.write(`${c.err('Missing required arg:')} --${key}\n${c.dim(USAGE)}\n`);
    process.exit(1);
  }
}
const { slug, description } = ARGS;
const mutates = ARGS.mutates === 'true' || ARGS.mutates === true;

if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
  process.stdout.write(`${c.err(`slug must be kebab-case (got "${slug}")`)}\n`);
  process.exit(1);
}
const toolPath = nodePath.resolve(ROOT, 'src', 'tools', `${slug}.ts`);
if (existsSync(toolPath)) {
  process.stdout.write(`${c.err(`src/tools/${slug}.ts already exists`)}\n`);
  process.exit(1);
}

process.stdout.write(`${c.bold('▶ Pre-flight')}\n  ${c.ok('✓')} slug=${slug} mutates=${mutates}\n`);

const dirs = [`docs/specs/${slug}`, `docs/plans`, `docs/runs`, `src/tools`];
for (const dir of dirs) {
  const abs = nodePath.resolve(ROOT, dir);
  if (!existsSync(abs)) {
    mkdirSync(abs, { recursive: true });
    process.stdout.write(`  ${c.ok('✓')} created ${dir}\n`);
  }
}

const camelSlug = slug.replaceAll(/-([a-z])/g, (_, ch) => ch.toUpperCase());

const inputDecl = mutates
  ? `export const Input = z.object({
  apply: z.boolean().default(false),
  // TODO: required inputs
});`
  : `export const Input = z.object({
  // TODO: required inputs
});`;

const handlerBody = mutates
  ? `    const parsed = Input.parse(input);
    if (!parsed.apply) {
      return {
        data: { dryRun: true, planned: parsed },
        _meta: { tokensEstimate: 0, durationMs: 0 },
      };
    }
    // TODO: perform mutation
    return { data: null, _meta: { tokensEstimate: 0, durationMs: 0 } };`
  : `    const parsed = Input.parse(input);
    // TODO: deterministic logic over \`parsed\`
    return { data: null, _meta: { tokensEstimate: 0, durationMs: 0 } };`;

writeIfMissing(
  `src/tools/${slug}.ts`,
  `/**
 * ${slug} — ${description}
 */
import { z } from 'zod';

import type { ToolDefinition } from '../shared/types.js';

${inputDecl}

export const Output = z.object({
  // TODO: shape
  _meta: z
    .object({
      tokensEstimate: z.number().int().min(0),
      durationMs: z.number().int().min(0),
    })
    .optional(),
});

type InputT = z.infer<typeof Input>;
type OutputT = z.infer<typeof Output>;

export const definition: ToolDefinition<InputT, OutputT> = {
  name: '${slug}',
  description: ${JSON.stringify(description)},
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, _ctx) {
${handlerBody}
  },
};
`,
);

writeIfMissing(
  `src/tools/${slug}.spec.ts`,
  `import { describe, expect, it } from 'vitest';

import { definition, Input } from './${slug}.js';

describe('${slug}', () => {
  it('rejects invalid input', () => {
    expect(() => Input.parse({})).toThrow();
  });

  it('happy path', async () => {
    // TODO: real assertion
    const result = await definition.handle({} as never, {} as never);
    expect(result).toBeDefined();
  });
${
  mutates
    ? `
  it('dry-run by default (apply=false)', async () => {
    const result = await definition.handle({ apply: false } as never, {} as never);
    expect((result.data as { dryRun?: boolean }).dryRun).toBe(true);
  });
`
    : ''
}});
`,
);

writeIfMissing(
  `docs/specs/${slug}/spec.md`,
  `---
id: spec.${slug}
title: ${slug}
type: spec
status: draft
---

# Spec: ${slug}

${description}

## User story

[?] As a <persona>, I want <capability>, so that <outcome>.

## Acceptance criteria

[?] Given / When / Then. Be explicit about success metrics.

## Success metrics

[?] tokensEstimate budget, P95 latency, test coverage ≥ 80%.

## Non-goals

[?] Co explicite out of scope.

## Open questions

[?] Lista wszystkiego co wymaga decyzji przed implementacją.
`,
);

writeIfMissing(
  `docs/plans/${TODAY}-new-tool-${slug}.md`,
  `---
id: plan.new-tool.${slug}
title: New tool — ${slug}
type: plan
status: draft
date: ${TODAY}
agents: [analyst, architect, tool-author, test-engineer, security-auditor, doc-writer]
---

# Plan: nowy tool \`${slug}\`

| id   | title                            | agent              | done_when                                       |
| ---- | -------------------------------- | ------------------ | ----------------------------------------------- |
| T001 | Spec — outcome + AC              | analyst            | spec.md istnieje, brak \`[?]\`                  |
| T002 | Design — sandbox, allowlist, apply | architect        | ADR jeśli non-trivial                            |
| T003 | Implement                        | tool-author        | src/tools/${slug}.ts + register w server.ts     |
| T004 | Tests                            | test-engineer      | coverage ≥ 80% na touched files                 |
| T005 | Security audit                   | security-auditor   | verdict: pass (sandbox + apply-flag wired)      |
| T006 | Docs                             | doc-writer         | docs/projects/${slug}/ + CHANGELOG entry        |
`,
);

process.stdout.write(`\n${c.bold('Reminder — manual edit Copilot must perform:')}\n`);
process.stdout.write(
  `  ${c.ok('•')} register w ${c.bold('src/server.ts')}: ${c.dim(`import { definition as ${camelSlug} } from './tools/${slug}.js'; registerTool(${camelSlug});`)}\n`,
);

process.stdout.write(`\n${c.bold('Next steps (LLM agents):')}\n`);
const steps = [
  `Fill ${c.bold(`docs/specs/${slug}/spec.md`)} (analyst — replace [?])`,
  `Implement ${c.bold(`src/tools/${slug}.ts`)} (tool-author — fill TODOs, follow tool-contract.instructions.md)`,
  `Register tool w ${c.bold('src/server.ts')}`,
  `Expand ${c.bold(`src/tools/${slug}.spec.ts`)} do coverage ≥ 80%`,
  `Security audit (sandbox + apply-flag jeśli mutating)`,
  `Append CHANGELOG entry pod ${c.bold('[Unreleased]')} → ${c.bold('Added')}`,
  `Run ${c.bold('npm run verify')} przed commit`,
];
steps.forEach((s, i) => process.stdout.write(`  ${i + 1}. ${s}\n`));

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

function writeIfMissing(rel, content) {
  const abs = nodePath.resolve(ROOT, rel);
  if (existsSync(abs)) {
    process.stdout.write(`  ${c.warn('⚠')} exists: ${rel} (skip)\n`);
    return;
  }
  mkdirSync(nodePath.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  process.stdout.write(`  ${c.ok('✓')} wrote ${rel}\n`);
}
