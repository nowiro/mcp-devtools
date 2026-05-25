/**
 * Unit tests — compactJson.
 */
import { describe, expect, it } from 'vitest';

import { compactJson } from './llm-optimize.js';

describe('compactJson', () => {
  it('drops null / undefined / empty arrays / empty objects', () => {
    expect(
      compactJson({
        a: 1,
        b: null,
        c: undefined,
        d: [],
        e: {},
        f: { g: null, h: 2 },
      }),
    ).toEqual({ a: 1, f: { h: 2 } });
  });

  it('drops empty strings', () => {
    expect(compactJson({ a: 'hello', b: '' })).toEqual({ a: 'hello' });
  });

  it('keeps boolean false (signal-bearing)', () => {
    expect(compactJson({ flag: false, val: 0 })).toEqual({ flag: false, val: 0 });
  });

  it('recurses into nested arrays', () => {
    expect(compactJson({ items: [1, null, 2, [], { a: undefined }] })).toEqual({ items: [1, 2] });
  });

  it('returns primitives unchanged', () => {
    expect(compactJson(42)).toBe(42);
    expect(compactJson('hello')).toBe('hello');
    expect(compactJson(true)).toBe(true);
  });

  it('handles deeply nested null pruning', () => {
    expect(
      compactJson({
        outer: { mid: { inner: null, kept: 1 } },
      }),
    ).toEqual({ outer: { mid: { kept: 1 } } });
  });

  it('returns undefined when everything is pruned', () => {
    expect(compactJson({ a: { b: null, c: undefined } })).toBeUndefined();
  });
});
