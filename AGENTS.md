# AGENTS.md — agenci pracujący w tym repo

> Format [agents.md](https://agents.md). Cienki wskaźnik — pełen rulebook w [`.github/copilot-instructions.md`](.github/copilot-instructions.md) i [`.github/instructions/`](.github/instructions/).

## Tożsamość

**mcp-devtools** — TypeScript / Node 22, jeden serwer MCP (stdio) z 5 narzędziami dev-workflow:

- `analyze_code` — statyczna analiza TS/TSX/JS/JSX/HTML/Vue (Angular / React / Vue auto-detect).
- `propose_fix` — kontekst bug-fix (fault-line slicing) dla LLM caller'a.
- `run_playwright` — Playwright tests w target repo (cross-platform spawn `npx.cmd`/`npx`).
- `compliance_report` — scoring repo vs YAML-frontmatter standards (JSON / SARIF).
- `mcp-devtools.get_usage_history` — in-memory session ledger.

Klient: **GitHub Copilot** w VS Code ≥ 1.121, IntelliJ ≥ 2026.1.2, Eclipse (od 2026-05-21). Inne MCP hosty (Claude Desktop, Cursor) też działają.

**Cross-platform**: użyj `node:path` (`nodePath.join`/`resolve`), `os.homedir()`, `process.platform`. Spawn'uj `npx.cmd` na Windows i `npx` na POSIX.

## Konfiguracja repo (dla kogoś modyfikującego ten kod)

**Single AI host: GitHub Copilot.** Repo NIE utrzymuje konfiguracji pod Claude Code / Cursor / inne narzędzia developerskie. Świadomie brak:

- `CLAUDE.md` (instrukcje dla Claude Code)
- `.claude/` (workspace Claude Code: agents, commands, hooks, skills, settings)
- `.ai/` (kanoniczna wiedza AI — rules, agents, workflows, prompts)

Single source of truth dla agentów: ten `AGENTS.md` + [`.github/copilot-instructions.md`](.github/copilot-instructions.md) + [`.github/instructions/`](.github/instructions/) + [`.github/prompts/`](.github/prompts/) + [`.github/chatmodes/`](.github/chatmodes/).

> Uwaga: inne MCP hosty (Claude Desktop, Cursor, custom Agent SDK) mogą **konsumować** uruchomiony serwer MCP zgodnie ze standardem MCP — to inna sprawa niż konfiguracja dewelopmentu kodu repo.

## Reguły (skrót dla agentów spoza Copilot)

Pełen rulebook → [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

1. **Czytaj kod przed deklarowaniem.** Nie zgaduj.
2. **Najmniejsza rozsądna zmiana.** Bez drive-by refactor.
3. **Cross-platform.** Bez hardcoded separatorów (Windows ani POSIX). `node:path` zawsze.
4. **`console.log` do stdout w serwerze** = MCP frame uszkodzony. Loguj JSON-line do stderr przez [`src/shared/log.ts`](src/shared/log.ts).
5. **Sandbox FS.** Każda ścieżka z `input` przez `assertWithinSandbox(path, ctx.projectRoot, '<tool>')`. Path traversal → throw przed I/O.
6. **Zod wszędzie** na granicach narzędzi — brak `any`.
7. **Mutating ops** wymagają `apply: true` w input (default: dry-run).
8. **DoD = `npm run verify`** (format + lint + typecheck + test + build + ai:validate).
9. **Conventional Commits** — husky commit-msg + commitlint enforce.

## Custom chat modes (VS Code Copilot)

**Jeden widoczny tryb.** Repo wystawia tylko jeden custom chat mode w mode picker Copilota — `orchestrator`. Routuje on do wewnętrznych personas które nie pojawiają się w pickerze (świadoma decyzja: prostsze UX dla użytkownika końcowego).

### Widoczne w mode picker

| Mode                                                         | Kiedy używać                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`orchestrator`](.github/chatmodes/orchestrator.chatmode.md) | każde high-level zadanie — multi-step, plan-first, routing do specjalistów |

### Wewnętrzne persony (ładowane przez orchestrator, nie pojawiają się w pickerze)

| Persona                                                            | Kiedy orchestrator je ładuje                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`architect`](.github/agents/architect.agent.md)                   | shape rozwiązania, plan, performance budgets, trust boundaries             |
| [`app-scaffolder`](.github/agents/app-scaffolder.agent.md)         | **nowa app / lib / serwer / CDK stack** od zera w house-style              |
| [`integrator`](.github/agents/integrator.agent.md)                 | wiring scaffold w prod dev loop (Copilot, MCP, CI, deployment)             |
| [`tool-author`](.github/agents/tool-author.agent.md)               | implementacja narzędzia MCP w istniejącym serwerze                         |
| [`security-auditor`](.github/agents/security-auditor.agent.md)     | sandbox / SSRF / write-guard / STRIDE per asset                            |
| [`dependency-curator`](.github/agents/dependency-curator.agent.md) | audit prod-deps, lockfile hygiene, supply-chain guard                      |
| [`test-engineer`](.github/agents/test-engineer.agent.md)           | coverage ≥ 80% per tool, sandbox path traversal tests, deterministic specs |

### Power-user shortcuts

Slash-commands w [`.github/prompts/`](.github/prompts/) (`/new-tool`, `/audit-sandbox`, `/diagnose`, `/release`, `/security-review`, `/sdd-demo`) uruchamiają konkretną ścieżkę bez przechodzenia przez orchestratora — dla power userów którzy wiedzą co chcą.

VS Code wymaga `chat.modeFilesLocations` w [`.vscode/settings.json`](.vscode/settings.json) (chatmodes są discoverable automatycznie z `.github/chatmodes/`). Inne hosty MCP czytają `AGENTS.md` + `.github/copilot-instructions.md` jako fallback.

## Gdzie idzie nowa praca

| Rodzaj pracy             | Sugerowany katalog                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Nowy MCP tool            | `src/tools/<tool>.ts` + `src/tools/<tool>.spec.ts` + rejestracja w `src/server.ts`             |
| Nowy MCP resource        | Markdown w `templates/resources/<slug>.md` + `defineMarkdownResource({…})` w `src/server.ts`   |
| Nowy MCP prompt          | `definePrompt({…})` w array `prompts` w `src/server.ts`                                        |
| Cross-cutting helper     | `src/shared/` (+ `*.spec.ts`)                                                                  |
| Doc                      | `docs/<section>/` (Diátaxis: getting-started / how-to / reference / explanation)               |
| Workflow / slash command | `.github/prompts/<name>.prompt.md` (auto-discoverable jako `/<name>` w Copilot Chat)           |
| CDK workflow             | `src/cdk/workflows/<name>.workflow.ts` → `npm run cdk:compile` generuje `.github/prompts/*.md` |

## Workflow scripts + response templates

Deterministyczne scaffoldery w `tools/scripts/workflow-*.mjs` (`/new-tool`, `/audit-sandbox`) — LLM nie pali tokenów na decyzje o shape. Response templates w `templates/responses/` — identyczne shape niezależnie od modelu LLM. Pełen kontrakt: [`src/shared/response-template.ts`](src/shared/response-template.ts) docstring.

`validate:inputs` (wpięte w `verify`) static check `Input`/`Output`/`definition` w każdym `src/tools/*.ts`. `token:budget` — manualny audit Zod limits.

## Koordynacja z innymi repo

Repo **standalone**. Sibling [`mcp-alm`](https://github.com/nowiro/mcp-alm) wystawia 5 ALM connectorów (Jira / Confluence / Figma / Sonar / GitLab) — `.vscode/mcp.json` opcjonalnie rejestruje je przez `${input:mcp-alm-path}`.

Tool z siecią? Skopiuj `mcp-alm/src/shared/http-client.ts` (MIT) — SSRF + proxy + NODE_EXTRA_CA_CERTS gotowe.
