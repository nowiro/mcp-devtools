---
applyTo: 'src/tools/**/*.ts'
description: Tool I/O contract — Zod input + Zod output + typed errors + JSON-line log
---

# Kontrakt I/O narzędzia

Każdy tool wystawia ten sam envelope, żeby orchestrator mógł łańcuchować je bez per-tool glue.

## 1. Module shape

```ts
// src/tools/<tool>.ts
import { z } from 'zod';
import type { ToolDefinition } from '../shared/types.js';

export const Input = z.object({
  /* … */
});
export const Output = z.object({
  /* … */
});

export const definition: ToolDefinition = {
  name: 'analyze_code',
  description: 'One-line spec — what does it do.',
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, ctx) {
    // ctx exposes: ctx.log (stderr JSON-line logger), ctx.projectRoot (sandbox root).
    const parsed = Input.parse(input);
    return Output.parse({
      /* … */
    });
  },
};
```

## 2. Errors

Rzuć zwykły `Error` z message-em prefix'owanym nazwą toola:

```ts
throw new Error(`analyze_code: path ${resolved} escapes sandbox ${root}`);
```

Serwer mapuje na MCP wire format (`-32603 Internal error`, message 1:1). Stack
trace zostaje w stderr log — klient widzi tylko `message`. Pełna tabela kodów →
[`docs/reference/error-codes.md`](../../docs/reference/error-codes.md).

## 3. Logging

JSON line na stderr per call (auto-wrapped przez server.ts):

```json
{
  "ts": "2026-05-22T12:00:00Z",
  "server": "mcp-devtools",
  "tool": "analyze_code",
  "correlationId": "uuid",
  "durationMs": 340,
  "ok": true
}
```

Żadnej zawartości plików w logach. Żadnego PII. Token-like keys redacted by `log.ts`.

## 4. Determinism

Narzędzia muszą być deterministyczne dla tych samych inputs. Cache by mtime / hash gdy I/O jest drogie (vide `analyze_code`).

## 5. Sandbox

- Każda ścieżka z `input` → `nodePath.resolve()` → prefix-check vs `ctx.projectRoot`.
- Reject path traversal **przed** I/O.
- Symlinks: explicit decision per tool.

## 6. Composability

Tools są PRYMITYWAMI. Orchestrator (Copilot Chat) komponuje je w workflow — nie ten serwer.

Przykład łańcucha bug-fix:

1. `analyze_code({ path: 'src/feature' })` → findings.
2. `propose_fix({ test_path, source_path, failure_text })` → context bundle dla LLM.
3. `run_playwright({ project_root, grep })` → pass/fail.
4. `compliance_report({ project_root, standards_path: '.github/instructions' })` → score.
