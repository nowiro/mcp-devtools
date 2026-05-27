/**
 * run_playwright — execute Playwright tests in the target project, capture results.
 *
 * Spawns `npx playwright test` (Windows: `npx.cmd`) with:
 *   - `shard` (e.g. "1/3") for parallel CI sharding
 *   - `reporter` selection (json | junit | list | line)
 *   - structured stats parsing from JSON / JUnit reporter output
 *   - sandbox: `project_root` must resolve under `ctx.projectRoot`
 */
import { spawn } from 'node:child_process';
import { z } from 'zod';

import { assertWithinSandbox } from '../shared/sandbox.js';
import type { ToolDefinition } from '../shared/types.js';

const Reporter = z.enum(['list', 'json', 'junit', 'line']);

export const Input = z.object({
  project_root: z.string().min(1),
  grep: z.string().optional(),
  headed: z.boolean().default(false),
  timeout_ms: z.number().int().min(5000).max(600_000).default(120_000),
  shard: z
    .string()
    .regex(/^\d+\/\d+$/, 'shard must be "i/N" (e.g. "1/3")')
    .optional(),
  reporter: Reporter.default('json'),
});

export const Output = z.object({
  pass: z.number().int().min(0),
  fail: z.number().int().min(0),
  flaky: z.number().int().min(0),
  trace_path: z.string().nullable(),
  raw_stdout: z.string(),
  junit_xml: z.string().optional(),
  shard: z.string().optional(),
  reporter: Reporter,
  exit_code: z.number().int(),
});

type InputT = z.infer<typeof Input>;
type OutputT = z.infer<typeof Output>;

interface SpawnResult {
  readonly stdout: string;
  readonly code: number;
}

// Bounded-digit regexes (`{1,8}`) — guard sonarjs/slow-regex from worrying about
// pathological inputs. 8 digits handles >99M tests; well past any real suite.
const PASS_RE = /(\d{1,8}) passed/;
const FAIL_RE = /(\d{1,8}) failed/;
const FLAKY_RE = /(\d{1,8}) flaky/;
const JUNIT_TESTS_RE = /tests="(\d{1,8})"/;
const JUNIT_FAILURES_RE = /failures="(\d{1,8})"/;

async function spawnPlaywright(args: string[], cwd: string, timeout_ms: number): Promise<SpawnResult> {
  return new Promise((resolve) => {
    // `npx` resolves the locally-installed Playwright. On Windows the `.cmd`
    // shim is picked up via PATHEXT — no shell:true required.
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(command, ['playwright', 'test', ...args], { cwd });
    let stdout = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout_ms);
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ stdout, code: code ?? 1 });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: `${stdout}\n${err.message}`, code: 1 });
    });
  });
}

function findBalancedJson(stdout: string): string | null {
  const start = stdout.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return stdout.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJsonReporter(stdout: string): {
  pass: number;
  fail: number;
  flaky: number;
  trace_path: string | null;
} {
  const blob = findBalancedJson(stdout);
  if (!blob) return { pass: 0, fail: 0, flaky: 0, trace_path: null };
  try {
    const obj = JSON.parse(blob) as { stats?: { expected?: number; unexpected?: number; flaky?: number } };
    return {
      pass: obj.stats?.expected ?? 0,
      fail: obj.stats?.unexpected ?? 0,
      flaky: obj.stats?.flaky ?? 0,
      trace_path: null,
    };
  } catch {
    return { pass: 0, fail: 0, flaky: 0, trace_path: null };
  }
}

export function parseJunitReporter(stdout: string): { pass: number; fail: number; flaky: number } {
  const testsM = JUNIT_TESTS_RE.exec(stdout);
  const failM = JUNIT_FAILURES_RE.exec(stdout);
  if (!testsM || !failM) return { pass: 0, fail: 0, flaky: 0 };
  const total = Number.parseInt(testsM[1], 10);
  const fail = Number.parseInt(failM[1], 10);
  return { pass: Math.max(0, total - fail), fail, flaky: 0 };
}

export function parseLineReporter(stdout: string, exit_code: number): { pass: number; fail: number; flaky: number } {
  const passM = PASS_RE.exec(stdout);
  const failM = FAIL_RE.exec(stdout);
  const flakyM = FLAKY_RE.exec(stdout);
  const pass = passM ? Number.parseInt(passM[1], 10) : 0;
  const failParsed = failM ? Number.parseInt(failM[1], 10) : 0;
  const flaky = flakyM ? Number.parseInt(flakyM[1], 10) : 0;
  // If the regex finds nothing but the process failed, assume at least one fail
  const fail = failParsed === 0 && exit_code !== 0 ? 1 : failParsed;
  return { pass, fail, flaky };
}

interface ParsedStats {
  pass: number;
  fail: number;
  flaky: number;
  trace_path: string | null;
  junit?: string;
}

function parseReporterOutput(stdout: string, reporter: z.infer<typeof Reporter>, exit_code: number): ParsedStats {
  if (reporter === 'json') return parseJsonReporter(stdout);
  if (reporter === 'junit') {
    const parsed = parseJunitReporter(stdout);
    return { ...parsed, trace_path: null, junit: stdout };
  }
  const parsed = parseLineReporter(stdout, exit_code);
  return { ...parsed, trace_path: null };
}

export const definition: ToolDefinition<InputT, OutputT> = {
  name: 'run_playwright',
  description:
    'Run Playwright tests via npx subprocess (slow, default timeout 120s; expensive — spawns full browser). Supports --shard i/N for CI parallelism and reporter selection (json | junit | list | line). Returns parsed pass/fail/flaky counts plus capped stdout.',
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, ctx) {
    const { project_root, grep, headed, timeout_ms, shard, reporter } = Input.parse(input);

    const resolvedRoot = assertWithinSandbox(project_root, ctx.projectRoot, 'run_playwright');

    const args: string[] = [`--reporter=${reporter}`];
    if (grep) args.push('--grep', grep);
    if (headed) args.push('--headed');
    if (shard) args.push(`--shard=${shard}`);

    const { stdout, code } = await spawnPlaywright(args, resolvedRoot, timeout_ms);
    const stats = parseReporterOutput(stdout, reporter, code);

    return Output.parse({
      pass: stats.pass,
      fail: stats.fail,
      flaky: stats.flaky,
      trace_path: stats.trace_path,
      raw_stdout: stdout.slice(0, 8000),
      junit_xml: stats.junit,
      shard,
      reporter,
      exit_code: code,
    });
  },
};
