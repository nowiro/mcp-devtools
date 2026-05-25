/**
 * Unit tests — run_playwright reporter parsers.
 *
 * We test the pure parsing functions, not the actual spawn — the latter
 * requires a working Playwright install in the target project and is
 * covered by the integration suite (out of scope for unit).
 */
import { describe, expect, it } from 'vitest';

import { parseJsonReporter, parseJunitReporter, parseLineReporter } from './run-playwright.js';

describe('parseJsonReporter', () => {
  it('extracts stats from a playwright JSON reporter blob', () => {
    const blob = JSON.stringify({
      config: {},
      suites: [],
      stats: { expected: 12, unexpected: 1, flaky: 2 },
    });
    const out = parseJsonReporter(blob);
    expect(out).toEqual({ pass: 12, fail: 1, flaky: 2, trace_path: null });
  });

  it('returns zeros when input is not JSON', () => {
    expect(parseJsonReporter('not json at all')).toEqual({ pass: 0, fail: 0, flaky: 0, trace_path: null });
  });

  it('handles JSON embedded in noise (e.g. progress lines)', () => {
    const blob = `Running 1 test using 1 worker\n${JSON.stringify({ stats: { expected: 3 } })}\nFinished.`;
    const out = parseJsonReporter(blob);
    expect(out.pass).toBe(3);
  });
});

describe('parseJunitReporter', () => {
  it('extracts tests / failures attributes', () => {
    const xml = '<?xml version="1.0"?><testsuite tests="10" failures="2" />';
    expect(parseJunitReporter(xml)).toEqual({ pass: 8, fail: 2, flaky: 0 });
  });

  it('returns zeros on malformed input', () => {
    expect(parseJunitReporter('garbage')).toEqual({ pass: 0, fail: 0, flaky: 0 });
  });

  it('clamps pass to 0 when failures > tests', () => {
    const xml = '<testsuite tests="3" failures="5" />';
    const out = parseJunitReporter(xml);
    expect(out.pass).toBe(0);
  });
});

describe('parseLineReporter', () => {
  it('extracts passed / failed / flaky counts from a list-style summary', () => {
    const out = parseLineReporter('  10 passed, 1 failed, 0 flaky (12.3s)', 1);
    expect(out).toEqual({ pass: 10, fail: 1, flaky: 0 });
  });

  it('assumes 1 fail when exit code non-zero and no count parsed', () => {
    const out = parseLineReporter('something broke', 1);
    expect(out.fail).toBe(1);
  });

  it('reports 0 fail when exit code is 0 and no failed line', () => {
    const out = parseLineReporter('5 passed', 0);
    expect(out).toEqual({ pass: 5, fail: 0, flaky: 0 });
  });
});
