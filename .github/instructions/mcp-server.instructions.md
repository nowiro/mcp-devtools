---
applyTo: 'src/**/*.ts'
description: Konwencje serwera MCP — jeden serwer, naming narzędzi, error contract, logowanie
---

# Konwencje serwera MCP — mcp-devtools

mcp-devtools to **jeden serwer MCP** wystawiający 5 narzędzi dev-workflow
przez transport stdio (JSON-RPC 2.0). Każdy MCP-zgodny klient (GitHub
Copilot w VS Code / IntelliJ, Claude Desktop, Cursor, własny agent) może
używać tych narzędzi bez konfiguracji per-tool.

## 1. Jeden serwer, wiele narzędzi

- Jeden entry point: `src/server.ts` → `dist/server.js`.
- Każde narzędzie ma **osobny plik** w `src/tools/<tool>.ts` z:
  - `Input` (Zod schema)
  - `Output` (Zod schema)
  - `definition: ToolDefinition` z `name`, `description`, `handle`
- `server.ts` importuje i rejestruje wszystkie narzędzia.

## 2. Naming narzędzi

Format: `verb_noun` (np. `analyze_code`, `run_playwright`, `propose_fix`).
Narzędzie ledgera używa prefiksu serwera: `mcp-devtools.get_usage_history`.

Nigdy nie używaj nazw z myślnikami: `analyze-code` byłby błędny.

## 3. Sandbox FS

Każde narzędzie odczytujące FS musi przejść przez sandbox:

```ts
import { resolveSandboxPath } from '../shared/sandbox.js';
const safePath = resolveSandboxPath(input.path); // throws SecurityError on traversal
```

`PROJECT_ROOT` to root sandboksa. Domyślnie `cwd()`.
Path traversal (`../`) jest zablokowany identycznie na NTFS i POSIX FS.

## 4. Schematy Zod wszędzie

Każde narzędzie deklaruje Zod schema dla inputu **i** outputu.
SDK generuje JSON Schema dla `tools/list` z każdej definicji Zod.
**Brak `any` na granicach narzędzi.**

```ts
const Input = z.object({
  path: z.string(),
  depth: z.number().int().min(1).max(5).default(3),
});
```

## 5. Kontrakt błędów

Narzędzia rzucają typed errors z `src/shared/errors.ts`:

- `SecurityError` → path traversal, wyjście poza sandbox → `-32008`
- `ValidationError` → semantyczna walidacja inputu → `-32007`
- Inne nieoczekiwane błędy → `-32603` (JSON-RPC `Internal error`)

Każdy error ma `message` po angielsku (widoczny w VS Code / IntelliJ
jako tooltip w tool picker).

## 6. Logowanie

Jeden structured JSON per wywołanie na **stderr** (stdout zarezerwowany
dla transportu MCP):

```json
{
  "ts": "2026-05-25T12:00:00.000Z",
  "tool": "analyze_code",
  "correlationId": "9e1c7c1f-...",
  "durationMs": 42,
  "ok": true
}
```

Bez PII, bez ścieżek absolutnych użytkownika w logu, bez pełnych payloadów.

`correlationId` przychodzi z inbound `req.params._meta?.correlationId` przez
`correlationIdFromMeta` w `src/shared/correlation.ts`. Copilot CLI
`preMcpToolCall` hook (maj 2026) może wstrzyknąć trace ID z external
observability (OpenTelemetry / Datadog / Sentry) przed wysłaniem
`tools/call`. Server propaguje to ID end-to-end: log → ledger →
outbound `_meta` w response envelope. Fallback gdy `_meta` brak: ULID
generated server-side.

## 7. Response envelope

Każda odpowiedź jest wrapowana w:

```ts
{
  data: OutputT,
  _meta: {
    tokensEstimate: number,
    correlationId: string,
    durationMs: number,
  }
}
```

## 8. Zabronione

- ❌ `console.log(...)` do stdout — uszkadza ramkę MCP.
- ❌ Odczyt plików poza `PROJECT_ROOT` (sandbox enforcement).
- ❌ Outbound HTTP w narzędziach (serwer jest w pełni offline-capable).
  Jeśli dodajesz tool z siecią → skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts`.
- ❌ Hardcoded ścieżki bezwzględne.
- ❌ Brak Zod schema na granicy narzędzia.

## 9. MCP Prompts + Resources (capabilities obok tools)

Serwer wystawia trzy capabilities — wszystkie zarejestrowane w `src/server.ts`:

- **Tools** (`tools/list` + `tools/call`) — operacje (analyze_code, propose_fix, …). Required.
- **Prompts** (`prompts/list` + `prompts/get`) — preconfigured slash-commands (`/pre-commit-check`, `/full-audit`). Zdefiniuj przez `definePrompt({…})` z `src/shared/prompt.ts`, dorzuć do tablicy `prompts` w `src/server.ts`.
- **Resources** (`resources/list` + `resources/read`) — read-only docs cache'owane przez Copilot (catalog findings, rules spec, context guide). Najprościej: markdown w `templates/resources/<slug>.md` + `defineMarkdownResource({ uri, name, description, file })` z `src/shared/resource.ts`. Helper resolwuje path z `import.meta.url` (cross-platform). Konwencja URI: `mcp-devtools://docs/<slug-kebab>`, MIME `text/markdown`.

Capabilities deklarowane w konstruktorze `Server`:

```ts
new Server({ name, version }, { capabilities: { tools: {}, prompts: {}, resources: {} } });
```

## 10. Dodawanie nowego narzędzia

Checklist:

1. `src/tools/<tool>.ts` z `Input`, `Output`, `definition`.
2. `src/tools/<tool>.spec.ts` z min. 3 testami: happy path, sandbox escape, edge case.
3. Rejestracja w `src/server.ts`.
4. Wpis w `README.md` (sekcja Narzędzia).
5. Scope w `commitlint.config.mjs`.
6. `npm run verify` musi przejść.
