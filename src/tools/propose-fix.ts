/**
 * propose_fix — assemble bug-fix context for the orchestrator's LLM to reason over.
 *
 * This is a PRIMITIVE — the actual model call lives in the orchestrator (Copilot
 * Chat). This tool's job is to read the relevant files, slice ±25 lines around
 * the fault locations indicated in `failure_text`, and return a tight context bundle.
 *
 * v1.1: multi-file via `paths: string[]` in addition to legacy `test_path` /
 * `source_path`. Real file reads with fault-location slicing.
 */
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import { assertWithinSandbox } from '../shared/sandbox.js';
import type { ToolDefinition } from '../shared/types.js';

export const Input = z
  .object({
    test_path: z.string().min(1).optional(),
    source_path: z.string().min(1).optional(),
    paths: z.array(z.string().min(1)).default([]),
    failure_text: z.string().min(1),
    rules_paths: z.array(z.string()).default([]),
    window: z.number().int().min(5).max(200).default(25),
  })
  .refine((d) => !!d.test_path || !!d.source_path || d.paths.length > 0, {
    message: 'At least one of test_path, source_path, or paths is required.',
  });

export const Output = z.object({
  context: z.object({
    test_excerpt: z.string().optional(),
    source_excerpt: z.string().optional(),
    files: z.array(z.object({ path: z.string(), excerpt: z.string() })),
    failure: z.string(),
    rules: z.array(z.object({ path: z.string(), excerpt: z.string() })),
  }),
  hint: z.string(),
});

type InputT = z.infer<typeof Input>;
type OutputT = z.infer<typeof Output>;

/** Pull `<path>:<line>` references out of a stack trace, deduped, in order. */
export function extractFaultLines(failure_text: string, path: string): number[] {
  // Match the path literally then `:<digits>` (with an optional second `:<col>`).
  // Use posix and win32 separators interchangeably.
  const normPath = path.replaceAll(/[/\\]/g, String.raw`[/\\]`).replaceAll('.', String.raw`\.`);
  const re = new RegExp(String.raw`${normPath}:(\d+)`, 'g');
  const seen = new Set<number>();
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(failure_text)) !== null) {
    // m[1] is guaranteed by the regex group (RegExpExecArray indexes as string).
    const ln = Number.parseInt(m[1], 10);
    if (ln > 0 && !seen.has(ln)) {
      seen.add(ln);
      out.push(ln);
    }
  }
  return out;
}

export async function sliceAround(path: string, focusLines: number[], window = 25): Promise<string> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    return `// could not read ${path}: ${(error as Error).message}`;
  }
  const lines = text.split('\n');
  if (focusLines.length === 0) {
    return lines
      .slice(0, window * 2)
      .map((l, i) => `${i + 1}: ${l}`)
      .join('\n');
  }
  const parts: string[] = [];
  for (const focus of focusLines) {
    const start = Math.max(0, focus - 1 - window);
    const end = Math.min(lines.length, focus - 1 + window);
    parts.push(`-- around L${focus} --`);
    for (let i = start; i < end; i++) {
      parts.push(`${i + 1}: ${lines[i] ?? ''}`);
    }
  }
  return parts.join('\n');
}

export const definition: ToolDefinition<InputT, OutputT> = {
  name: 'propose_fix',
  description:
    'Assemble bug-fix context by slicing ±N lines around fault locations (O(files × window), bounded by paths.length). Reads test, source, rules; parses fault locs from failure_text. Deterministic — does not call LLM, returns context blob for the caller to reason over.',
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, ctx) {
    const { test_path, source_path, paths, failure_text, rules_paths, window } = Input.parse(input);

    const allPaths = [...(test_path ? [test_path] : []), ...(source_path ? [source_path] : []), ...paths];
    // Sandbox every path before any I/O — refuse traversal up-front.
    for (const p of [...allPaths, ...rules_paths]) {
      assertWithinSandbox(p, ctx.projectRoot, 'propose_fix');
    }

    const files = await Promise.all(
      allPaths.map(async (p) => ({
        path: p,
        excerpt: await sliceAround(p, extractFaultLines(failure_text, p), window),
      })),
    );

    const test_excerpt = test_path ? files.find((f) => f.path === test_path)?.excerpt : undefined;
    const source_excerpt = source_path ? files.find((f) => f.path === source_path)?.excerpt : undefined;

    const rules = await Promise.all(
      rules_paths.map(async (p) => {
        const raw = await readFile(p, 'utf8').catch(() => '');
        return { path: p, excerpt: raw.slice(0, 2000) };
      }),
    );

    return Output.parse({
      context: {
        test_excerpt,
        source_excerpt,
        files,
        failure: failure_text,
        rules,
      },
      hint: 'Start by re-reading the failing assertion; consider the smallest possible diff in the source file.',
    });
  },
};
