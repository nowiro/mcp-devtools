# GitHub Copilot — mcp-devtools

> Czytaj ten plik na początku każdej sesji. Pełne reguły żyją w `.github/instructions/`.

## Tożsamość

Pracujesz w **mcp-devtools** — MCP server TypeScript (transport stdio) wystawiający 5 narzędzi developer-workflow:

| Narzędzie                          | Opis                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `analyze_code`                     | Statyczna analiza TS/TSX/JS/JSX/HTML/Vue. Per-framework metrics (Angular/React/Vue, auto-detect). mtime-cached. |
| `propose_fix`                      | Zbiera kontekst bug-fix (failing test + source + rules) dla LLM caller'a.                              |
| `run_playwright`                   | Uruchamia `npx playwright test`. Cross-platform: `npx.cmd` na Windows, `npx` na POSIX.                 |
| `compliance_report`                | Scoring repo vs `*.md` rules z YAML frontmatter (`must_exist` / `must_not_exist` / `pattern`).         |
| `mcp-devtools.get_usage_history`   | In-memory session ledger (FIFO 1000 rekordów).                                                         |

Każda odpowiedź jest wrapowana w `{ data, _meta: { tokensEstimate, correlationId, durationMs } }`.

## Klient

- **GitHub Copilot Chat** w **VS Code ≥ 1.121** lub **IntelliJ IDEA ≥ 2026.1.2** (oba mają natywne MCP picker).
- Cross-platform: Windows (PowerShell / Git Bash), macOS (zsh / bash), Linux (bash).
- Konfiguracja IDE: `.vscode/mcp.json` (VS Code) i `.idea/mcp-servers.example.xml` (IntelliJ).

## Preferencje językowe

- **Czat: polski.**
- **Kod, git commits, MCP tool descriptions, identyfikatory: angielski.**
- Szczegóły → [`.github/instructions/language.instructions.md`](instructions/language.instructions.md).

## Twarde reguły

- ✅ Czytaj kod zanim ogłosisz, że go znasz.
- ✅ Najmniejsza rozsądna zmiana.
- ✅ Narzędzia są deterministyczne dla swoich inputs.
- ✅ Każdy input jest walidowany przez Zod na granicy narzędzia.
- ✅ Każde narzędzie czytające FS przechodzi przez `resolveSandboxPath`.
- ❌ Nigdy nie wymyślaj ścieżek plików, nazw funkcji, wersji pakietów.
- ❌ Nigdy nie bypassuj hooków (`--no-verify`).
- ❌ Nigdy nie umieszczaj sekretów w tracked files.
- ❌ Pisanie do stdout z handlera narzędzia (stdout zarezerwowany dla transportu MCP — log idzie na stderr).
- ❌ Czytanie plików poza `PROJECT_ROOT` (sandbox enforcement).
- ❌ Outbound HTTP z narzędzi (serwer jest offline-capable; jeśli nowe narzędzie potrzebuje sieci — skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts`).

## Architektura

```
src/
  server.ts              # entry point — rejestruje narzędzia + startuje serwer MCP
  tools/
    analyze-code.ts      # + .spec.ts
    propose-fix.ts       # + .spec.ts
    run-playwright.ts    # + .spec.ts
    compliance-report.ts # + .spec.ts
  shared/
    sandbox.ts           # resolveSandboxPath — path traversal guard
    log.ts               # structured JSON logger → stderr, token redaction
    session-tracker.ts   # in-memory FIFO ledger
tools/scripts/
  bootstrap.mjs          # npm run bootstrap — post-clone setup
  doctor.mjs             # npm run doctor — cross-platform diagnostics
  dev-client.mjs         # manual MCP client for testing without IDE
  validate-ai-config.mjs # npm run ai:validate
```

## Validation gate (Definition of Done)

```sh
npm run verify
# = format:check + lint + typecheck + test + build + ai:validate
```

Jeśli którykolwiek krok zawiedzie — **nie** jesteś done.

## Conventional Commits

Format: `type(scope): subject` — wymuszany przez husky `commit-msg` hook + commitlint.
Hook `pre-commit` uruchamia `lint-staged` (ESLint + Prettier na touched files).

**Types:** `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

**Scopes:** `analyze-code` `propose-fix` `run-playwright` `compliance` `usage-history` `shared` `sandbox` `log` `session` `server` `workflows` `ci` `deps` `docs` `release` `security` `tooling`

Użyj `npm run commit` (commitizen) lub pisz ręcznie.

## Dodawanie nowego narzędzia

1. `src/tools/<tool>.ts` z `Input` (Zod), `Output` (Zod), `definition`.
2. `src/tools/<tool>.spec.ts` — min. 3 testy (happy path, sandbox escape, edge case).
3. Rejestracja w `src/server.ts`.
4. Wpis w `README.md` (sekcja Narzędzia).
5. Nowy scope w `commitlint.config.mjs`.
6. `npm run verify`.

## Czytaj na początku sesji

1. [`.github/instructions/core.instructions.md`](instructions/core.instructions.md) — cross-cutting reguły.
2. [`.github/instructions/security.instructions.md`](instructions/security.instructions.md) — sandbox, secrets policy.
3. [`.github/instructions/tool-contract.instructions.md`](instructions/tool-contract.instructions.md) — kontrakt każdego toola.
4. [`.github/instructions/mcp-server.instructions.md`](instructions/mcp-server.instructions.md) — konwencje serwera.
5. [`.github/instructions/principles.instructions.md`](instructions/principles.instructions.md) — DRY/SOLID/KISS/YAGNI.
6. [`.github/instructions/production-readiness.instructions.md`](instructions/production-readiness.instructions.md) — checklist przed shipnięciem.

## Intranet posture

- Serwer **nie** wykonuje outbound HTTP.
- Jeśli dodajesz tool z siecią → skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts` (sibling repo).
  Obsługuje SSRF guard, `HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`.
- Patrz [`docs/reference/configuration.md`](../docs/reference/configuration.md).
