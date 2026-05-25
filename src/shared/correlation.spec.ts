import { describe, expect, it } from 'vitest';

import { correlationIdFromMeta } from './correlation.js';

describe('correlation', () => {
  it('correlationIdFromMeta returns a fresh v4 uuid when meta is null', () => {
    const id = correlationIdFromMeta(null);
    expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  });

  it('correlationIdFromMeta returns a unique uuid on each call when meta is empty', () => {
    expect(correlationIdFromMeta(undefined)).not.toBe(correlationIdFromMeta(undefined));
  });

  it('correlationIdFromMeta accepts a clean inbound correlationId', () => {
    expect(correlationIdFromMeta({ correlationId: 'trace-abc.123' })).toBe('trace-abc.123');
  });

  it('correlationIdFromMeta accepts the alternate requestId key', () => {
    expect(correlationIdFromMeta({ requestId: 'req-xyz' })).toBe('req-xyz');
  });

  it('correlationIdFromMeta rejects an id with unsafe characters', () => {
    const result = correlationIdFromMeta({ correlationId: 'bad id; DROP TABLE' });
    expect(result).not.toBe('bad id; DROP TABLE');
    expect(result).toMatch(/^[\da-f-]{36}$/);
  });

  it('correlationIdFromMeta rejects an overlong id', () => {
    const long = 'a'.repeat(200);
    const result = correlationIdFromMeta({ correlationId: long });
    expect(result).not.toBe(long);
  });

  it('correlationIdFromMeta rejects a non-string id', () => {
    const result = correlationIdFromMeta({ correlationId: 42 });
    expect(result).toMatch(/^[\da-f-]{36}$/);
  });
});
