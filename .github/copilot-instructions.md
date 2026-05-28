# GitHub Copilot — mcp-devtools

> Przeczytaj **najpierw** w każdej sesji. Top-level digest; szczegóły w `.github/instructions/*.md` (auto-loaded per `applyTo` glob) oraz `AGENTS.md`.

## Tożsamość

**mcp-devtools** — TypeScript / Node 22, jeden serwer MCP (transport stdio) z 5 narzędziami dev-workflow: `analyze_code`, `propose_fix`, `run_playwright`, `compliance_report`, `mcp-devtools.get_usage_history`. Cross-platform: Windows (PowerShell / Git Bash), macOS, Linux.

Każda odpowiedź wrapowana w `{ data, _meta: { tokensEstimate, correlationId, durationMs } }`.

Klient: **GitHub Copilot** w VS Code ≥ 1.121, IntelliJ ≥ 2026.1.2, Eclipse (od 2026-05-21). Inne MCP hosty (Claude Desktop, Cursor) też działają.

## Język

- **Czat: polski.** Odpowiadaj PL dopóki user nie przełączy.
- **Kod, git, MCP tool `description` strings, identyfikatory: angielski.** PL tokenizuje ~1.4× drożej.

## Twarde reguły (must)

- ✅ Czytaj kod przed deklarowaniem że znasz; najmniejsza rozsądna zmiana.
- ✅ Narzędzia deterministyczne dla swoich inputs.
- ✅ Każdy input walidowany Zod na granicy narzędzia (brak `any`).
- ✅ Każde narzędzie czytające FS przechodzi przez `assertWithinSandbox(path, ctx.projectRoot, '<tool>')`.
- ✅ DoD przed "done": `npm run verify` (format + lint + typecheck + test + build + ai:validate).
- ❌ Nie zgaduj ścieżek / nazw funkcji / wersji.
- ❌ Nie bypass git hooków (`--no-verify`).
- ❌ Sekrety w tracked file — never.
- ❌ Nie `console.log` do **stdout** w `src/server*.ts` / `src/tools/*.ts` (uszkadza MCP frame). Loguj JSON-line do stderr przez `src/shared/log.ts`.
- ❌ Odczyt plików poza `PROJECT_ROOT` (sandbox enforcement).
- ❌ Outbound HTTP z narzędzi (serwer offline-capable). Tool z siecią → skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts`.

## MCP capabilities trio

Serwer wpina **trzy** capability arrays do `new Server({ capabilities: { tools: {}, prompts: {}, resources: {} } })`:

- **`tools`** — operacje (`analyze_code`, `propose_fix`, …). Format `verb_noun` (snake_case), ledger tool używa prefixu `mcp-devtools.get_usage_history`.
- **`prompts`** — slash-commands w Copilot Chat (`/pre-commit-check`, `/full-audit`, …). Definicja przez `definePrompt({…})` w `src/shared/prompt.ts`.
- **`resources`** — read-only docs cache'owane przez hosta. URI: `mcp-devtools://docs/<slug-kebab>`. Helper `defineMarkdownResource({…})` z `src/shared/resource.ts` resolves path z `import.meta.url`.

Pełen kontrakt + naming → [`mcp-server.instructions.md`](instructions/mcp-server.instructions.md). Sandbox + tool contract → [`tool-contract.instructions.md`](instructions/tool-contract.instructions.md). Token shaping → [`llm-optimization.instructions.md`](instructions/llm-optimization.instructions.md).

## Hierarchia reguł

1. **Ten plik** — repo-wide.
2. **`.github/instructions/*.instructions.md`** — auto per `applyTo` glob (load: `core`, `principles`, `security`, `tool-contract`, `mcp-server`, `llm-optimization`, `production-readiness`, `language`).
3. **`.github/prompts/*.prompt.md`** — wywoływane `/<name>` (`/pre-commit-check`, `/flaky-investigation`, `/full-audit`, `/security-review`, `/mcp-devtools.usage-summary`).
4. **`.github/agents/*.agent.md`** — picker w VS Code (`orchestrator`, `architect`, `app-scaffolder`, `integrator`, `tool-author`, `security-auditor`).
5. **User prompt** — najwyższy.

VS Code settings są w [`.vscode/settings.json`](../.vscode/settings.json). IntelliJ 2026.1.2+ ładuje ten plik automatycznie z pluginu Copilot.

## Conventional Commits

`type(scope): subject` — wymuszane przez `husky commit-msg` + commitlint. Hook `pre-commit` uruchamia `lint-staged`.

- **Types:** `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- **Scopes:** `analyze-code` `propose-fix` `run-playwright` `compliance` `usage-history` `shared` `sandbox` `log` `session` `server` `cdk` `workflows` `ci` `deps` `docs` `release` `security` `tooling`

`npm run commit` (commitizen) lub ręcznie.

## Intranet posture

Serwer **nie wykonuje outbound HTTP**. Jeśli dodajesz tool z siecią — skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts` (SSRF guard + `HTTPS_PROXY` + `NO_PROXY` + `NODE_EXTRA_CA_CERTS`). Patrz [`docs/reference/configuration.md`](../docs/reference/configuration.md).
