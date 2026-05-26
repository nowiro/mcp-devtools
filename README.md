# mcp-devtools

[![ci](https://github.com/nowiro/mcp-devtools/actions/workflows/ci.yml/badge.svg)](https://github.com/nowiro/mcp-devtools/actions/workflows/ci.yml)
[![codeql](https://github.com/nowiro/mcp-devtools/actions/workflows/codeql.yml/badge.svg)](https://github.com/nowiro/mcp-devtools/actions/workflows/codeql.yml)
[![gitleaks](https://github.com/nowiro/mcp-devtools/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/nowiro/mcp-devtools/actions/workflows/gitleaks.yml)
[![compliance](https://github.com/nowiro/mcp-devtools/actions/workflows/compliance-sarif.yml/badge.svg)](https://github.com/nowiro/mcp-devtools/actions/workflows/compliance-sarif.yml)
[![role](https://img.shields.io/badge/role-MCP%20server-blue)](#)
[![ide](https://img.shields.io/badge/IDE-VS%20Code%201.121%2B%20%C2%B7%20IntelliJ%202026.1.2%2B-2da44e)](#ide-setup)
[![ai](https://img.shields.io/badge/AI-GitHub%20Copilot-2da44e)](#)
[![os](https://img.shields.io/badge/OS-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-blue)](#)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

Pojedynczy serwer MCP z **narzędziami dev-workflow**: statyczna analiza kodu (multi-framework), składanie kontekstu bug-fix, uruchamianie Playwright, scoring compliance, ledger zużycia tooli. **Cross-platform** (Windows / macOS / Linux), **Copilot-first**, **intranet-ready**.

## Narzędzia

Pełne schematy → `tools/list` przez MCP protocol. Każda odpowiedź wrapowana w `{ data, _meta: { tokensEstimate, correlationId, durationMs } }`.

### `analyze_code`

Statyczna analiza tree TS/TSX/JS/JSX/HTML/Vue — generic findings + per-framework metrics. Frameworki: **Angular**, **React**, **Vue** (auto-detect lub explicit). mtime-cached per path+depth+metrics+framework.

- **Input:** `path: string`, `depth: number` (default 3, max 5), `metrics: boolean` (default true), `framework: "auto" | "angular" | "react" | "vue" | "none"` (default `"auto"`).
- **Output:** `framework` (detected/forced), `findings[]` (kinds: `console-log`, `legacy-pattern`, `todo`, `dangerous-html`), opcjonalne `metrics` z generic (`files_scanned`, `total_lines`, `todo_count`) + per-framework block, `cache_hit: boolean`.
- **Przykład wywołania (Copilot Chat):** _"Przeskanuj src/app pod kątem console.log, TODOs i dangerous-html — Angular metrics"_ → `analyze_code({ path: "src/app", depth: 4, framework: "angular" })`.

### `propose_fix`

Zbiera kontekst bug-fix (failing test + source + rules) dla LLM caller'a. Stack-trace parsing wykrywa `<path>:<line>` (POSIX i Windows separators).

- **Input:** `test_path?`, `source_path?`, `paths?: string[]` (≥ 1 wymagany), `failure_text: string`, `rules_paths: string[]`, `window: number` (default 25, max 200).
- **Output:** `context: { test_excerpt?, source_excerpt?, files[], failure, rules[] }`, `hint: string`.
- **Przykład wywołania:** _"Zbierz kontekst dla failing testu auth.spec.ts:42 — error: Cannot read property of undefined"_ → `propose_fix({ test_path: "src/auth/auth.spec.ts", failure_text: "TypeError: Cannot read property...", paths: ["src/auth/auth.service.ts"], window: 30 })`.

### `run_playwright`

Uruchamia testy Playwright w `project_root` (sandbox-prefix check vs `PROJECT_ROOT`). Spawn'uje `npx playwright test` — automatycznie wybiera `npx.cmd` na Windows i `npx` na macOS/Linux, bez `shell:true`.

- **Input:** `project_root`, `grep?`, `headed?`, `timeout_ms?` (default 120 000), `shard?: "i/N"`, `reporter?: "list" | "json" | "junit" | "line"` (default `"json"`).
- **Output:** `pass / fail / flaky`, `trace_path`, `raw_stdout` (capped 8 KB), `junit_xml?`, `shard?`, `reporter`, `exit_code`.
- **Przykład wywołania:** _"Odpal testy Playwright matching 'checkout' jako shard 1 z 4, junit reporter"_ → `run_playwright({ project_root: ".", grep: "checkout", shard: "1/4", reporter: "junit", timeout_ms: 60000 })`.

### `compliance_report`

Score repo vs katalog `*.md` rules z YAML frontmatter (`must_exist` / `must_not_exist` / `pattern`). Pattern capped at 512 chars (ReDoS defence).

- **Input:** `project_root`, `standards_path`, `format: "json" | "sarif"` (default `"json"`).
- **Output:** `score: 0-100`, `findings[]`, `sarif?` (SARIF 2.1.0).
- **Przykład wywołania:** _"Wygeneruj SARIF report compliance dla tego repo przeciw standardom z docs/standards/"_ → `compliance_report({ project_root: ".", standards_path: "docs/standards", format: "sarif" })`.

### `mcp-devtools.get_usage_history`

In-memory session ledger. FIFO 1000 records.

- **Input:** `{}`.
- **Output:** `totalCalls / totalTokens`, `byTool / byServer: Record<string, { calls, tokens }>`.
- **Przykład wywołania:** _"Ile tokenów już zjadłeś tą sesją? Pokaż breakdown per tool"_ → `mcp-devtools.get_usage_history({})`. Używaj na koniec długiej sesji żeby zobaczyć gdzie poszły tokeny.

## Bezpieczeństwo

- **Sandbox FS** — wszystkie ścieżki resolwowane vs `PROJECT_ROOT`; path traversal blokowany (działa identycznie na NTFS i POSIX FS).
- **Brak outbound HTTP w runtime** — żaden tool nie wykonuje sieci, więc serwer nie potrzebuje proxy ani CA. Gdy ktoś będzie dodawał tool z siecią, sięga po wzorzec z `mcp-alm/src/shared/http-client.ts` (sibling repo — SSRF guard, `HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS` gotowe).
- **Brak persistent state** — session-tracker in-memory FIFO 1000 rekordów.
- **Spawn sandbox** — `run_playwright` weryfikuje `project_root` prefix-check przed `npx playwright test`.
- **ReDoS defence** — `compliance_report` cap'uje pattern length na 512 znaków.
- **Log redaction** — wszystkie token-like keys redacted at any depth (patrz [src/shared/log.ts](src/shared/log.ts)).

Pełna polityka → [SECURITY.md](SECURITY.md).

## Quickstart

```sh
git clone https://github.com/nowiro/mcp-devtools.git
cd mcp-devtools
npm ci
npm run build
```

Działa identycznie na Windows (PowerShell / Git Bash / CMD), macOS (zsh / bash), Linux (bash).

Sanity check:

```sh
# macOS / Linux / Git Bash on Windows
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
```

```powershell
# Windows PowerShell
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
```

Powinno zwrócić 5 tooli.

## IDE setup

### VS Code ≥ 1.121

Repo zawiera gotowy [`.vscode/mcp.json`](.vscode/mcp.json). Rejestruje:

- **`devtools`** — lokalny serwer (zawsze dostępny, `PROJECT_ROOT=${workspaceFolder}`).
- **`alm-jira / alm-confluence / alm-figma / alm-sonar / alm-gitlab`** — pięć siblings z [`mcp-alm`](https://github.com/nowiro/mcp-alm).

Po otwarciu repo VS Code zapyta o **ścieżkę do `mcp-alm`** (domyślnie `${workspaceFolder}/../mcp-alm` — czyli sibling clone). Możesz:

- Zostawić default jeśli sklonowałeś oba repo obok siebie.
- Podać własną absolutną ścieżkę:
  - Windows: `C:\dev\mcp-alm` lub `D:\projects\mcp-alm`
  - macOS / Linux: `/Users/you/dev/mcp-alm` lub `~/code/mcp-alm`
- Zostawić puste — `alm-*` serwery nie wystartują, `devtools` zadziała normalnie.

Następnie: **Copilot Chat → MCP: List Servers → Reload**, zaakceptuj trust prompts. Pełne instrukcje → [docs/getting-started/vscode-setup.md](docs/getting-started/vscode-setup.md).

### IntelliJ IDEA ≥ 2026.1.2

`.idea/mcp-servers.example.xml` to template (IntelliJ nie expanduje zmiennych — wymaga absolutnych ścieżek). Skopiuj, podstaw ścieżki dla swojego OS, importuj przez **Settings → Tools → AI Assistant → Model Context Protocol → Import from file…**. Pełne instrukcje → [docs/getting-started/intellij-setup.md](docs/getting-started/intellij-setup.md).

## Konfiguracja

| Env var        | Cel                                                             |
| -------------- | --------------------------------------------------------------- |
| `PROJECT_ROOT` | Sandbox root dla tooli (default: `cwd`).                        |
| `LOG_LEVEL`    | `trace`/`debug`/`info`/`warn`/`error`/`fatal` (default `info`). |

Network env vars (do użycia gdy ktoś doda tool z siecią) → [docs/reference/configuration.md](docs/reference/configuration.md).

## Diagnostyka

```sh
npm run doctor
```

Sprawdza: wersja Node, `PROJECT_ROOT` resolution, Playwright availability w PATH, OS specifics. Działa cross-platform. Exit 0 = ready, exit 1 = wymaga uwagi.

## Verify

```sh
npm run verify   # format:check + lint + typecheck + test + build
```

## Agenci Copilot — kiedy i jak używać

Repo wprowadza **sześć custom agents** w [`.github/agents/`](.github/agents/), które Copilot wykrywa automatycznie w VS Code (≥ 1.121) jako custom chat modes do wyboru z dropdownu nad polem czatu. Każdy agent ma wąską specjalizację — wybierz pasującego do typu zadania. Plus orchestrator umie routować zadanie do właściwego specjalisty gdy nie wiesz którego wybrać.

| Agent                                                              | Kiedy używać                                                                                   | Przykładowy prompt                                                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`orchestrator`](.github/agents/orchestrator.agent.md)             | Wieloetapowe zadania, plan-first, **routing dla create-new-app** (8-step flow)                 | "Stwórz nowy mcp server dla SonarCloud Cloud" lub "Plan na refactor analyze_code do osobnych analyzerów per framework"   |
| [`architect`](.github/agents/architect.agent.md)                   | Shape rozwiązania zanim ktokolwiek pisze kod: ADR, performance budgets, trust boundaries       | "Zaproponuj layout dla nowego toola który scanuje docker-compose.yml, z ADR dla decyzji parser vs ad-hoc"                |
| [`app-scaffolder`](.github/agents/app-scaffolder.agent.md)         | **Nowa aplikacja / biblioteka / serwer / CDK stack** od zera w house-style                     | "Wygeneruj nowy mcp-server template dla integracji ze ServiceNow, z baseline tools i sample test"                        |
| [`integrator`](.github/agents/integrator.agent.md)                 | Wiring scaffold w prod dev loop: Copilot settings, MCP, CI/CD, CODEOWNERS, deployment          | "Po scaffoldzie nowego serwera mcp-servicenow zwireuj Copilot + ci.yml + gitleaks + dependabot"                          |
| [`tool-author`](.github/agents/tool-author.agent.md)               | Implementacja narzędzia MCP w istniejącym serwerze (Zod Input/Output + ToolDefinition)         | "Dodaj tool `detect_flaky_tests` który skanuje test logs i wykrywa run-to-run variance, deterministic"                   |
| [`security-auditor`](.github/agents/security-auditor.agent.md)     | Sandbox / SSRF / write-guard / STRIDE per asset — przed mergem mutating tools lub external API | "Audyt sandbox dla wszystkich tools przed v0.4.0 release, STRIDE dla compliance_report mutating mode"                    |
| [`test-engineer`](.github/agents/test-engineer.agent.md)           | Coverage ≥ 80%, path traversal tests (POSIX + Windows), deterministic specs (no flaky)         | "Dodaj testy dla `analyze_code` z fixturem Angular 21 app — happy path, cache hit, deep nesting, dangerous-html finding" |
| [`dependency-curator`](.github/agents/dependency-curator.agent.md) | Każda nowa npm dep wymaga ADR, cross-platform test, audit prod-deps, lockfile hygiene          | "Czy `fast-xml-parser` ma sensowny tradeoff vs własny parser dla junit_xml output `run_playwright`? ADR proszę"          |

**Workflow w VS Code:**

1. Otwórz Copilot Chat (`Ctrl+Alt+I` lub `Cmd+Ctrl+I`).
2. Z dropdownu trybu chatu (góra okna) wybierz np. `app-scaffolder`.
3. Wpisz zadanie — Copilot załaduje plik `.github/agents/<name>.agent.md` jako system prompt i odpowie zgodnie z workflow specjalisty.
4. Pozostałe hosty MCP (Claude Desktop, Cursor, własny SDK) czytają agents jako fallback w `AGENTS.md` + `.github/copilot-instructions.md`.

**Sample flow dla "stwórz nowy CDK stack":**

```
orchestrator → architect (ADR + plan)
            → app-scaffolder (npm run workflow:new-tool + scaffolding)
            → integrator (wire CDK + CI)
            → tool-author (pierwszy tool)
            → security-auditor (sandbox + STRIDE per asset)
```

## MCP Prompts — preconfigured slash-commands

Serwer eksponuje **MCP Prompts** (`prompts/list` + `prompts/get`) — gotowe slash-commands w Copilot Chat (`/<prompt>`). Copilot dostaje pełną treść promptu, więc nie musisz pisać kompozycji `analyze_code` + `compliance_report` ręcznie.

| Prompt                        | Args                      | Co robi                                                                                          |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `/pre-commit-check`           | `projectRoot?` (opt.)     | Lekki scan: analyze_code (depth 3) + compliance_report. Veto przy dangerous-html lub score < 80. |
| `/flaky-investigation`        | `testPath`, `failureText` | propose_fix składa kontekst → LLM proponuje root cause + diff (incident vs quality class).       |
| `/full-audit`                 | `projectRoot?` (opt.)     | Comprehensive pre-release audit: analyze_code (deep) + compliance (SARIF) + sandbox audit.       |
| `/mcp-devtools.usage-summary` | —                         | Pokaż usage history obecnej sesji + per-tool tokens / latency breakdown.                         |

**Wzorzec użycia:**

```text
> /pre-commit-check
# Copilot odpala analyze_code + compliance_report w jednym pickerze

> /flaky-investigation testPath=src/auth/auth.spec.ts failureText="TypeError: Cannot read property of undefined"
# Copilot składa context przez propose_fix → LLM diagnozuje
```

Token saving: zamiast "uruchom analyze_code dla całego src, potem compliance vs docs/standards, połącz wyniki, zaproponuj go/no-go" (~50 tokens), wpisujesz `/full-audit` (~3 tokens). Plus prompt jest **cached** w Copilot Chat — nie tracimy contextu na "powtórz".

## Workflow scripts — deterministic scaffolders

Dla najczęściej powtarzanych workflow z `.github/prompts/` repo dostarcza **deterministic scaffolders** w `tools/scripts/workflow-*.mjs`. Skrypty tworzą strukturę (folders, frontmatter, snippety, plan markdown) zanim Copilot zacznie pracować — agent dostaje gotowy szkielet zamiast wymyślać shape. Oszczędność tokenów + reproducible output niezależnie od modelu LLM.

```sh
# Nowy MCP tool (Zod Input/Output + ToolDefinition stub + spec + plan + test)
npm run workflow:new-tool -- \
  --slug=detect-flaky-tests \
  --description="Detect Playwright tests with high run-to-run variance." \
  --mutates=false
# → src/tools/detect-flaky-tests.ts (Zod schema + definition stub),
#   src/tools/detect-flaky-tests.spec.ts (vitest stub),
#   docs/specs/detect-flaky-tests/spec.md (analyst replaces [?]),
#   docs/plans/<date>-new-tool-detect-flaky-tests.md (orchestrator).
# Następnie tool-author agent wypełnia TODO + rejestruje w src/server.ts.

# Static security audit przed mergem
npm run workflow:audit-sandbox
# → skanuje src/tools/*.ts za naruszeniami sandbox:
#   raw fs imports, path.resolve bez assertWithinSandbox, glob over-reach,
#   absolute path literals, fs.realpath.
# Auto-whitelist plików używających assertWithinSandbox helper.
# Output: docs/runs/<date>-audit-sandbox.md, exit 1 na high findings.
# CI-ready — można dodać step w .github/workflows/ci.yml.

npm run workflow:audit-sandbox -- --strict   # exit 1 na każde finding (nie tylko high)
npm run workflow:audit-sandbox -- --json     # JSON output dla pipeline integration
```

## Response templates — LLM-agnostic outputs

Tool handlery renderują payload przez `src/shared/response-template.ts` z markdown+frontmatter templates pod `templates/responses/`. Cel: **identyczna struktura odpowiedzi niezależnie od modelu LLM** który ją czyta (Claude / GPT / Gemini behind Copilot).

```sh
npm run template:list
# → analyze-code-finding, propose-fix-context, compliance-finding, error

npm run template:render -- --name=analyze-code-finding --vars=tests/fixtures/analyze-code-finding.json
# → renderuje template z fixture data, podgląd markdown wyjścia
```

W tool handler:

```ts
import { templateResponse } from '../shared/response-template.js';

return templateResponse(
  'analyze-code-finding',
  { target: './src/app', framework: 'angular', findings: [...] },
  { correlationId, server: 'mcp-devtools', tool: 'analyze_code' },
);
// → ToolResponse<string> z markdown payload + _meta envelope (tokensEstimate, durationMs)
```

Każdy template ma `version:` w frontmatter — bump przy breaking shape changes (semver minor = compatible, major = breaking).

## Deterministyczne audyty (validate + token-budget)

Dwa skrypty static-only które pilnują kontraktu narzędzi przed mergem:

```sh
npm run validate:inputs
# → static check że każdy src/tools/*.ts ma:
#   - exported Input Zod schema
#   - exported Output Zod schema
#   - exported definition: ToolDefinition
#   - definition.inputSchema: Input (named ref, nie inline)
#   - definition.outputSchema: Output
#   - definition.handle(input, ctx) method
# Wpięte w npm run verify — drift kontraktu blokuje commit.
# Obecny stan: 4/4 tools clean.

npm run token:budget
# → scan Zod limits (.min/.max/.default) w src/tools/*.ts,
#   porównanie z baseline z .github/instructions/llm-optimization.instructions.md,
#   raport docs/runs/<date>-token-budget.md z recommendations
#   (review-high-max, add-default).
# Manualny audit — akcje delegowane do tool-author w osobnym PR.
```

## Pozycjonowanie

| Repo               | Rola                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| `mcp-alm`          | 5 connectorów ALM (Jira / Confluence / Figma / SonarQube / GitLab). Copilot-first. |
| **`mcp-devtools`** | **Tu jesteś** — dev-workflow primitives. Copilot-first.                            |

Domyślny layout zakłada że oba repo żyją obok siebie (`<parent>/mcp-alm` + `<parent>/mcp-devtools`) — ale `.vscode/mcp.json` pyta o ścieżkę przy pierwszym reload, więc dowolny layout zadziała.
