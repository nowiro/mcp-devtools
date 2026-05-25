# SDD framework architecture

> Live design document. Status fazy w sekcji 0.

## 0. Status (live)

- **Faza 0** ✅ done. Decision doc + sketches reviewed and accepted. Sketches
  (`src/cdk/workflows/scaffold-app.workflow.ts`, `src/cdk/constructs/stubs.ts`,
  `.github/prompts/sdd-scaffold-app.prompt.md`) usunięte z drzewa po akceptacji —
  treść w git history pod tagiem Faza 0.
- **Faza 1** ✅ done. Core CDK (`Construct` / `Workflow` / `App` / synth / render /
  validate) + demo workflow + CLI. End-to-end compile działa
  (`npm run cdk:compile`). Pokryte testami (198 passed).
- **Faza 2** ⏳ TBD. 9 real Constructs + 6 nowych MCP tools dla Workflow #1.
- **Faza 3** ⏳ TBD. Pełen scaffold-app E2E (Confluence/MD → Nx workspace).

## 1. Cel

Wystawić Copilot Chatowi (VS Code 1.121+ / IntelliJ 2026.1.2+) **6 powtarzalnych
workflow-ów SDD**, sterowanych przez TypeScript "CDK" w stylu AWS CDK (Construct
graph compiluje się do execution recipe), z templates Handlebars dla
deterministycznych artefaktów.

### Workflow-y w scope

| #   | Workflow                       | Trigger                    | Output                                        |
| --- | ------------------------------ | -------------------------- | --------------------------------------------- |
| 1   | **Scaffold aplikacji**         | Confluence / MD / git repo | Nx+Angular≥21+Vitest+Playwright workspace     |
| 2   | **Update aplikacji + procesu** | Jira ticket                | PR/MR z aktualizacją                          |
| 3   | **Bug-fix #1/#2**              | Failing test / bug ticket  | PR/MR z fixem                                 |
| 4   | **Doc generation**             | Code path / feature        | docs biznesowe + techniczne (MD)              |
| 5   | **Test scenarios**             | Spec MD                    | Vitest unit + Playwright e2e                  |
| 6   | **PR/MR review**               | GitLab/GitHub MR           | Line-by-line comments postowane via `mcp-alm` |

MVP w Fazie 1-3 = **wyłącznie Workflow #1**. Workflow-y #2-#6 to incremental
add po MVP.

## 2. Decyzje (zaakceptowane przez użytkownika)

| Decyzja               | Wybór                                         | Alternatywa odrzucona                           |
| --------------------- | --------------------------------------------- | ----------------------------------------------- |
| Orkiestracja procesów | **Własny TS framework (Construct-style API)** | github/spec-kit; pure prompts                   |
| MCP boundary          | **Extend mcp-devtools**                       | Nowy sibling `mcp-sdd`; pure prompts (zero MCP) |
| Template engine       | **Handlebars**                                | EJS; native TS template literals                |
| MVP                   | **Workflow #1 (scaffold app)**                | Workflow #6 (review); Workflow #4 (docs)        |
| Start point           | **Faza 0 — decision doc + API sketch**        | Thin MVP; full plan                             |

## 3. Architektura na wysokim poziomie

```
DEV TIME (TypeScript)                  COMPILE                    RUN TIME (Copilot Chat)
─────────────────────                  ───────                    ─────────────────────────

src/cdk/workflows/                                                .github/prompts/
  scaffold-app.workflow.ts  ─────► npx mcp-devtools-cdk    ─────► sdd-scaffold-app.prompt.md
    ├─ ConfluencePage                  compile                       │
    ├─ Spec                              │                           ▼
    ├─ AngularMaterialMap                ▼                       Copilot reads
    ├─ NxScaffold              templates/prompt.md.hbs              │
    ├─ MaterialWrapper × N           (rendered with                  ▼
    ├─ Tests                          SynthStep[] from           Step-by-step:
    ├─ PlaywrightRun                  Workflow.synth())            • mcp_call → MCP tool
    └─ Publish                                                      • llm_reason → LLM thinks
                                                                    • user_input → ask user
```

**Boundary cut:**

- **CDK (TS)** — type-safe definition of _what_ + _in what order_. No I/O, no LLM
  calls. Pure synth-to-data.
- **Compile (CLI)** — `npx mcp-devtools-cdk compile` renders Handlebars template
  with synth output. Produces `.prompt.md` files.
- **Runtime (Copilot)** — reads `.prompt.md`, executes step-by-step. MCP tools
  called via `mcp-alm` + `mcp-devtools` MCP servers (already wired in
  `.vscode/mcp.json`).

## 4. CDK core API contract

Cztery abstrakcje. Detale + JSDoc → źródło:

- **`Construct`** ([`src/cdk/core/construct.ts`](../../src/cdk/core/construct.ts)) — atomic node grafu. Abstract `synth()` emituje 0+ `SynthStep`.
- **`Workflow`** ([`src/cdk/core/workflow.ts`](../../src/cdk/core/workflow.ts)) — root jednego `.prompt.md`. Posiada `description` i `trigger` (slash-command name).
- **`App`** ([`src/cdk/core/app.ts`](../../src/cdk/core/app.ts)) — kontener Workflow-ów; `emit({ outDir })` waliduje binds i pisze pliki.
- **`SynthStep`** ([`src/cdk/core/synth.ts`](../../src/cdk/core/synth.ts)) — discriminated union: `mcp_call` / `llm_reason` / `user_input`. `bind` definiuje zmienną do referencji jako `{{vars.<bind>}}` w późniejszych stepach.

## 5. Faza 2 entry criteria

Risks i open questions dla Fazy 2 będą odnowione gdy zaczniemy implementację —
constructs i nowe MCP tools mają inne ryzyko niż Faza 1 (subprocess management,
Angular Material API drift, etc.). Status fazy w sekcji 0. Acceptance history
w `CHANGELOG.md`.
