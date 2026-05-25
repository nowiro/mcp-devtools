/**
 * Unit tests — compliance_report frontmatter / checks / SARIF.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkRule, definition, parseFrontmatter, toSarif } from './compliance-report.js';

describe('parseFrontmatter', () => {
  it('extracts must_exist / must_not_exist / pattern', () => {
    const text = `---\nmust_exist: package.json\npattern: console\\.log\n---\n# rule\n`;
    const out = parseFrontmatter(text);
    expect(out.must_exist).toBe('package.json');
    expect(out.pattern).toBe(String.raw`console\.log`);
  });

  it('handles quoted values', () => {
    const text = `---\nmust_exist: "src/index.ts"\n---\n`;
    expect(parseFrontmatter(text).must_exist).toBe('src/index.ts');
  });

  it('returns {} when no frontmatter present', () => {
    expect(parseFrontmatter('# just a rule, no front matter')).toEqual({});
  });
});

describe('checkRule', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(nodePath.join(tmpdir(), 'compliance-'));
    await mkdir(nodePath.join(projectRoot, 'src'), { recursive: true });
    await writeFile(nodePath.join(projectRoot, 'package.json'), '{}');
    await writeFile(nodePath.join(projectRoot, 'src', 'index.ts'), 'export const ok = true;');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('passes must_exist when the file is present', async () => {
    const out = await checkRule(projectRoot, { must_exist: 'package.json' });
    expect(out.status).toBe('pass');
  });

  it('fails must_exist when the file is absent', async () => {
    const out = await checkRule(projectRoot, { must_exist: 'no-such-file.json' });
    expect(out.status).toBe('fail');
  });

  it('passes must_not_exist when the file is absent', async () => {
    const out = await checkRule(projectRoot, { must_not_exist: '.env.production' });
    expect(out.status).toBe('pass');
  });

  it('fails pattern check when the pattern is found in any file', async () => {
    await writeFile(nodePath.join(projectRoot, 'src', 'bad.ts'), 'console.log("hi")');
    const out = await checkRule(projectRoot, { pattern: String.raw`console\.log` });
    expect(out.status).toBe('fail');
  });

  it('returns unknown when no automated check is declared', async () => {
    const out = await checkRule(projectRoot, {});
    expect(out.status).toBe('unknown');
  });
});

describe('toSarif', () => {
  it('emits valid SARIF 2.1.0 envelope', () => {
    const sarif = toSarif(
      [
        {
          rule: '.github/instructions/security.instructions.md',
          status: 'fail',
          evidence: 'must_exist:SECURITY.md → false',
        },
      ],
      50,
    ) as { version: string; runs: { results: unknown[] }[] };
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]?.results).toHaveLength(1);
  });

  it('excludes pass findings from SARIF results', () => {
    const sarif = toSarif(
      [
        { rule: 'a.md', status: 'pass', evidence: 'ok' },
        { rule: 'b.md', status: 'fail', evidence: 'bad' },
      ],
      50,
    ) as { runs: { results: unknown[] }[] };
    expect(sarif.runs[0]?.results).toHaveLength(1);
  });
});

describe('compliance_report handler', () => {
  it('scores 100 when all rules pass', async () => {
    const root = await mkdtemp(nodePath.join(tmpdir(), 'compliance-int-'));
    const std = nodePath.join(root, 'standards');
    try {
      await mkdir(std, { recursive: true });
      await writeFile(nodePath.join(root, 'package.json'), '{}');
      await writeFile(nodePath.join(std, 'has-package-json.md'), `---\nmust_exist: package.json\n---\n# rule\n`);
      const out = await definition.handle(
        { project_root: root, standards_path: std, format: 'json' },
        { log: () => undefined, projectRoot: root },
      );
      expect(out.score).toBe(100);
      expect(out.findings[0]?.status).toBe('pass');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns SARIF blob when format=sarif', async () => {
    const root = await mkdtemp(nodePath.join(tmpdir(), 'compliance-int-'));
    const std = nodePath.join(root, 'standards');
    try {
      await mkdir(std, { recursive: true });
      await writeFile(nodePath.join(std, 'r.md'), `---\nmust_exist: missing.txt\n---\n# rule\n`);
      const out = await definition.handle(
        { project_root: root, standards_path: std, format: 'sarif' },
        { log: () => undefined, projectRoot: root },
      );
      expect(out.sarif).toBeDefined();
      expect((out.sarif as { version: string }).version).toBe('2.1.0');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('throws when project_root escapes the sandbox', async () => {
    const root = await mkdtemp(nodePath.join(tmpdir(), 'compliance-sandbox-'));
    try {
      await expect(
        definition.handle(
          { project_root: '../../../etc', standards_path: root, format: 'json' },
          { log: () => undefined, projectRoot: root },
        ),
      ).rejects.toThrow(/escapes sandbox/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('throws when standards_path escapes the sandbox', async () => {
    const root = await mkdtemp(nodePath.join(tmpdir(), 'compliance-sandbox-'));
    try {
      await expect(
        definition.handle(
          { project_root: root, standards_path: '../../../etc', format: 'json' },
          { log: () => undefined, projectRoot: root },
        ),
      ).rejects.toThrow(/escapes sandbox/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
