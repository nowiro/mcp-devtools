/**
 * `compactJson` — strip noise from a payload before serialising for the LLM.
 *
 * Applied by `server.ts` to every tool response. Drops null / undefined /
 * empty arrays / empty objects / empty strings recursively — typically buys
 * 10–25% wire savings on JSON-heavy outputs.
 *
 * Boolean `false` is preserved (it carries signal). All other choices are
 * hard-coded; no per-call options.
 */

/**
 * Recursively strip null / undefined / empty arrays / empty objects /
 * empty strings from a value.
 * @example
 *   compactJson({ a: 1, b: null, c: [], d: { e: undefined } })
 *   // → { a: 1 }
 */
export function compactJson(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const cleaned = value.map(compactJson).filter((item) => item !== undefined);
    return cleaned.length === 0 ? undefined : cleaned;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    let hasOwn = false;
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const next = compactJson(raw);
      if (next === undefined) continue;
      out[key] = next;
      hasOwn = true;
    }
    return hasOwn ? out : undefined;
  }
  if (typeof value === 'string') return value === '' ? undefined : value;
  return value;
}
