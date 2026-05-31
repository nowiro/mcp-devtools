# Changelog

Ten plik opisuje **stan as-is** bieżącej wersji pakietu. Pełna historia zmian → `git log`.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · [SemVer](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — `@nowiro/mcp-devtools` (as-is)

Jeden serwer MCP (stdio) z narzędziami dev-workflow, **cross-platform** (Windows / macOS / Linux),
**sandbox** (`PROJECT_ROOT`), **offline** (zero outbound HTTP). Klient: GitHub Copilot
(VS Code ≥ 1.121, IntelliJ ≥ 2026.1.2, Eclipse od 2026-05). Node ≥ 22, ESM, MIT.

### Narzędzia (5)

- `analyze_code` — statyczna analiza TS / TSX / JS / JSX / HTML / Vue (Angular / React / Vue auto-detect), mtime-cached.
- `propose_fix` — pakiet kontekstu bug-fix (fault-line slicing) dla LLM.
- `run_playwright` — Playwright w sandboxie (cross-platform spawn `npx.cmd` / `npx`).
- `compliance_report` — scoring repo vs YAML standards (JSON / SARIF; ReDoS-capped pattern).
- `mcp-devtools.get_usage_history` — in-memory session ledger.

### SDD + CDK

- Pipeline per-tool: `/new-tool → /clarify → /analyze → /implement`, bramka `validate-sdd` (`sdd:check` w `verify`).
- CDK (Construct / Workflow / App + `npm run cdk:compile` → `.github/prompts/*.md`) — Faza 1 done; Faza 2 TBD.

### Konfiguracja Copilot

- `orchestrator` (jedyny widoczny) + 7 subagentów; 8 instructions (auto per `applyTo`).
- Prompty: `/new-tool`, `/audit-sandbox`, `/diagnose`, `/release`, `/security-review`, `/sdd-demo`, `/clarify`, `/analyze`, `/refine`.
- Skille (read-first): `analyze-code-triage`, `propose-fix`, `playwright-sanity` + lint „description = routing rule" w `ai:validate`.
- MCP Resources (catalog findingów / compliance-rules / propose-fix guide).

### Tooling i dystrybucja

- `npm run verify` = format · lint · typecheck · test · build · ai:validate · validate:inputs · sdd:check. Plus `doctor`, `bootstrap`, scaffoldery `workflow:*`, `token:budget`.
- Husky: pre-commit (lint-staged) + commit-msg (commitlint). **Brak GitHub Actions** — publish ręczny (`npm publish --provenance`), verify lokalnie.
