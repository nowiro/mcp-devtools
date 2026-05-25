/**
 * Unit tests — propose_fix multi-file context assembly.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { definition, extractFaultLines, sliceAround } from './propose-fix.js';

describe('extractFaultLines', () => {
  it('picks line numbers from a posix-style stack trace', () => {
    const trace = 'at Object.<anonymous> (/home/u/proj/src/foo.ts:42:5)\n  at next (/home/u/proj/src/foo.ts:99:3)';
    expect(extractFaultLines(trace, '/home/u/proj/src/foo.ts')).toEqual([42, 99]);
  });

  it('picks line numbers from a windows-style stack trace', () => {
    const trace = 'at C:\\proj\\src\\foo.ts:42:5\n  at C:\\proj\\src\\foo.ts:99';
    expect(extractFaultLines(trace, String.raw`C:\proj\src\foo.ts`)).toEqual([42, 99]);
  });

  it('deduplicates repeated line numbers', () => {
    const trace = 'foo.ts:10\nfoo.ts:10\nfoo.ts:20';
    expect(extractFaultLines(trace, 'foo.ts')).toEqual([10, 20]);
  });

  it('returns empty for unrelated paths', () => {
    expect(extractFaultLines('error in bar.ts:1', 'foo.ts')).toEqual([]);
  });
});

describe('sliceAround', () => {
  let file: string;

  beforeEach(async () => {
    const directory = await mkdtemp(nodePath.join(tmpdir(), 'propose-fix-'));
    file = nodePath.join(directory, 'sample.ts');
    const lines: string[] = [];
    for (let i = 1; i <= 100; i++) lines.push(`line ${i}`);
    await writeFile(file, lines.join('\n'));
  });

  afterEach(async () => {
    await rm(file, { force: true }).catch(() => undefined);
  });

  it('returns a window of ±N lines around each focus line', async () => {
    const out = await sliceAround(file, [50], 5);
    expect(out).toContain('45: line 45');
    expect(out).toContain('50: line 50');
    expect(out).toContain('54: line 54');
    expect(out).not.toContain('line 40');
    expect(out).not.toContain('line 60');
  });

  it('returns first 2*window lines when no focus is given', async () => {
    const out = await sliceAround(file, [], 5);
    expect(out).toContain('1: line 1');
    expect(out).toContain('10: line 10');
    expect(out).not.toContain('11: line 11');
  });

  it('returns a graceful message when file does not exist', async () => {
    const out = await sliceAround('/no/such/file.ts', [1], 5);
    expect(out).toContain('could not read');
  });
});

describe('propose_fix handler', () => {
  it('refuses when no path is given', async () => {
    await expect(
      definition.handle(
        { failure_text: 'whatever', paths: [], rules_paths: [], window: 25 },
        { log: () => undefined, projectRoot: '/' },
      ),
    ).rejects.toThrow();
  });

  it('handles multi-file via `paths`', async () => {
    const directory = await mkdtemp(nodePath.join(tmpdir(), 'propose-fix-multi-'));
    const a = nodePath.join(directory, 'a.ts');
    const b = nodePath.join(directory, 'b.ts');
    await writeFile(a, ['line1', 'line2', 'line3'].join('\n'));
    await writeFile(b, ['xxx', 'yyy', 'zzz'].join('\n'));
    try {
      const out = await definition.handle(
        { paths: [a, b], failure_text: 'no fault refs', rules_paths: [], window: 25 },
        { log: () => undefined, projectRoot: directory },
      );
      expect(out.context.files).toHaveLength(2);
      const got: string[] = out.context.files.map((f) => f.path);
      const want: string[] = [a, b];
      expect(got.toSorted((x, y) => x.localeCompare(y))).toEqual(want.toSorted((x, y) => x.localeCompare(y)));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('throws when any path escapes the sandbox', async () => {
    const directory = await mkdtemp(nodePath.join(tmpdir(), 'propose-fix-sandbox-'));
    try {
      await expect(
        definition.handle(
          {
            paths: ['../../../etc/passwd'],
            failure_text: 'irrelevant',
            rules_paths: [],
            window: 25,
          },
          { log: () => undefined, projectRoot: directory },
        ),
      ).rejects.toThrow(/escapes sandbox/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('throws when a rules_path escapes the sandbox', async () => {
    const directory = await mkdtemp(nodePath.join(tmpdir(), 'propose-fix-sandbox-'));
    const a = nodePath.join(directory, 'a.ts');
    await writeFile(a, 'export const ok = true;');
    try {
      await expect(
        definition.handle(
          {
            paths: [a],
            failure_text: 'irrelevant',
            rules_paths: ['../../../etc/passwd'],
            window: 25,
          },
          { log: () => undefined, projectRoot: directory },
        ),
      ).rejects.toThrow(/escapes sandbox/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
