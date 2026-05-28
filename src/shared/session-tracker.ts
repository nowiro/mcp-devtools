/**
 * In-memory tool-call ledger — every `tools/call` lands here so the operator
 * (or the agent itself) can ask `mcp-devtools.get_usage_history` and see what
 * the session cost in tokens.
 *
 * Design notes:
 *   - Process-local singleton — one tracker per server instance. Reset on restart.
 *   - Hard cap (`MAX_RECORDS`) so a long-running server cannot leak. Oldest
 *     records drop first (FIFO). The summary still reflects whatever's in memory.
 *   - No persistence — YAGNI. If an agent needs cross-session history, it can
 *     call `get_usage_history` and store the JSON itself.
 *   - No timers / async — purely synchronous; safe to call from a hot loop.
 */

/** Hard cap on retained records — bounds memory at ~200 KB worst case. */
const MAX_RECORDS = 1000;

export interface ToolCallRecord {
  /** ISO 8601 UTC. */
  readonly timestamp: string;
  /** Server identifier — e.g. `mcp-devtools`. */
  readonly server: string;
  /** Tool name — e.g. `analyze_code`. */
  readonly tool: string;
  readonly correlationId: string;
  /** `JSON.stringify(input).length`. */
  readonly inputChars: number;
  /** `JSON.stringify(output).length`. */
  readonly outputChars: number;
  /** Mirrors `_meta.tokensEstimate` on the response. */
  readonly tokensEstimate: number;
  readonly durationMs: number;
  readonly ok: boolean;
  /** Set on failure — captures the message only, never the stack. */
  readonly error?: string;
}

export interface AggregatedBucket {
  readonly calls: number;
  readonly tokens: number;
}

export interface SessionSummary {
  /** Newest-first list of records. */
  readonly calls: readonly ToolCallRecord[];
  readonly totalCalls: number;
  readonly totalOutputChars: number;
  readonly totalTokens: number;
  readonly byTool: Readonly<Record<string, AggregatedBucket>>;
  readonly byServer: Readonly<Record<string, AggregatedBucket>>;
  /** ISO 8601 of when this tracker was instantiated (process start). */
  readonly sessionStartedAt: string;
  /** True once the FIFO cap evicted at least one record. */
  readonly truncated: boolean;
}

export class SessionTracker {
  private records: ToolCallRecord[] = [];
  private readonly startedAt = new Date().toISOString();
  private droppedCount = 0;

  /** Record one tool call. Caller supplies everything except the timestamp. */
  record(entry: Omit<ToolCallRecord, 'timestamp'>): void {
    this.records.push({ timestamp: new Date().toISOString(), ...entry });
    if (this.records.length > MAX_RECORDS) {
      const dropped = this.records.length - MAX_RECORDS;
      this.records = this.records.slice(dropped);
      this.droppedCount += dropped;
    }
  }

  /** Build a summary snapshot — newest-first, with by-tool / by-server roll-ups. */
  getSummary(): SessionSummary {
    const newestFirst = [...this.records].reverse();
    const byTool: Record<string, AggregatedBucket> = {};
    const byServer: Record<string, AggregatedBucket> = {};
    let totalOutputChars = 0;
    let totalTokens = 0;

    for (const r of this.records) {
      totalOutputChars += r.outputChars;
      totalTokens += r.tokensEstimate;
      bump(byTool, r.tool, r.tokensEstimate);
      bump(byServer, r.server, r.tokensEstimate);
    }

    return {
      calls: newestFirst,
      totalCalls: this.records.length,
      totalOutputChars,
      totalTokens,
      byTool,
      byServer,
      sessionStartedAt: this.startedAt,
      truncated: this.droppedCount > 0,
    };
  }
}

function bump(into: Record<string, AggregatedBucket>, key: string, tokens: number): void {
  const previous = into[key];
  if (previous !== undefined) {
    into[key] = { calls: previous.calls + 1, tokens: previous.tokens + tokens };
    return;
  }
  into[key] = { calls: 1, tokens };
}

/** Process-wide singleton. */
export const sessionTracker = new SessionTracker();
