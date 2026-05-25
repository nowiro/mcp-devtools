# mcp-devtools

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

### `propose_fix`

Zbiera kontekst bug-fix (failing test + source + rules) dla LLM caller'a. Stack-trace parsing wykrywa `<path>:<line>` (POSIX i Windows separators).

- **Input:** `test_path?`, `source_path?`, `paths?: string[]` (≥ 1 wymagany), `failure_text: string`, `rules_paths: string[]`, `window: number` (default 25, max 200).
- **Output:** `context: { test_excerpt?, source_excerpt?, files[], failure, rules[] }`, `hint: string`.

### `run_playwright`

Uruchamia testy Playwright w `project_root` (sandbox-prefix check vs `PROJECT_ROOT`). Spawn'uje `npx playwright test` — automatycznie wybiera `npx.cmd` na Windows i `npx` na macOS/Linux, bez `shell:true`.

- **Input:** `project_root`, `grep?`, `headed?`, `timeout_ms?` (default 120 000), `shard?: "i/N"`, `reporter?: "list" | "json" | "junit" | "line"` (default `"json"`).
- **Output:** `pass / fail / flaky`, `trace_path`, `raw_stdout` (capped 8 KB), `junit_xml?`, `shard?`, `reporter`, `exit_code`.

### `compliance_report`

Score repo vs katalog `*.md` rules z YAML frontmatter (`must_exist` / `must_not_exist` / `pattern`). Pattern capped at 512 chars (ReDoS defence).

- **Input:** `project_root`, `standards_path`, `format: "json" | "sarif"` (default `"json"`).
- **Output:** `score: 0-100`, `findings[]`, `sarif?` (SARIF 2.1.0).

### `mcp-devtools.get_usage_history`

In-memory session ledger. FIFO 1000 records.

- **Input:** `{}`.
- **Output:** `totalCalls / totalTokens`, `byTool / byServer: Record<string, { calls, tokens }>`.

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

## Pozycjonowanie

| Repo               | Rola                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| `mcp-alm`          | 5 connectorów ALM (Jira / Confluence / Figma / SonarQube / GitLab). Copilot-first. |
| **`mcp-devtools`** | **Tu jesteś** — dev-workflow primitives. Copilot-first.                            |

Domyślny layout zakłada że oba repo żyją obok siebie (`<parent>/mcp-alm` + `<parent>/mcp-devtools`) — ale `.vscode/mcp.json` pyta o ścieżkę przy pierwszym reload, więc dowolny layout zadziała.
