/**
 * Bind validator — every `{{vars.<name>}}` reference in step args / prompts /
 * questions must point at a `bind` defined by an *earlier* step. This catches
 * typos and out-of-order references at compile time, before the .prompt.md is
 * shown to Copilot.
 *
 * Two checks:
 *   1. Forward-reference: step N can only use binds from steps 1..N-1.
 *   2. Unknown bind: every `{{vars.X}}` must match some defined bind name.
 *
 * `{{args.<name>}}` references are NOT validated here — they point at
 * slash-command CLI args, which are validated at runtime by Copilot.
 */
import type { CompiledWorkflow, SynthStep } from './synth.js';

const VARS_REF_RE = /\{\{\s*vars\.([\w-]+)/g;

interface ValidationIssue {
  step: number;
  message: string;
}

export function validateBinds(compiled: CompiledWorkflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const definedSoFar = new Set<string>();

  for (const step of compiled.steps) {
    for (const ref of extractRefs(step)) {
      if (!definedSoFar.has(ref)) {
        issues.push({
          step: step.n,
          message: `Step ${step.n} (${step.title}) references {{vars.${ref}}} which is not defined by an earlier step.`,
        });
      }
    }
    if ('bind' in step && step.bind) {
      definedSoFar.add(step.bind);
    }
  }

  return issues;
}

function extractRefs(step: SynthStep): string[] {
  const blobs: string[] = [];
  if (step.type === 'mcp_call') {
    blobs.push(JSON.stringify(step.args));
  } else if (step.type === 'llm_reason') {
    blobs.push(step.prompt);
    if (step.inputFrom) blobs.push(step.inputFrom);
    if (step.outputSchema) blobs.push(step.outputSchema);
  } else {
    blobs.push(step.question);
    if (step.default) blobs.push(step.default);
  }

  const refs: string[] = [];
  for (const blob of blobs) {
    for (const m of blob.matchAll(VARS_REF_RE)) {
      if (m[1]) refs.push(m[1]);
    }
  }
  return refs;
}

/** Throw aggregated message if any issues found. */
export function assertBindsValid(compiled: CompiledWorkflow): void {
  const issues = validateBinds(compiled);
  if (issues.length === 0) return;
  const detail = issues.map((i) => `  - ${i.message}`).join('\n');
  throw new Error(`Bind validation failed for workflow ${compiled.id}:\n${detail}`);
}
