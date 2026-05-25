#!/usr/bin/env node
/**
 * mcp-devtools — single MCP server with composable dev-workflow tools.
 *
 * Copilot-only. Every tool response is wrapped in `{ data, _meta }` so Copilot
 * agents can budget the next call from `_meta.tokensEstimate` without
 * round-tripping a tokeniser.
 *
 * Tools registered:
 *   - analyze_code
 *   - propose_fix
 *   - run_playwright
 *   - compliance_report
 *   - mcp-devtools.get_usage_history (in-memory session ledger)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import nodePath from 'node:path';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { correlationIdFromMeta } from './shared/correlation.js';
import { compactJson } from './shared/llm-optimize.js';
import { log } from './shared/log.js';
import { buildMeta, wrapResponse } from './shared/response-meta.js';
import { sessionTracker } from './shared/session-tracker.js';
import type { ToolContext, ToolDefinition } from './shared/types.js';
import { getRepoVersion } from './shared/version.js';
import { definition as analyzeCode } from './tools/analyze-code.js';
import { definition as complianceReport } from './tools/compliance-report.js';
import { definition as proposeFix } from './tools/propose-fix.js';
import { definition as runPlaywright } from './tools/run-playwright.js';

const SERVER_NAME = 'mcp-devtools';
const SERVER_VERSION = getRepoVersion();

const GetUsageHistoryInput = z.object({});
const Bucket = z.object({ calls: z.number(), tokens: z.number() });
const ToolCallRecordSchema = z.object({
  timestamp: z.string(),
  server: z.string(),
  tool: z.string(),
  correlationId: z.string(),
  inputChars: z.number(),
  outputChars: z.number(),
  tokensEstimate: z.number(),
  durationMs: z.number(),
  ok: z.boolean(),
  error: z.string().optional(),
});
const GetUsageHistoryOutput = z.object({
  calls: z.array(ToolCallRecordSchema),
  totalCalls: z.number(),
  totalOutputChars: z.number(),
  totalTokens: z.number(),
  byTool: z.record(z.string(), Bucket),
  byServer: z.record(z.string(), Bucket),
  sessionStartedAt: z.string(),
  truncated: z.boolean(),
});

const getUsageHistory: ToolDefinition = {
  name: 'mcp-devtools.get_usage_history',
  description: 'Return the in-memory session ledger: totals + byTool/byServer roll-ups. Cap 1 000 records, FIFO.',
  inputSchema: GetUsageHistoryInput,
  outputSchema: GetUsageHistoryOutput,
  async handle() {
    return sessionTracker.getSummary();
  },
};

const tools: readonly ToolDefinition[] = [analyzeCode, proposeFix, runPlaywright, complianceReport, getUsageHistory];

function buildContext(correlationId: string, toolName: string): ToolContext {
  const projectRoot = nodePath.resolve(process.env['PROJECT_ROOT'] ?? process.cwd());
  return {
    log: (entry: Record<string, unknown>) => {
      log({ server: SERVER_NAME, tool: toolName, correlationId, ...entry });
    },
    projectRoot,
  };
}

function stringifyLength(value: unknown): number {
  if (value === undefined || value === null) return 0;
  return typeof value === 'string' ? value.length : JSON.stringify(value).length;
}

async function main(): Promise<void> {
  const byName = new Map(tools.map((t) => [t.name, t]));

  const server = new Server({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema as never, { target: 'jsonSchema7' }),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);

    const correlationId = correlationIdFromMeta(req.params._meta);
    const ctx = buildContext(correlationId, tool.name);
    const start = Date.now();
    const input = req.params.arguments;

    try {
      const raw = await tool.handle(input, ctx);
      // `get_usage_history` returns a ledger snapshot with maps that are empty
      // during cold-start sessions. `compactJson` would strip those, breaking
      // the contract (consumers expect `byTool` / `byServer` to always exist).
      const data = tool.name === 'mcp-devtools.get_usage_history' ? raw : compactJson(raw);
      const durationMs = Date.now() - start;
      const meta = buildMeta(data, {
        correlationId,
        server: SERVER_NAME,
        tool: tool.name,
        durationMs,
      });
      sessionTracker.record({
        server: SERVER_NAME,
        tool: tool.name,
        correlationId,
        inputChars: stringifyLength(input),
        outputChars: stringifyLength(data),
        tokensEstimate: meta.tokensEstimate,
        durationMs,
        ok: true,
      });
      log({ server: SERVER_NAME, tool: tool.name, correlationId, durationMs, ok: true });
      const envelope = wrapResponse(data, meta);
      return { content: [{ type: 'text', text: JSON.stringify(envelope) }] };
    } catch (error: unknown) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      sessionTracker.record({
        server: SERVER_NAME,
        tool: tool.name,
        correlationId,
        inputChars: stringifyLength(input),
        outputChars: 0,
        tokensEstimate: 0,
        durationMs,
        ok: false,
        error: message,
      });
      log({ server: SERVER_NAME, tool: tool.name, correlationId, durationMs, ok: false, error: message });
      throw error;
    }
  });

  await server.connect(new StdioServerTransport());
  log({ server: SERVER_NAME, ok: true, msg: `started, ${tools.length} tools` });
}

main().catch((error: unknown) => {
  log({ server: SERVER_NAME, ok: false, error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
