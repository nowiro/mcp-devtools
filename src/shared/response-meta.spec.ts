import { describe, expect, it } from 'vitest';

import { buildMeta, estimatePayloadTokens, wrapResponse } from './response-meta.js';

describe('estimatePayloadTokens', () => {
  it('returns 0 for nullish payloads', () => {
    expect(estimatePayloadTokens(undefined)).toBe(0);
    expect(estimatePayloadTokens(null)).toBe(0);
  });

  it('uses chars/4 for strings', () => {
    expect(estimatePayloadTokens('1234')).toBe(1);
    expect(estimatePayloadTokens('12345678')).toBe(2);
  });

  it('JSON-stringifies objects before measuring', () => {
    // {"a":1} -> 7 chars -> ceil(7/4) = 2
    expect(estimatePayloadTokens({ a: 1 })).toBe(2);
  });

  it('handles numbers and booleans via JSON length', () => {
    expect(estimatePayloadTokens(12_345)).toBe(2); // "12345" -> 5 chars -> 2
    expect(estimatePayloadTokens(true)).toBe(1); // "true" -> 4 chars -> 1
  });
});

describe('buildMeta', () => {
  it('attaches every required field', () => {
    const meta = buildMeta(
      { hello: 'world' },
      { correlationId: 'cid-1', server: 'mcp-devtools', tool: 'analyze_code' },
    );
    expect(meta.correlationId).toBe('cid-1');
    expect(meta.server).toBe('mcp-devtools');
    expect(meta.tool).toBe('analyze_code');
    expect(typeof meta.tokensEstimate).toBe('number');
    expect(meta.tokensEstimate).toBeGreaterThan(0);
    expect(meta.durationMs).toBeUndefined();
  });

  it('includes durationMs only when supplied', () => {
    const withMs = buildMeta('x', { correlationId: 'cid', server: 's', tool: 't', durationMs: 42 });
    expect(withMs.durationMs).toBe(42);
  });

  it('emits keys in the documented order', () => {
    const meta = buildMeta('x', { correlationId: 'cid', server: 's', tool: 't', durationMs: 1 });
    expect(Object.keys(meta)).toEqual(['tokensEstimate', 'correlationId', 'server', 'tool', 'durationMs']);
  });
});

describe('wrapResponse', () => {
  it('round-trips data + _meta', () => {
    const meta = buildMeta({ a: 1 }, { correlationId: 'c', server: 's', tool: 't' });
    const wrapped = wrapResponse({ a: 1 }, meta);
    expect(wrapped.data).toEqual({ a: 1 });
    expect(wrapped._meta).toBe(meta);
  });
});
