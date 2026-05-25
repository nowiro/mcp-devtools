/**
 * Shared types for the devtools server. The contract every tool must implement.
 */
import type { z } from 'zod';

export interface ToolContext {
  /** Structured stderr logger. */
  readonly log: (entry: Record<string, unknown>) => void;
  /** Sandbox boundary — every tool must keep file access under this root. */
  readonly projectRoot: string;
}

export interface ToolDefinition<I = unknown, O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<I>;
  readonly outputSchema: z.ZodType<O>;
  handle(input: I, ctx: ToolContext): Promise<O>;
}
