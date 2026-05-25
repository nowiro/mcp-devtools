/**
 * Unit tests — sandbox FS guard.
 */
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertWithinSandbox } from './sandbox.js';

describe('assertWithinSandbox', () => {
  const root = nodePath.resolve('/tmp/sandbox-root');

  it('returns the resolved absolute path when candidate is inside root', () => {
    const out = assertWithinSandbox('src/feature', root, 'tool');
    expect(out).toBe(nodePath.resolve(root, 'src/feature'));
  });

  it('accepts the sandbox root itself', () => {
    const out = assertWithinSandbox('.', root, 'tool');
    expect(out).toBe(root);
  });

  it('rejects `..`-style traversal', () => {
    expect(() => assertWithinSandbox('../../etc/passwd', root, 'tool')).toThrow(/escapes sandbox/);
  });

  it('rejects an absolute path outside the sandbox', () => {
    const outside = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd';
    expect(() => assertWithinSandbox(outside, root, 'tool')).toThrow(/escapes sandbox/);
  });

  it('includes the tool name in the error so logs are traceable', () => {
    expect(() => assertWithinSandbox('../escape', root, 'my_tool')).toThrow(/my_tool/);
  });

  it('resolves relative paths against the sandbox root, not cwd', () => {
    // Even if cwd is /home/x, `src/a` must resolve under root.
    const out = assertWithinSandbox('src/a', root, 'tool');
    expect(out.startsWith(root)).toBe(true);
  });
});
