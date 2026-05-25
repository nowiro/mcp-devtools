/**
 * compliance_report — score a target repo against a standards directory.
 *
 * v1.1: real implementation — walks `standards_path` for `*.md` rule files,
 * parses YAML frontmatter for automated checks (`must_exist`, `must_not_exist`,
 * `pattern`), evaluates each against `project_root`. Emits findings + overall
 * score. Optional SARIF 2.1.0 output for CI surfaces (GitHub Code Scanning).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import nodePath from 'node:path';
import { z } from 'zod';

import { assertWithinSandbox } from '../shared/sandbox.js';
import type { ToolDefinition } from '../shared/types.js';

export const Input = z.object({
  project_root: z.string().min(1),
  standards_path: z.string().min(1),
  format: z.enum(['json', 'sarif']).default('json'),
});

export const Output = z.object({
  score: z.number().min(0).max(100),
  findings: z.array(
    z.object({
      rule: z.string(),
      status: z.enum(['pass', 'warn', 'fail', 'unknown']),
      evidence: z.string(),
    }),
  ),
  sarif: z.unknown().optional(),
});

type InputT = z.infer<typeof Input>;
type OutputT = z.infer<typeof Output>;

interface RuleChecks {
  pattern?: string;
  must_exist?: string;
  must_not_exist?: string;
}

// Anchored, character-class based regex to avoid super-linear backtracking
// (sonarjs/slow-regex): each key value scanned with a tight non-newline class.
const FRONTMATTER_RE = /^---\r?\n([\S\s]*?)\r?\n---/;
// Bounded value length (1..512 chars) prevents super-linear backtracking on
// pathological lines while comfortably accommodating realistic rule values.
const RULE_KEY_RE = /^(pattern|must_exist|must_not_exist):[ \t]{1,8}([^\r\n]{1,512})$/;

export function parseFrontmatter(text: string): RuleChecks {
  const fm = FRONTMATTER_RE.exec(text);
  if (!fm) return {};
  const body = fm[1];
  if (!body) return {};
  const out: RuleChecks = {};
  for (const raw of body.split(/\r?\n/)) {
    const match = RULE_KEY_RE.exec(raw.trim());
    if (!match?.[1] || !match[2]) continue;
    const key = match[1] as keyof RuleChecks;
    out[key] = match[2].replaceAll(/^["']|["']$/g, '');
  }
  return out;
}

async function listRules(standards_path: string): Promise<string[]> {
  try {
    const entries = await readdir(standards_path, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        paths.push(nodePath.resolve(standards_path, entry.name));
      }
    }
    return paths.toSorted((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function* walkAll(root: string): AsyncGenerator<string> {
  async function* walk(directory: string): AsyncGenerator<string> {
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const { name } = entry;
      if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'coverage') continue;
      const full = nodePath.resolve(directory, name);
      if (entry.isDirectory()) yield* walk(full);
      else if (entry.isFile()) yield full;
    }
  }
  yield* walk(root);
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function checkMustExist(
  projectRoot: string,
  relativePath: string,
): Promise<{ status: 'pass' | 'fail'; evidence: string }> {
  let target: string;
  try {
    target = assertWithinSandbox(relativePath, projectRoot, 'compliance_report');
  } catch {
    return { status: 'fail', evidence: `must_exist:${relativePath} → escapes sandbox` };
  }
  const present = await exists(target);
  return { status: present ? 'pass' : 'fail', evidence: `must_exist:${relativePath} → ${present}` };
}

async function checkMustNotExist(
  projectRoot: string,
  relativePath: string,
): Promise<{ status: 'pass' | 'fail'; evidence: string }> {
  let target: string;
  try {
    target = assertWithinSandbox(relativePath, projectRoot, 'compliance_report');
  } catch {
    return { status: 'pass', evidence: `must_not_exist:${relativePath} → escapes sandbox (not checked)` };
  }
  const present = await exists(target);
  return { status: present ? 'fail' : 'pass', evidence: `must_not_exist:${relativePath} → exists=${present}` };
}

/** Cap on YAML-supplied `pattern:` length — defends against catastrophic-backtracking regexes. */
const MAX_PATTERN_LENGTH = 200;

async function checkPattern(
  projectRoot: string,
  pattern: string,
): Promise<{ status: 'pass' | 'fail' | 'unknown'; evidence: string }> {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { status: 'unknown', evidence: `pattern exceeds ${MAX_PATTERN_LENGTH}-char limit` };
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    return { status: 'unknown', evidence: 'pattern parse error' };
  }
  let hit = false;
  let count = 0;
  for await (const file of walkAll(projectRoot)) {
    if (count > 500) break;
    if (!/\.(ts|html|md|json|yml|yaml)$/.test(file)) continue;
    count += 1;
    const text = await readFile(file, 'utf8').catch(() => '');
    if (re.test(text)) {
      hit = true;
      break;
    }
  }
  return { status: hit ? 'fail' : 'pass', evidence: `pattern:${pattern} → matches=${hit}` };
}

export async function checkRule(
  projectRoot: string,
  checks: RuleChecks,
): Promise<{ status: 'pass' | 'warn' | 'fail' | 'unknown'; evidence: string }> {
  if (checks.must_exist) return checkMustExist(projectRoot, checks.must_exist);
  if (checks.must_not_exist) return checkMustNotExist(projectRoot, checks.must_not_exist);
  if (checks.pattern) return checkPattern(projectRoot, checks.pattern);
  return { status: 'unknown', evidence: 'no automated check defined in rule frontmatter' };
}

function sarifLevelFor(status: OutputT['findings'][number]['status']): 'error' | 'warning' | 'note' {
  if (status === 'fail') return 'error';
  if (status === 'warn') return 'warning';
  return 'note';
}

export function toSarif(findings: OutputT['findings'], score: number): unknown {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'mcp-devtools/compliance_report',
            version: '0.3.0',
            informationUri: 'https://github.com/wojteknowicki/mcp-devtools',
            rules: findings.map((finding) => ({
              id: nodePath.basename(finding.rule, '.md'),
              shortDescription: { text: nodePath.basename(finding.rule) },
              fullDescription: { text: finding.evidence },
            })),
          },
        },
        results: findings
          .filter((finding) => finding.status !== 'pass')
          .map((finding) => ({
            ruleId: nodePath.basename(finding.rule, '.md'),
            level: sarifLevelFor(finding.status),
            message: { text: finding.evidence },
            locations: [{ physicalLocation: { artifactLocation: { uri: finding.rule } } }],
          })),
        properties: { score },
      },
    ],
  };
}

export const definition: ToolDefinition<InputT, OutputT> = {
  name: 'compliance_report',
  description:
    'Score a project against rules (file presence + regex grep + YAML frontmatter). Optional SARIF 2.1.0 output for GitHub Code Scanning.',
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, ctx) {
    const { project_root, standards_path, format } = Input.parse(input);
    const resolvedProjectRoot = assertWithinSandbox(project_root, ctx.projectRoot, 'compliance_report');
    const resolvedStandardsPath = assertWithinSandbox(standards_path, ctx.projectRoot, 'compliance_report');
    const rules = await listRules(resolvedStandardsPath);
    const findings: OutputT['findings'] = [];
    for (const rule of rules) {
      const text = await readFile(rule, 'utf8').catch(() => '');
      const checks = parseFrontmatter(text);
      const result = await checkRule(resolvedProjectRoot, checks);
      findings.push({ rule, ...result });
    }
    const passes = findings.filter((finding) => finding.status === 'pass').length;
    const score = findings.length === 0 ? 0 : Math.round((passes / findings.length) * 100);
    return Output.parse({
      score,
      findings,
      sarif: format === 'sarif' ? toSarif(findings, score) : undefined,
    });
  },
};
