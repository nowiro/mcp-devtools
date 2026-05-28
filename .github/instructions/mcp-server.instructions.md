---
applyTo: 'src/**/*.ts'
description: Konwencje serwera MCP — jeden serwer, naming narzędzi, error contract, logowanie
---

# Konwencje serwera MCP — mcp-devtools

Jeden MCP server z 5 narzędziami dev-workflow (stdio, JSON-RPC 2.0). Każdy MCP-zgodny klient (Copilot, Claude Desktop, Cursor, agent SDK) używa bez per-tool config.

## 1. Jeden serwer, wiele narzędzi

- Jeden entry point: `src/server.ts` → `dist/server.js`.
- Każde narzędzie ma **osobny plik** `src/tools/<tool>.ts` z: `Input` (Zod), `Output` (Zod), `definition: ToolDefinition` z `name` / `description` / `handle`.
- `server.ts` importuje i rejestruje wszystkie narzędzia.

## 2. Naming narzędzi

`verb_noun` (snake_case): `analyze_code`, `run_playwright`, `propose_fix`. Ledger używa prefiksu serwera: `mcp-devtools.get_usage_history`. **Nigdy** myślników (`analyze-code` byłby błędny).

## 3. Sandbox FS

Każde narzędzie odczytujące FS przez sandbox:

```ts
import { resolveSandboxPath } from '../shared/sandbox.js';
const safePath = resolveSandboxPath(input.path); // throws SecurityError on traversal
```

`PROJECT_ROOT` = root sandboksa (default `cwd()`). Path traversal (`../`) blokowany identycznie na NTFS + POSIX.

## 4. Schematy Zod

Każde narzędzie deklaruje Zod schema dla inputu **i** outputu. SDK generuje JSON Schema dla `tools/list`. **Brak `any` na granicach.**

```ts
const Input = z.object({
  path: z.string(),
  depth: z.number().int().min(1).max(5).default(3),
});
```

## 5. Kontrakt błędów

Typed errors z `src/shared/errors.ts`:

| Klasa             | Trigger                              | MCP code |
| ----------------- | ------------------------------------ | -------- |
| `SecurityError`   | path traversal, wyjście poza sandbox | -32008   |
| `ValidationError` | semantic input validation            | -32007   |
| Unknown           | fallback (`Internal error`)          | -32603   |

Error `message` po **angielsku** (visible w VS Code / IntelliJ tooltip).

## 6. Logowanie

JSON-line per tool call → **stderr** (stdout = transport MCP):

```json
{
  "ts": "2026-05-25T12:00:00.000Z",
  "tool": "analyze_code",
  "correlationId": "9e1c7c1f-...",
  "durationMs": 42,
  "ok": true
}
```

Bez PII / ścieżek absolutnych usera / pełnych payloadów.

`correlationId` z inbound `req.params._meta?.correlationId` przez `correlationIdFromMeta` w [`correlation.ts`](../../src/shared/correlation.ts). Copilot CLI `preMcpToolCall` hook może wstrzyknąć trace ID z external observability (OpenTelemetry / Datadog / Sentry). Server propaguje end-to-end: log → ledger → outbound `_meta`. Fallback: ULID server-side.

## 7. Response envelope

```ts
{
  data: OutputT,
  _meta: { tokensEstimate: number, correlationId: string, durationMs: number }
}
```

## 8. MCP capabilities trio

Serwer rejestruje **trzy** w `src/server.ts`:

- **Tools** — operacje (`analyze_code`, `propose_fix`, …). Required.
- **Prompts** (`prompts/list` + `prompts/get`) — slash-commands (`/pre-commit-check`, `/full-audit`). `definePrompt({…})` z [`prompt.ts`](../../src/shared/prompt.ts).
- **Resources** (`resources/list` + `resources/read`) — read-only docs cache'owane przez Copilot. Markdown w `templates/resources/<slug>.md` + `defineMarkdownResource({ uri, name, description, file })` z [`resource.ts`](../../src/shared/resource.ts). URI: `mcp-devtools://docs/<slug-kebab>`, MIME `text/markdown`.

```ts
new Server({ name, version }, { capabilities: { tools: {}, prompts: {}, resources: {} } });
```

## 9. Zabronione

- ❌ `console.log(...)` do stdout (uszkadza ramkę MCP).
- ❌ Odczyt poza `PROJECT_ROOT` (sandbox enforcement).
- ❌ Outbound HTTP w narzędziach (serwer offline-capable). Tool z siecią → skopiuj `mcp-alm/src/shared/http-client.ts`.
- ❌ Hardcoded ścieżki absolutne.
- ❌ Brak Zod schema na granicy.

## 10. Dodawanie nowego narzędzia

1. `src/tools/<tool>.ts` z `Input`, `Output`, `definition`.
2. `src/tools/<tool>.spec.ts` — min. 3 testy (happy path, sandbox escape, edge case).
3. Rejestracja w `src/server.ts`.
4. Wpis w `README.md` sekcja Narzędzia.
5. Scope w `commitlint.config.mjs`.
6. `npm run verify`.
