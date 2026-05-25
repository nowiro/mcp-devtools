import { beforeEach, describe, expect, it } from 'vitest';

import { SessionTracker } from './session-tracker.js';

function makeEntry(
  over: Partial<Parameters<SessionTracker['record']>[0]> = {},
): Parameters<SessionTracker['record']>[0] {
  return {
    server: 'mcp-devtools',
    tool: 'analyze_code',
    correlationId: 'cid-1',
    inputChars: 10,
    outputChars: 100,
    tokensEstimate: 25,
    durationMs: 12,
    ok: true,
    ...over,
  };
}

describe('SessionTracker', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    tracker = new SessionTracker();
  });

  it('starts empty', () => {
    const s = tracker.getSummary();
    expect(s.totalCalls).toBe(0);
    expect(s.totalTokens).toBe(0);
    expect(s.calls).toEqual([]);
    expect(s.byTool).toEqual({});
    expect(s.byServer).toEqual({});
    expect(s.truncated).toBe(false);
  });

  it('records a single call and aggregates it', () => {
    tracker.record(makeEntry());
    const s = tracker.getSummary();
    expect(s.totalCalls).toBe(1);
    expect(s.totalTokens).toBe(25);
    expect(s.totalOutputChars).toBe(100);
    expect(s.byTool['analyze_code']).toEqual({ calls: 1, tokens: 25 });
    expect(s.byServer['mcp-devtools']).toEqual({ calls: 1, tokens: 25 });
  });

  it('rolls up across tools and servers', () => {
    tracker.record(makeEntry({ tool: 'analyze_code', tokensEstimate: 10 }));
    tracker.record(makeEntry({ tool: 'propose_fix', tokensEstimate: 30 }));
    tracker.record(makeEntry({ tool: 'compliance_report', server: 'mcp-other', tokensEstimate: 100 }));
    const s = tracker.getSummary();
    expect(s.totalCalls).toBe(3);
    expect(s.totalTokens).toBe(140);
    expect(s.byTool).toEqual({
      analyze_code: { calls: 1, tokens: 10 },
      propose_fix: { calls: 1, tokens: 30 },
      compliance_report: { calls: 1, tokens: 100 },
    });
    expect(s.byServer).toEqual({
      'mcp-devtools': { calls: 2, tokens: 40 },
      'mcp-other': { calls: 1, tokens: 100 },
    });
  });

  it('returns records newest-first', () => {
    tracker.record(makeEntry({ correlationId: 'first' }));
    tracker.record(makeEntry({ correlationId: 'second' }));
    tracker.record(makeEntry({ correlationId: 'third' }));
    const s = tracker.getSummary();
    expect(s.calls.map((c) => c.correlationId)).toEqual(['third', 'second', 'first']);
  });

  it('flags truncated once the cap (1 000) is exceeded', () => {
    for (let i = 0; i < 1100; i += 1) {
      tracker.record(makeEntry({ correlationId: `cid-${i}` }));
    }
    const s = tracker.getSummary();
    expect(s.totalCalls).toBe(1000);
    expect(s.truncated).toBe(true);
    expect(s.calls[0]?.correlationId).toBe('cid-1099');
  });

  it('records failures without tokens but preserves the error message', () => {
    tracker.record(makeEntry({ ok: false, tokensEstimate: 0, outputChars: 0, error: 'upstream 500' }));
    const s = tracker.getSummary();
    expect(s.totalCalls).toBe(1);
    expect(s.totalTokens).toBe(0);
    expect(s.calls[0]?.ok).toBe(false);
    expect(s.calls[0]?.error).toBe('upstream 500');
  });
});
