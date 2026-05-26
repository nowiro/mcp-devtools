# AGENTS.md — agenci pracujący w tym repo

> Format zgodny z konwencją [AGENTS.md](https://agents.md): zwykły Markdown,
> który dowolny AI coding assistant przeczyta na początku sesji. Ten plik
> jest **cienkim wskaźnikiem** — pełen rulebook agenta żyje w
> [`.github/copilot-instructions.md`](.github/copilot-instructions.md) i
> [`.github/instructions/`](.github/instructions/).

## Tożsamość

Pracujesz wewnątrz **mcp-devtools** — projektu TypeScript / Node 22, który shipuje **jeden** serwer MCP (Model Context Protocol) z 5 narzędziami dev-workflow:

- `analyze_code` — statyczna analiza tree TS/TSX/JS/JSX/HTML/Vue z auto-detect framework (Angular / React / Vue).
- `propose_fix` — kontekst bug-fix (fault-line slicing) dla LLM caller'a.
- `run_playwright` — uruchamianie testów Playwright w target repo.
- `compliance_report` — scoring repo vs YAML-frontmatter standards (JSON / SARIF).
- `mcp-devtools.get_usage_history` — in-memory session ledger.

Główny klient: **GitHub Copilot** w **VS Code ≥ 1.121** i **IntelliJ IDEA ≥ 2026.1.2**. Inne MCP-zgodne hosty (Claude Desktop, Cursor, własny Agent SDK) też działają — nie wstawiaj założeń IDE-specific do runtime'u.

**Cross-platform**: kod, ścieżki, skrypty muszą działać na Windows i macOS/Linux identycznie. Używaj `node:path` (`nodePath.join`, `nodePath.resolve`) zamiast literal separatorów. Spawn'uj `npx.cmd` na Windows i `npx` na POSIX (patrz `run-playwright.ts`).

## Reguły, których każdy agent musi przestrzegać

1. **Czytaj zanim ogłosisz, że wiesz.** Otwórz plik. Nie zgaduj.
2. **Najmniejsza rozsądna zmiana.** Bez drive-by refactorów.
3. **Cross-platform.** Żadnych hardcoded ścieżek (Windows ani POSIX) w source ani configach. Zawsze `node:path`, `os.homedir()`, `process.platform`.
4. **Nigdy nie pisz `console.log` do stdout** z pliku serwera — stdout to ramka MCP. Loguj JSON-line na stderr przez [`src/shared/log.ts`](src/shared/log.ts).
5. **Sandbox FS.** Każda ścieżka z `input` przez `assertWithinSandbox(path, ctx.projectRoot, '<tool>')`. Path traversal → throw przed I/O.
6. **Zod wszędzie** na granicach narzędzi. Brak `any` w input/output typach.
7. **Mutating ops** wymagają `apply: true` w input (default: dry-run). Żaden v0.3.0 tool nie ma jeszcze takich.
8. **Definition of Done** przed ogłoszeniem sukcesu:
   `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`.
9. **Conventional Commits** dla każdego commitu (wymuszane przez husky `commit-msg` hook + commitlint).

## Custom agents (VS Code Copilot)

Każdy specjalista ma dedykowany **custom agent** w [`.github/agents/`](.github/agents/) — wybierasz go z dropdownu chatu w VS Code:

| Mode                                                           | Kiedy używać                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`orchestrator`](.github/agents/orchestrator.agent.md)         | multi-step zadania, plan-first, koordynacja specjalistów, **routing dla create-new-app** |
| [`architect`](.github/agents/architect.agent.md)               | shape rozwiązania, ADR, performance budgets, trust boundaries                            |
| [`app-scaffolder`](.github/agents/app-scaffolder.agent.md)     | **nowa aplikacja / biblioteka / serwer / CDK stack** od zera w house-style               |
| [`integrator`](.github/agents/integrator.agent.md)             | wiring scaffold w prod dev loop (Copilot, MCP, CI, deployment)                           |
| [`tool-author`](.github/agents/tool-author.agent.md)           | implementacja narzędzia MCP w istniejącym serwerze                                       |
| [`security-auditor`](.github/agents/security-auditor.agent.md) | sandbox / SSRF / write-guard / STRIDE per asset                                          |

VS Code musi mieć włączone `chat.modeFilesLocations` w [`.vscode/settings.json`](.vscode/settings.json).

Inne hosty MCP (Claude Desktop, Cursor, własny SDK) nie czytają agents — czytają `AGENTS.md` + `.github/copilot-instructions.md` jako fallback.

## Response templates (LLM-agnostic outputs)

Tool handlery renderują payload przez [`src/shared/response-template.ts`](src/shared/response-template.ts) z markdown+frontmatter templates pod [`templates/responses/`](templates/responses/). Cel: **identyczna struktura odpowiedzi niezależnie od modelu LLM** który ją czyta (Claude / GPT / Gemini behind Copilot).

Engine syntax (self-contained, no deps):

- `{{ var }}` lub `{{ var.path }}` — substytucja z dot-notation
- `{{ var | default:"—" }}` — fallback gdy nullish / pusty string
- `{{#if var}}...{{/if}}` — warunek (truthy = non-empty)
- `{{#each list}} {{ this.field }} {{/each}}` — pętla z item scope (nested loops supported)

Workflow:

1. Edytuj `templates/responses/<name>.md` (frontmatter: `id`, `description`, `version`, `vars`).
2. Preview z fixture: `npm run template:render -- --name=<name> --vars=tests/fixtures/<name>.json`.
3. W tool handler: `import { templateResponse } from '../shared/response-template.js'` → `return templateResponse('analyze-code-finding', vars, metaInput)`.
4. Vitest spec pinuje contract: [`src/shared/response-template.spec.ts`](src/shared/response-template.spec.ts) (13 testów).

Dostępne templates: `npm run template:list` (analyze-code-finding, propose-fix-context, compliance-finding, error).

Gdy dodajesz template — dodaj fixture w `tests/fixtures/<name>.json` żeby preview działało. Gdy zmieniasz template — bump `version:` w frontmatter.

## Pliki do załadowania na początku sesji

- [`README.md`](README.md) — overview od strony użytkownika.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — rulebook agenta (najwyższy priorytet dla Copilot).
- [`.github/agents/`](.github/agents/) — per-specjalista agents (orchestrator, architect, app-scaffolder, integrator, tool-author, security-auditor).
- [`.github/instructions/`](.github/instructions/) — zakresowe reguły aplikowane przez glob `applyTo`:
  - [`core.instructions.md`](.github/instructions/core.instructions.md) — DRY/SOLID/KISS/YAGNI.
  - [`security.instructions.md`](.github/instructions/security.instructions.md) — sandbox FS, SSRF, secrets policy.
  - [`tool-contract.instructions.md`](.github/instructions/tool-contract.instructions.md) — kontrakt każdego toola.

## Gdzie idzie nowa praca

| Rodzaj pracy             | Sugerowany katalog                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Nowy MCP tool            | `src/tools/<tool>.ts` + `src/tools/<tool>.spec.ts` + rejestracja w `src/server.ts`             |
| Cross-cutting helper     | `src/shared/` (musi mieć obok plik `*.spec.ts`)                                                |
| Doc                      | `docs/<section>/` — Diátaxis (getting-started / how-to / reference / explanation)              |
| Workflow / slash command | `.github/prompts/<name>.prompt.md` (auto-rozpoznawane przez Copilot Chat jako `/<name>`)       |
| CDK workflow (compile)   | `src/cdk/workflows/<name>.workflow.ts` → `npm run cdk:compile` generuje `.github/prompts/*.md` |

## Koordynacja z innymi repo

Repo jest **standalone**. Sibling [`mcp-alm`](https://github.com/<your-org>/mcp-alm) wystawia 5 ALM connectorów (Jira / Confluence / Figma / Sonar / GitLab) — `.vscode/mcp.json` w tym repo opcjonalnie je rejestruje (pyta o ścieżkę przez `${input:mcp-alm-path}`).

Jeśli dodajesz tool z siecią, skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts` (sibling repo, MIT) — SSRF guard, `HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS` już obsłużone.
