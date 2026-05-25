/**
 * Per-call response envelope: `{ data, _meta }`.
 *
 * Why: GitHub Copilot bills usage in tokens, and every byte a tool returns
 * lands in the agent's context. `_meta.tokensEstimate` gives the agent (and
 * our session tracker) a cheap, dependency-free way to budget before the
 * next call — no tiktoken, no SDK round-trip.
 *
 * Estimator: `Math.ceil(JSON.stringify(value).length / 4)` — the rule-of-thumb
 * 4-chars-per-token ratio is within ±15% for mixed JSON/English on
 * GPT-4-family tokenisers (Copilot's models). Good enough for a budget tripwire.
 *
 * The shape is deliberately fixed (`data` first, `_meta` second) so the cached
 * prefix on the Copilot side stays predictable across calls.
 */

/** Meta payload attached to every tool result. */
export interface ResponseMeta {
  /** Cheap approximation: `Math.ceil(chars / 4)`. */
  readonly tokensEstimate: number;
  /** Same id that travelled on the inbound `_meta` (or freshly minted). */
  readonly correlationId: string;
  /** Server name (e.g. `mcp-devtools`). */
  readonly server: string;
  /** Tool name (e.g. `analyze_code`). */
  readonly tool: string;
  /** Wall time spent in `handle()` — populated by `server.ts`. */
  readonly durationMs?: number;
}

/** Public envelope every tool returns. */
export interface ToolResponse<T = unknown> {
  readonly data: T;
  readonly _meta: ResponseMeta;
}

/**
 * Cheap, allocation-light token estimate. Returns 0 for nullish payloads
 * so empty responses don't pollute the histogram with `1`-token rows.
 */
export function estimatePayloadTokens(payload: unknown): number {
  if (payload === undefined || payload === null) return 0;
  const chars = typeof payload === 'string' ? payload.length : JSON.stringify(payload).length;
  return Math.ceil(chars / 4);
}

interface BuildMetaInput {
  readonly correlationId: string;
  readonly server: string;
  readonly tool: string;
  readonly durationMs?: number;
}

/**
 * Build the `_meta` for a given payload. The key order here is the order the
 * caller will see in the wire JSON — keep it stable.
 */
export function buildMeta(payload: unknown, input: BuildMetaInput): ResponseMeta {
  return {
    tokensEstimate: estimatePayloadTokens(payload),
    correlationId: input.correlationId,
    server: input.server,
    tool: input.tool,
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
  };
}

/** Wrap a payload in the canonical envelope. */
export function wrapResponse<T>(data: T, meta: ResponseMeta): ToolResponse<T> {
  return { data, _meta: meta };
}
