# GitHub Copilot — mcp-devtools

> Repo Copilot-only. Wszystkie reguły żyją w `.github/instructions/`. Czytaj je na początku każdej sesji.

## Tożsamość

Pracujesz w **mcp-devtools** — MCP server TypeScript (transport stdio) wystawiający 5 narzędzi developer-workflow:

- `analyze_code` — statyczna analiza TS/HTML (Angular metrics)
- `propose_fix` — kontekst bug-fix dla orchestratora
- `run_playwright` — uruchamianie testów Playwright
- `compliance_report` — scoring repo względem standardów (JSON / SARIF)
- `mcp-devtools.get_usage_history` — in-memory session ledger

Każda odpowiedź jest wrapowana w `{ data, _meta }` z `tokensEstimate`, `correlationId`, `durationMs`.

## Klient

- **GitHub Copilot Chat** w **VS Code ≥ 1.121** lub **IntelliJ IDEA ≥ 2026.1.2** (oba mają natywne MCP picker).
- Brak wsparcia dla Claude / Claude Code / ACP / AHP — projekt jest single-track.

## Preferencje językowe

- **Czat: polski.**
- **Kod, git commits, MCP tool descriptions, identyfikatory: angielski.**

## Twarde reguły

- ✅ Czytaj kod zanim ogłosisz, że go znasz.
- ✅ Najmniejsza rozsądna zmiana.
- ✅ Narzędzia są deterministyczne dla swoich inputs.
- ✅ Mutujące tool calls wymagają jawnej flagi `apply: true`.
- ❌ Nigdy nie wymyślaj ścieżek plików, nazw funkcji, wersji pakietów.
- ❌ Nigdy nie bypassuj hooków (`--no-verify`).
- ❌ Nigdy nie umieszczaj sekretów w tracked files.
- ❌ Pisanie do stdout z serwera (MCP transport — log idzie na stderr).
- ❌ Czytanie plików poza `PROJECT_ROOT` (sandbox enforcement).

## Konwencje

Czytaj na początku sesji:

1. [`.github/instructions/core.instructions.md`](instructions/core.instructions.md) — DRY/SOLID/KISS/YAGNI.
2. [`.github/instructions/security.instructions.md`](instructions/security.instructions.md) — sandbox FS, SSRF, proxy, secrets policy.
3. [`.github/instructions/tool-contract.instructions.md`](instructions/tool-contract.instructions.md) — kontrakt każdego toola.

Każde narzędzie:

- jeden plik w `src/tools/<tool>.ts` wystawiający `Input` (Zod) + `Output` (Zod) + `definition: ToolDefinition`,
- contract test w `src/tools/<tool>.spec.ts`,
- inputs walidowane przez Zod na granicy,
- typed errors, JSON-line stderr log.

## Validation gate (przed raportowaniem Done)

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Jeśli którykolwiek krok zawiedzie — **nie** jesteś done.

## Conventional Commits

Format: `type(scope): subject` — wymuszany przez husky `commit-msg` hook + commitlint. Hook `pre-commit` dodatkowo uruchamia `lint-staged` (ESLint + Prettier na touched files).

**Types:** `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

**Scopes:** `analyze-code` `propose-fix` `run-playwright` `compliance` `usage-history` `shared` `sandbox` `log` `session` `server` `cdk` `workflows` `ci` `deps` `docs` `release` `security` `tooling`

Użyj `npm run commit` (commitizen) dla interaktywnego prompta, lub pisz ręcznie. Tytuł PR też musi być zgodny — wymuszane przez `amannn/action-semantic-pull-request` w CI.

## Intranet posture

- Serwer w obecnej formie **nie** wykonuje outbound HTTP.
- Jeśli dodajesz tool z siecią → skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts` (sibling repo). Obsługuje SSRF guard, `HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`.
- Patrz [`docs/how-to/corporate-proxy.md`](../docs/how-to/corporate-proxy.md).
