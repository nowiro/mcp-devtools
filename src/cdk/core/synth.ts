/**
 * Recipe primitive — every Construct emits zero or more `SynthStep`-s, which
 * the App aggregates and the renderer turns into a `.prompt.md` file.
 *
 * Three step kinds:
 *
 *   - `mcp_call`   — Copilot is to invoke a specific MCP tool with these args.
 *                     Result optionally bound to `bind` for downstream refs.
 *   - `llm_reason` — Copilot reasons over inputs from earlier steps; output
 *                     must match `outputSchema` (a JSON snippet describing
 *                     the expected shape).
 *   - `user_input` — Halt and ask the human a question; bind the answer.
 *
 * `bind` names are kebab/snake-case identifiers referenced later as
 * `{{vars.<bind>}}` in `args` / `prompt` strings.
 */

export interface McpCallStep {
  readonly type: 'mcp_call';
  readonly n: number;
  readonly title: string;
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly bind?: string;
  readonly description?: string;
  /** Optional override on the default per-call timeout (ms). */
  readonly timeoutMs?: number;
}

export interface LlmReasonStep {
  readonly type: 'llm_reason';
  readonly n: number;
  readonly title: string;
  readonly prompt: string;
  readonly inputFrom?: string;
  readonly outputSchema?: string;
  readonly bind?: string;
  readonly description?: string;
}

export interface UserInputStep {
  readonly type: 'user_input';
  readonly n: number;
  readonly title: string;
  readonly question: string;
  readonly bind: string;
  readonly default?: string;
  readonly choices?: readonly string[];
  readonly description?: string;
}

export type SynthStep = McpCallStep | LlmReasonStep | UserInputStep;

/** Output of `Workflow.compile()` — everything the renderer needs. */
export interface CompiledWorkflow {
  readonly id: string;
  /** Slash-command name, e.g. `sdd-scaffold-app`. */
  readonly trigger: string;
  readonly description: string;
  readonly steps: readonly SynthStep[];
}
