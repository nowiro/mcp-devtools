import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { log } from './log.js';

interface CapturedLine {
  ts?: string;
  server?: string;
  tool?: string;
  durationMs?: number;
  ok?: boolean;
  error?: string;
  msg?: string;
  [key: string]: unknown;
}

function captureStderr(): { lines: CapturedLine[]; restore: () => void } {
  const lines: CapturedLine[] = [];
  const original = process.stderr.write.bind(process.stderr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stderr.write = ((chunk: any) => {
    const text = typeof chunk === 'string' ? chunk : String(chunk);
    for (const line of text.split('\n').filter(Boolean)) {
      lines.push(JSON.parse(line) as CapturedLine);
    }
    return true;
  }) as typeof process.stderr.write;
  return {
    lines,
    restore() {
      process.stderr.write = original;
    },
  };
}

describe('log', () => {
  let capture: ReturnType<typeof captureStderr>;

  beforeEach(() => {
    capture = captureStderr();
  });
  afterEach(() => {
    capture.restore();
  });

  it('emits JSON line with ts and provided fields', () => {
    log({ server: 'mcp-devtools', tool: 'read_docs', ok: true, durationMs: 12 });
    const line = capture.lines[0];
    if (!line) throw new Error('expected log line 0');
    expect(line.server).toBe('mcp-devtools');
    expect(line.tool).toBe('read_docs');
    expect(line.ok).toBe(true);
    expect(line.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never writes to stdout — only stderr', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log({ msg: 'check' });
    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it('redacts token-like keys at any depth (defense-in-depth)', () => {
    log({
      msg: 'sample',
      details: {
        token: 'super-secret-pat',
        password: 'hunter2',
        headers: { authorization: 'Bearer xyz', Authorization: 'Bearer abc' },
        repo: 'owner/repo',
      },
    });
    const line = capture.lines[0];
    if (!line) throw new Error('expected log line 0');
    const details = line['details'] as Record<string, unknown>;
    expect(details['token']).toBe('[Redacted]');
    expect(details['password']).toBe('[Redacted]');
    const headers = details['headers'] as Record<string, unknown>;
    expect(headers['authorization']).toBe('[Redacted]');
    expect(headers['Authorization']).toBe('[Redacted]');
    expect(details['repo']).toBe('owner/repo'); // not redacted — verifies we don't over-redact
  });
});
