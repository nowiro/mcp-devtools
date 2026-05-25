# How to: add a new tool

> Step-by-step recipe. Estimated time: half-day dla read-only MVP.

Kontrakt który musisz spełnić — patrz [`.github/instructions/tool-contract.instructions.md`](../../.github/instructions/tool-contract.instructions.md).

## 1. Scaffold `src/tools/<name>.ts`

```ts
import { z } from 'zod';
import type { ToolDefinition } from '../shared/types.js';

const Input = z.object({
  /* bound numbers + string lengths */
});
const Output = z.object({
  /* shape — Zod-parsed before return */
});

type InputT = z.infer<typeof Input>;
type OutputT = z.infer<typeof Output>;

export const definition: ToolDefinition<InputT, OutputT> = {
  name: '<verb>_<noun>',
  description: '<one sentence; model czyta to>',
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, ctx) {
    const args = Input.parse(input);
    // sandbox check jeśli path-typed
    return Output.parse({
      /* … */
    });
  },
};
```

## 2. Register w `src/server.ts`

```ts
import { definition as myTool } from './tools/<name>.js';

const tools: readonly ToolDefinition[] = [
  analyzeCode,
  proposeFix,
  runPlaywright,
  complianceReport,
  myTool, // ← add
  getUsageHistory,
];
```

## 3. Sandbox (jeśli tool czyta/pisze pliki)

- Resolve przez `nodePath.resolve(args.path)`.
- Sprawdź prefix vs `ctx.projectRoot + nodePath.sep`.
- Throw przed I/O.

## 4. Network (jeśli tool używa siec)

- Skopiuj wzorzec `httpFetch` z `mcp-alm/src/shared/http-client.ts` (sibling repo).
- SSRF guard + proxy + private CA są wbudowane.
- Opcjonalny allowlist hostów przekaż w `HttpClientOptions.allowedHosts`.

## 5. Test

`src/tools/<name>.spec.ts`:

- Contract test: `Input.parse({...})` round-trip.
- Output test: `Output.parse({...})` round-trip.
- Sandbox test (path-typed): `..`-traversal i absolute path throw `/sandbox/i`.
- Bounded-resource test: malicious large input nie OOM.

## 6. Document

Dodaj wiersz do tabeli `Narzędzia` w [`README.md`](../../README.md) z krótkim opisem Input/Output.

## 7. Verify

```sh
npm run verify   # format:check + lint + typecheck + test + build
```

Conventional commit, PR.

## Don'ts

- ❌ Nie wołaj LLM wewnątrz toola (tools są deterministyczne — patrz [`tool-contract`](../../.github/instructions/tool-contract.instructions.md)).
- ❌ Nie pisz do stdout (stdout = MCP transport). Używaj `ctx.log`.
- ❌ Nie obchodź sandbox FS.
- ❌ Nie mutuj user repo bez `apply: true` w schema.
