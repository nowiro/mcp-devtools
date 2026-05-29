# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Custom agents (VS Code Copilot) — jeden widoczny `orchestrator`.** `.github/agents/orchestrator.agent.md` to jedyny agent w pickerze; 7 specjalistów (architect, app-scaffolder, integrator, tool-author, security-auditor, test-engineer, dependency-curator) ma `user-invocable: false` i jest wołanych jako subagenci (tool `agent`). Discovery: `chat.agentFilesLocations` → `.github/agents/` w `.vscode/settings.json`. Świadoma decyzja: prostsze UX dla użytkownika końcowego.
- **`.github/workflows/release.yml`** — workflow publikujący `@nowiro/mcp-devtools` na npm registry przy push tagów `v*`. Uses `npm publish --provenance --access public` (SLSA-3-grade attestation). Pre-flight: repo owner ustawia secret `NPM_TOKEN` (Automation token scoped do `@nowiro` org).
- **`README.md`** — sekcja "Uruchomienie bez klonowania (npx)" pokazująca `mcp.json` snippet z `npx -y -p @nowiro/mcp-devtools mcp-devtools` dla VS Code Copilot Chat oraz Claude Desktop / Cursor. Bez `git clone`, bez `npm install`, bez `npm run build` po stronie usera.
- **MCP Resources** (`resources/list` + `resources/read`) — serwer eksponuje read-only docs ładowane przez Copilot jako deterministyczny kontekst. URIs: `mcp-devtools://docs/{analyze-findings-catalog,compliance-rules-spec,propose-fix-context-guide}`. Parity z `mcp-alm` — ta sama shape definicji, mirror użycia w Copilot Chat (`#mcp.resource`).
- **`src/shared/resource.ts`** — `ResourceDefinition` + `defineResource` + `defineMarkdownResource({ uri, name, description, file })` resolwujący path z `templates/resources/<file>.md` przez `import.meta.url` (cross-platform, niezależne od `cwd`).
- **`templates/resources/`** — 3 markdown źródła: `analyze-findings-catalog.md` (finding kinds + framework detection + metrics), `compliance-rules-spec.md` (rule file format + SARIF), `propose-fix-context-guide.md` (input shape + sandbox + workflow). Edytowalne bez restartu Copilota.
- **`src/server.ts`** — handlery `ListResourcesRequestSchema` + `ReadResourceRequestSchema` zarejestrowane; capability `resources: {}` dodane do `Server` constructora.
- **`README.md`** — sekcja "MCP Resources — preconfigured docs context" z tabelą URI + wzorcem użycia.
- **`tools/scripts/validate-ai-config.mjs`** — walidacja konfiguracji Copilot (`.vscode/mcp.json`, frontmatter `.github/instructions/*.instructions.md`, `prompts/*.prompt.md`). Run: `npm run ai:validate`.
- **`tools/scripts/dev-client.mjs`** — minimalny klient stdio do ręcznego testowania serwera MCP bez IDE. `node tools/scripts/dev-client.mjs [tool] ['<json-args>']`.
- **`.github/workflows/pr-checks.yml`** — weryfikacja conventional commits w PR-ach + format tytułu PR (`amannn/action-semantic-pull-request`) + secret scan (gitleaks).
- **`.github/instructions/language.instructions.md`** — reguły split PL/EN: proza po polsku, kod/identyfikatory/opisy MCP po angielsku.
- **`.github/instructions/llm-optimization.instructions.md`** — reguły budżetu tokenów, token-shaping, deterministyczne skrypty, `_meta` envelope.
- **`.github/instructions/mcp-server.instructions.md`** — konwencje serwera: naming narzędzi, sandbox, Zod, error contract, logowanie.
- **`.github/instructions/principles.instructions.md`** — złote reguły: DRY/SOLID/KISS/YAGNI/composition.
- **`.github/instructions/production-readiness.instructions.md`** — 4 must-haves przed shipnięciem: sandbox, Zod, testy, verify gate.
- **`.github/skills/` — Agent Skills (agentskills.io) adopted.** README przepisany z placeholdera na active (stable spec: Copilot 2025-12, VS Code `SKILL.md` ~2026-04). Pierwszy realny skill `analyze-code-triage/SKILL.md` — triage findingów `analyze_code` po severity/kind + fix order (read-only).
- **`tools/scripts/validate-ai-config.mjs`** — sekcja 6: walidacja `.github/skills/<name>/SKILL.md` (`name` + `description`, `name == folder`, charset/długość, reject flat `*.md`). `npm run ai:validate` raportuje licznik `N skills`.
- **`.github/prompts/refine.prompt.md`** — slash-command `/refine` (`mode: ask`): bierze surowy zarys promptu i zwraca dopracowaną wersję do akceptacji; bez side-effectów (nie edytuje plików, nie woła toolów).

### Removed

- **`.github/chatmodes/orchestrator.chatmode.md`** — usunięty po rename VS Code „custom chat modes → custom agents". Orchestrator żyje teraz jako `.github/agents/orchestrator.agent.md`; katalog `.github/chatmodes/` skasowany.

### Changed

- **`AGENTS.md`** — sekcja "Custom agents (VS Code Copilot)" → "Custom chat modes (VS Code Copilot)" z tabelą rozdzieloną na **Widoczne w mode picker** (1 wiersz: orchestrator) i **Wewnętrzne persony** (7 wierszy: specjaliści ładowani przez orchestrator). Dodana sekcja "Power-user shortcuts" linkująca do `.github/prompts/`.
- **`README.md`** — sekcja "Agenci Copilot — kiedy i jak używać" przerobiona pod single-orchestrator pattern: jeden tryb w pickerze + decision tree + przykładowy flow + tabela slash-commands jako direct paths dla power userów.
- **`package.json`** — pakiet przygotowany do publikacji na npm:
  - `name` → `@nowiro/mcp-devtools` (scoped),
  - usunięte `"private": true`,
  - `files: ["dist","README.md","LICENSE","CHANGELOG.md"]` ogranicza tarball do prebuiltu + metadanych,
  - `publishConfig: { access: "public", provenance: true }`,
  - `scripts.prepublishOnly: "npm run build"` gwarantuje świeży `dist/` w tarballu.
- **`package.json#version`** — `0.3.0` → `1.0.0`. Projekt jest feature-complete; parity z `mcp-alm` 1.0.0.
- **`package.json#scripts`** — dodano `ai:validate`; `verify` rozszerzony o `&& npm run ai:validate`.
- **`package.json#{homepage,repository,bugs}`** — `<your-org>` → `nowiro`.
- **`.github/copilot-instructions.md`** — rozszerzony 80 → 140 LoC: tabela narzędzi, architektura, lista instrukcji do załadowania, sekcja "Dodawanie nowego narzędzia".
- **`README.md`** — `<your-org>` → `nowiro` w badge URL, URL klonowania, linku do mcp-alm.

## [1.0.0] — 2026-05-25

Cross-platform pass: repo musi działać z GitHub Copilot identycznie na Windows i macOS/Linux. Plus OSS hygiene parity z sibling `mcp-alm`.

### Added

- **`tools/scripts/bootstrap.mjs`** — one-command repo initialiser (Node version check, npm ci, hooks, build, doctor). Cross-platform, idempotent. Flags: `--reinstall`, `--skip-install`, `--skip-build`, `--skip-doctor`. Run: `npm run bootstrap`.
- **`tools/scripts/doctor.mjs`** — cross-platform diagnostics: Node version, OS detection, dist artefacts, `PROJECT_ROOT` sandbox, Playwright availability, `npx.cmd`/`npx` w PATH, IDE config files. Run: `npm run doctor` lub `npm run doctor --json` dla CI.
- **`commitlint.config.mjs`** + **`.husky/commit-msg`** — Conventional Commits enforcement. Types: feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert. Scopes: tool names + shared + cdk + ci/deps/docs/release/security/tooling.
- **`vitest.config.ts`** — explicit konfiguracja zamiast defaultów, JUnit reporter w CI, coverage thresholds (smoke baseline 50%), exclude `src/server.ts` i `src/cdk/workflows/**` (orkiestracja + auto-generated).
- **OSS hygiene files**: `AGENTS.md` (thin pointer w konwencji [agents.md](https://agents.md)), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SUPPORT.md`, `.editorconfig` (LF wszędzie, CRLF tylko dla `*.ps1`), `.npmrc` (`engine-strict=true`, `audit-level=high`).
- **`.github/ISSUE_TEMPLATE/{bug,feature,config}.yml`** — strukturyzowane formularze issues z dropdownem narzędzia/OS/host MCP + pole na output `doctor`.
- **`.github/workflows/scorecard.yml`** — OpenSSF Scorecard (cotygodniowo + push do main, SARIF do Security tab; `publish_results: false` do czasu publicznego ujawnienia repo).
- **`.github/prompts/release.prompt.md`** — `/release` slash command: pre-flight verify gate, version bump z Conventional Commits, regen CHANGELOG, tag + push.
- **`.github/prompts/diagnose.prompt.md`** — `/diagnose` slash command: cross-platform diagnostyka (Node/OS/build/PATH/stdio sanity).
- **CI matrix Windows + macOS + Linux** — `verify` job uruchamia się na 3 OS równolegle. Plus dedykowany `audit` job (`npm audit --omit=dev --audit-level=high`). Coverage + dist artifacts upload (Linux only żeby uniknąć duplikatów).
- **`package.json` metadata** — `repository`, `bugs`, `homepage`, `keywords`, `os: [darwin, linux, win32]`.

### Changed

- **`src/tools/analyze-code.ts`** — refactor framework-agnostic. Nowy parametr `framework: 'auto' | 'angular' | 'react' | 'vue' | 'none'` (default `auto` z detektorem z importów). Per-framework metrics block (`metrics.angular | .react | .vue`). Generic findings: `console-log`, `legacy-pattern`, `todo`, `dangerous-html`. Dodano React detector (`useState`/`useEffect`/`useMemo`/`useCallback`/class components/`dangerouslySetInnerHTML`) i Vue detector (`defineComponent`/`defineProps`/`defineEmits`/SFC count). Tests: 19 (było 7).
- **`.vscode/mcp.json`** — hardcoded `C:\github\mcp-alm` zastąpione `${input:mcp-alm-path}` z domyślnym `${workspaceFolder}/../mcp-alm`. Działa od razu na Windows, macOS i Linux. Pusty input pomija `alm-*` serwery.
- **`README.md`** — sekcja Quickstart z przykładami dla PowerShell i bash, IDE setup pokazuje ścieżki Windows i macOS, link do `npm run doctor`, badge `os: Windows · macOS · Linux`.
- **`docs/getting-started/vscode-setup.md`** — pełna refresh z dwoma OS, troubleshooting per-platform, sekcja "Re-prompt o inputs" (Reset Inputs).
- **`docs/getting-started/intellij-setup.md`** — XML snippety osobno dla Windows i macOS/Linux, `Resolve-Path` vs `pwd` dla absolute paths.
- **`.vscode/extensions.json`** — rozszerzone z 4 do 13 rekomendacji (editorconfig, github-actions, yaml, spell-check, errorlens, pretty-ts-errors, vitest.explorer, playwright, markdownlint).
- **`.github/copilot-instructions.md`** + **`CONTRIBUTING.md`** — sekcja Conventional Commits zaktualizowana: commitlint enforced przez husky `commit-msg`, lista types + scopes, `npm run commit` dla commitizen.

### Removed

- Stwierdzenie "commitlint **nie** jest enforced — konwencja na zaufanie" w `copilot-instructions.md` i `CONTRIBUTING.md` (teraz faktycznie enforced).
- Martwe warianty `kind: 'ts-error' | 'eslint'` z output `analyze_code.findings` (nigdy nie były emitowane — README mówi że tool nie spawnuje `tsc`/`eslint`).

## [0.3.0] — 2026-05-22

Major cleanup pass: project simplified, intranet-ready, pnpm → npm, dual-AI references purged.

### Removed (drugie cięcie)

- **`src/shared/llm-optimize.ts`** — `LruCache`, `summarizeArray`, `terse`, `cacheKey` (niewywoływane przez tools/server). Plik zostawiony tylko z `compactJson` (~230 LoC → ~75 LoC). Spec proporcjonalnie obcięty.
- **`src/shared/session-tracker.ts`** — `HttpCounters` (8 pól), `RateLimitSnapshot`, `bumpHttp`, `recordRateLimit`, `takeRateLimit` (były dla wycofanego `read_docs`/HTTP). Plik ~200 → ~110 LoC. `SessionSummary` shape uproszczony.
- **`.husky/pre-push`** — `tsc --noEmit && build` przy każdym push; CI to robi, `npm run verify` lokalnie też.
- **ADR-0002** (Zod input validation) i **ADR-0005** (tools as primitives) — pierwsza trywialna, druga już w `.github/instructions/tool-contract.instructions.md`.

### Removed (trzecie cięcie)

- **`docs/adr/`** całkowicie — 4 pliki (2 historyczne ADR-y + template + README). Treść pokryta w SECURITY.md + tool-contract.instructions.md. Historia decyzji żyje w git log.
- **`docs/reference/tools.md`** — przeniesione do README jako 5 rozszerzonych sekcji per tool.
- **`src/shared/types.ts#ErrorCodes`** — const niewywoływany w runtime. Tool-contract dokumentuje konwencję; serwer mapuje `Error.message` na MCP wire format.
- **`compactJson` `CompactJsonOptions`** — `dropNulls`/`dropFalse`/`dropEmptyArrays` etc. hard-coded; `server.ts` i tak nigdy nie przekazywał opcji. Plik ~75 → ~40 LoC.

### Removed (czwarte cięcie)

- **`src/shared/errors.ts`** — `AlmError`, `AuthError`, `NotFoundError`, `RateLimitError`, `UpstreamError`, `NetworkError`, `WriteDeniedError` (z mcp-alm port). **0 importów** w devtools. -73 LoC.
- **`src/shared/http-client.ts`** — port z mcp-alm zachowany "as a pattern for future connectors". **0 callsites**. Wzorzec żyje w sibling repo `mcp-alm/src/shared/http-client.ts`. -220 LoC.
- **`src/shared/response-meta.ts`** — `RateLimitInfo` interface, `ResponseMeta.rateLimit?` field (były dla wycofanego rate-limit tracking), `isToolResponse` type guard (tylko spec-test). -25 LoC.
- Wszystkie docs/instructions/prompts zaktualizowane: odsyłają teraz do `mcp-alm/src/shared/http-client.ts` jako wzorca do skopiowania, nie do lokalnego pliku.

### Removed (piąte cięcie)

Faza 0 sketches usunięte z drzewa po akceptacji (treść w git history, Faza 2 odbuduje production version):

- **`src/cdk/workflows/scaffold-app.workflow.ts`** — Workflow #1 TS sketch. CLI go skipował (rzucał na required `props`), runtime nieaktywny. -174 LoC.
- **`src/cdk/constructs/stubs.ts`** + **`src/cdk/constructs/index.ts`** — 9 stub Constructs istniejących tylko żeby scaffold-app sketch się kompilował. Wszystkie throw `NOT IMPLEMENTED` w `synth()`. -191 LoC.
- **`.github/prompts/sdd-scaffold-app.prompt.md`** — handwritten target output Faza 1 compile-a. Po Faza 1 niepotrzebny — Faza 2 wygeneruje production version z real Constructs. -277 LoC markdown.
- **`src/cdk/README.md`** — orientation note. Treść w [`docs/explanation/sdd-architecture.md`](docs/explanation/sdd-architecture.md).
- **CLI try/catch skip-on-fail** w `mcp-devtools-cdk.ts` — defensive logic dla workflows wymagających props w konstruktorze. Bez scaffold-app niepotrzebne; gdy Faza 2 doda real workflows, props będą optional.

Plus **`.github/prompts/sdd-demo.prompt.md`** committed jako proof Faza 1 compile (auto-generated z `src/cdk/workflows/demo.workflow.ts`).

### Removed (szóste cięcie)

- **`.mcp.json`** — generic MCP registry dla "non-VS-Code hosts". Redundant z `.vscode/mcp.json` (VS Code 1.121+) i `.idea/mcp-servers.example.xml` (IntelliJ 2026.1.2+). Projekt jest Copilot-only — żaden inny host nie jest target. -12 LoC + jeden plik.
- **`_resetCache` re-export jako `_resetRenderCache`** w `src/cdk/core/index.ts` — dead export, spec testy importują z `./render.js` bezpośrednio. -1 line.

### Changed (szóste cięcie)

- **`.github/prompts/audit-sandbox.prompt.md`** — przepisany pod obecny `assertWithinSandbox` helper. Usunięty manual prefix-check code sample (nieaktualny po dodaniu wspólnego helpera w Etapie A).
- **`.github/prompts/new-tool.prompt.md`** + **`docs/how-to/add-tool.md`** — odsyłanie do usuniętego `docs/reference/tools.md` (zmerged do README w 3. cięciu) → tabela `Narzędzia` w README.

### Removed (siódme cięcie)

Test-only / dead-internal surface, plus dokumentacja duplikatu:

- **`SessionTracker.reset()`** + **`SessionTracker.size()`** + 2 odpowiadające spec testy — metody używane wyłącznie przez własne testy (`server.ts` nie woła). `size()` był nawet oznaczony jako "Test hook" w kodzie. -12 LoC + 2 testy.
- **`newCorrelationId` export** + 2 spec testy — funkcja używana tylko wewnętrznie w `correlationIdFromMeta`. Inline'owana jako `randomUUID()` w jedynym callsite. Spec testy dla correlationIdFromMeta nadal pokrywają zachowanie. -10 LoC + 2 testy.

### Changed (siódme cięcie)

- **`docs/troubleshooting.md`** — usunięte 2 entries (`SSRF guard`, `HTTPS_PROXY undici`) dotyczące forward-looking network toola (zero outbound HTTP w v0.3.0). Zastąpione 1 referencyjnym entry linkującym do `corporate-proxy.md`. -7 LoC.
- **`docs/reference/configuration.md`** — sekcja "Intranet / network" z 6-row tabelą env vars usunięta. Treść była duplikatem z `docs/how-to/corporate-proxy.md`. Zastąpiona 2-linijkowym linkiem. -11 LoC.

### Removed (ósme cięcie)

Stale references + duplicate boilerplate + dead CI step:

- **`.github/PULL_REQUEST_TEMPLATE.md`**: link `docs/adr/` (cały katalog usunięty w 3. cięciu) + sekcja `## Type` (8-row checkbox list) duplikująca conventional-commit type w HTML header. -10 LoC.
- **`.github/workflows/ci.yml`**: `actions/upload-artifact@v4` upload dist/ — żaden downstream job ani release flow nie consumuje. -4 LoC.
- **`templates/prompt.md.hbs`**: sekcja "## Notatki dla agenta" (10 LoC static boilerplate w każdym generated prompcie). Te zasady (`Determinizm`/`Sandbox FS`/`Token budget`) żyją w `.github/instructions/` które Copilot loaduje per session — duplikat w każdym prompcie był overhead. -10 LoC z template × każdy generated prompt.

### Removed (dziewiąte cięcie)

Doc slim — zero runtime change:

- **`docs/explanation/sdd-architecture.md`**: cut sekcje 11 (Open Questions Q1-Q9, zaakceptowane w poprzednich rundach), 12 (Risks dla Faza 2, regenerujemy gdy zaczynamy implementację), 13 (Acceptance criteria history — live w CHANGELOG i Section 0 Status). Zastąpione 4-linijkowym "Faza 2 entry criteria". -28 LoC.
- **`docs/how-to/corporate-proxy.md`**: cut sekcje "Setup — Windows / macOS / .vscode" (standardowe Node env var setup, dokumentacja per OS poza scope), cut "SSRF guard" + "Troubleshooting" tabela (dla future network tool, redundant z mcp-alm spec). Zostały: TL;DR, wzorzec referencyjny, env vars table, checklist. -50 LoC.

### Fixed + Removed (dziesiąte cięcie)

Dead references po wcześniejszych cięciach + duplicate Definition of Done:

- **`.vscode/settings.json`**: fix link `principles.instructions.md` → `core.instructions.md` (principles był usunięty w Etap 3 — 5 instructions cięte, plik nie istnieje od pierwszego audytu). Cut `chat.modeFilesLocations: ".github/chatmodes"` (directory nie istnieje, usunięte w Etap 3). Naprawia VS Code warnings o brakujących plikach.
- **`.github/instructions/core.instructions.md` § 4 Definition of Done** — duplikat z `.github/copilot-instructions.md` Validation gate + `CONTRIBUTING.md` DoD. Cut z core (zostaje w 2 innych). Sekcja 5 "Komentarze" przenumerowana na 4. -10 LoC.

### Removed (jedenaste cięcie)

Doc forward-planning + boilerplate:

- **`docs/explanation/sdd-architecture.md`**: cut sekcje 6 (Nowe MCP tools dla Faza 2 — tabela 6 toolów z input/output, regenerujemy gdy zaczynamy), 7 (Compile pipeline ASCII flow — duplikat `src/cdk/core/app.ts emit()`), 8 (Runtime pipeline ASCII flow — duplikat `src/cli/mcp-devtools-cdk.ts`), 9 (Folder layout — duplikat actual filesystem, plus Faza 2/3 forward-looking entries), 10 (Decisions log alternatyw — historical reasoning żyje w git log + CHANGELOG). Z 339 → 181 LoC. **-158 LoC**.
- **`docs/troubleshooting.md`**: cut sekcja "Install / build" (2 entries — `npm ci out of sync` + `Husky hooks nie uruchamiają` — standard Node devops boilerplate), cut "Last resort" (3-step `rm -rf node_modules; npm ci; npm run verify` boilerplate). -16 LoC.

### Removed (dwunaste cięcie)

Code-sample duplicates + boilerplate sections w CONTRIBUTING:

- **`docs/explanation/sdd-architecture.md`** Sekcja 4 — 4 TS code snippets (Construct/Workflow/App/SynthStep) duplikowały odpowiadające pliki w `src/cdk/core/`. Zastąpione 4-bulletową listą z linkami do source. Sekcja 5 — tabela 9 Constructs forward-planning dla Fazy 2 (regenerujemy gdy zaczynamy). Z 181 → 91 LoC. **-90 LoC**.
- **`CONTRIBIUTING.md`** — cut "Pierwsze uruchomienie" (duplikat README Quickstart), "Daily commands" (duplikat package.json scripts), "Kluczowe" (duplikat `.github/instructions/`), "Testing" (duplikat tool-contract instructions), "Definition of Done" (duplikat copilot-instructions Validation gate), pełna sekcja "Conventional Commits" sprowadzona do 1 linii TL;DR. Z 93 → 31 LoC. **-62 LoC**.

### Removed (trzynaste cięcie)

Cross-file duplicates:

- **`docs/getting-started/quickstart.md`** całkowicie cut — 41 LoC duplikat README.md §Quickstart + §IDE setup. `docs/README.md` zaktualizowane: link do README#quickstart. Każda treść kwadrans-startu żyje w README, navigation entry preserved.
- **`SECURITY.md`**: cut sekcja "Sekrety" (forward-looking — server v0.3.0 nie ma upstream auth, gdy doda się connector wymagający sekretu, dokumentacja powstanie świeża) + cut "Co trafia do repo" (3-bullet boilerplate co jest w `.gitignore` — dokumentacja `.gitignore`). Z 73 → 57 LoC. **-16 LoC**.
- **`README.md`** sekcja "Intranet posture" — duplikat z `SECURITY.md` §"Intranet posture". Cut z README. -5 LoC.

### Removed

- **pnpm** — `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tools/scripts/preinstall.mjs`, all `pnpm exec` usages.
- **commitlint** stack — `@commitlint/*`, `commitizen`, `cz-conventional-changelog`, `commitlint.config.mjs`, `.husky/commit-msg`. Conventional commit format jest konwencją; nie jest enforced hookiem.
- **Trinity vestiges** — `.github/architecture.md`, `tools/scripts/check-rule-citations.mjs`, `tools/scripts/feature-versions.mjs`, `tools/scripts/llm-call.mjs` (Anthropic SDK), trinity references w README/CONTRIBUTING/copilot-instructions.
- **`read_docs` tool** + spec — `context7` MCP serwer (wpinany przez user-level config Copilot Chat) robi to lepiej. Allowlist hostów + `ALLOWED_FETCH_HOSTS` znika.
- **`src/shared/user-config.ts`** + `config.example.json` — dead code (sentry/tavily/aiStudio nie konsumowane).
- **`src/shared/json-schema.ts`** — niewywoływany re-export.
- **`AGENTS.md`**, **`PLAN.md`** — meta-pliki bez load-bearing'u.
- **`.github/chatmodes/`** (7 plików), **16 z 18 promptów** (zostaje `new-tool` + `audit-sandbox`).
- **5 instructions** (`principles`, `production-readiness`, `language`, `llm-optimization`, `devtools`) — overflow z `ai-studio`.
- **`tools/scripts/`** — cały katalog (8 skryptów: bootstrap, preinstall, llm-call, validate-ai-config, check-rule-citations, feature-versions, usage-report, gen-tools-docs).
- **`docs/`** drastically slim'd — usunięte `projects/`, `analytical/`, `bpmn/`, `programming/`, `explanation/`, `architecture/`, `ai-workflow/`, `reference/api/`, `reference/tools/`, ADR-0004 (network-allowlist).
- **`@anthropic-ai/sdk`** wszystkie refs.
- **dev deps**: `eslint-plugin-{jsdoc,sonarjs,unicorn}`, `markdownlint-cli2`, `typedoc`, `typedoc-plugin-markdown`, `lychee` (cargo).
- **`.github/workflows/*.disabled`** (4 pliki).

### Added

- **`http-client.ts` intranet posture** — SSRF guard (`MCP_DEVTOOLS_ALLOW_PRIVATE_HOSTS` opt-in), `HTTPS_PROXY` / `NO_PROXY` / `ALL_PROXY` (lazy undici.ProxyAgent), `NODE_EXTRA_CA_CERTS` natively, identifying headers, 50 MB body cap. **Bez auth/ETag/dedup** (devtools nie potrzebuje per-server auth). No current callsite — pattern dla przyszłych connectorów.
- **`.vscode/mcp.json`** — natywny VS Code 1.121+ registry. Rejestruje `devtools` + 5× `alm-*` (mcp-alm sibling repo).
- **`.idea/mcp-servers.example.xml`** — IntelliJ 2026.1.2+ template.
- **`docs/getting-started/{vscode,intellij}-setup.md`**.
- **`docs/how-to/corporate-proxy.md`** — runbook intranet env vars + przykład integracji.
- **`.github/workflows/ci.yml`** + **`security.yml`** — aktywne (zastępują `.disabled`).
- **`docs/reference/tools.md`** — ręcznie utrzymywany.

### Changed

- **`run_playwright`** — `pnpm exec playwright` → `npx playwright` (Windows: `npx.cmd`). **Sandbox**: `project_root` musi resolwować się pod `ctx.projectRoot`; reject path traversal.
- **`compliance_report`** — `pattern:` z YAML capped at 200 chars (ReDoS defence).
- **`server.ts`** — usunięty `ALLOWED_FETCH_HOSTS`, `ctx.fetch`, import `read-docs`. 5 tooli (było 6).
- **`ToolContext`** — usunięte pole `fetch`.
- **`eslint.config.mjs`** — wyłącznie `@typescript-eslint` strict + `prettier`. 121 → ~40 linii.
- **`package.json`** — wersja 0.3.0, brak `packageManager` pin, brak `engines.pnpm`, brak `preinstall` script.
- **`.husky/pre-commit`** — `pnpm exec lint-staged` → `npx --no-install lint-staged`.

### Security

- Outbound HTTP w runtime: 3 hosty publiczne → **0** (pełna izolacja sieciowa).
- Path traversal w `run_playwright`: możliwa → blokowana.
- ReDoS w `compliance_report`: brak limitu → cap 200 chars.
- Memory MCP (`@modelcontextprotocol/server-memory@latest`) usunięty z `.mcp.json` — npx-launched servers nie nadają się do zamkniętego intranetu.

## [0.2.0] — 2026-05-22

### Changed

- Merged `.ai/` into `.github/` — single SoT dla Copilot.
- `pnpm verify` no longer runs `trinity:check` — repo standalone.

### Removed

- `.ai/` directory, `tools/scripts/check-trinity.mjs`, `pnpm trinity:check` script.

## [0.1.0] — 2026-05-22

Initial fork from `ai-mcp-devtools`.

### Removed

- ACP transport, AHP transport, Claude Code surface, memory store.
- Release-please workflow.

### Added

- `http-client.ts` (allowlist-aware, 5 identifying headers).
- `correlation.ts`, `response-meta.ts`, `session-tracker.ts`, `version.ts`, `json-schema.ts` — port z mcp-alm.
- `mcp-devtools.get_usage_history` tool.
- `compactJson` na każdej tool response.

### Changed

- Binary: `ai-mcp-devtools` → `mcp-devtools`.
