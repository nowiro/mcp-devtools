# .github/skills/ — Copilot Agent Skills

> **Status: active.** Agent Skills to stabilna funkcja GitHub Copilota (VS Code agent mode,
> Copilot CLI, cloud agent), oparta o otwarty standard [agentskills.io](https://agentskills.io).
> Ten katalog jest **auto-discovered** przez Copilota — każdy podkatalog `<name>/SKILL.md`
> to jeden skill. Nie trzeba żadnego ustawienia w `.vscode/settings.json`.

## Czym jest skill (i jak ma się do prompt / agent / instruction)

Skill = folder z instrukcją (i opcjonalnie skryptami/zasobami), który **Copilot sam ładuje
gdy uzna za potrzebne** — na podstawie pola `description`. Działa _progressive disclosure_:
metadata zawsze w kontekście, treść `SKILL.md` dopiero przy dopasowaniu do zadania, a dodatkowe
pliki dopiero gdy instrukcja je zreferencjonuje. Dzięki temu wiele skilli nie zapycha okna kontekstu.

| Katalog                                  | Cel                                             | Wywołanie         | Status    |
| ---------------------------------------- | ----------------------------------------------- | ----------------- | --------- |
| `.github/prompts/*.prompt.md`            | Slash-commands (`/release`, `/diagnose`)        | ręczne `/<name>`  | **Used**  |
| `.github/agents/*.agent.md`              | Wewnętrzne persony ładowane przez orchestrator  | przez chatmode    | **Used**  |
| `.github/chatmodes/*.chatmode.md`        | Tryby widoczne w VS Code mode pickerze          | dropdown          | **Used**  |
| `.github/instructions/*.instructions.md` | Auto-applied rules (`applyTo: <glob>`)          | automat per glob  | **Used**  |
| `.github/copilot-instructions.md`        | Repo-wide instrukcje top-priority               | każda sesja       | **Used**  |
| **`.github/skills/<name>/SKILL.md`**     | Reusable, parametric task; model decyduje kiedy | **model-decided** | **Ready** |

Reguła rozdziału **prompt vs skill**:

- **prompt** — single-shot, użytkownik świadomie wpisuje `/<name>` (np. `release`, `diagnose`).
- **skill** — model sam sięga, gdy `description` pasuje do zadania; może dołączać bundled skrypty.

## Format (stable — agentskills.io)

Każdy skill to **folder**, a nie pojedynczy plik:

```
.github/skills/
  <skill-name>/
    SKILL.md          # wymagany
    scripts/          # opcjonalnie (np. .mjs wołane z instrukcji)
    examples/         # opcjonalnie
```

`SKILL.md` to Markdown z YAML frontmatter:

```markdown
---
name: analyze-code-triage
description: Triage findings from the analyze_code MCP tool and group them by severity. Use when the user asks to review or prioritise static-analysis output.
---

# Treść — kroki, przykłady, referencje do scripts/…
```

Reguły formatu:

- Wymagane pola: `name` + `description`.
- `name` **musi** równać się nazwie folderu; dozwolone `a-z`, `0-9`, `-`; maks. 64 znaki.
- `description` ≤ 1024 znaki — to ono decyduje o auto-matchowaniu, więc opisz **co** robi i **kiedy** użyć (po angielsku, zgodnie z language policy dla opisów konsumowanych przez tooling).
- Auto-discovery z `.github/skills/` — **bez** żadnego settingu. (Dodatkowe lokalizacje: `chat.agentSkillsLocations`; dziedziczenie z parent repo: `chat.useCustomizationsInParentRepositories`.)
- Otwarty standard — `SKILL.md` z `.claude/skills/` można 1:1 skopiować lub symlinkować tutaj.

Walidacja: `npm run ai:validate` sprawdza obecność `name`/`description`, regułę `name == folder`
oraz to, że skille leżą w podkatalogach (nie luzem jako flat `*.md`). Logika w
[`tools/scripts/validate-ai-config.mjs`](../../tools/scripts/validate-ai-config.mjs), sekcja 6.

## Stan w tym repo

Dziś: **brak skilli** — katalog zawiera tylko ten README. Kandydaci do portu z `.github/prompts/`
→ skill (reusable, model-decided, mogą wołać skrypty), gdy zdecydujemy się ruszyć:

- **analyze-code triage** — interpretacja outputu `analyze_code` (severity grouping, framework hints).
- **propose-fix workflow** — przygotowanie kontekstu pod `propose_fix` + sandbox guardrails.
- **playwright sanity** — szybki run end-to-end (parytet z krokiem z `/sdd-demo`).

Powiązanie z SDD/CDK: w Fazie 2 ([`docs/explanation/sdd-architecture.md`](../explanation/sdd-architecture.md))
warto rozważyć dodatkowy target kompilacji `npx mcp-devtools-cdk compile` → `SKILL.md` (obok/zamiast
`.prompt.md`). spec-kit poszedł dokładnie tą drogą (`--integration-options="--skills"`), a
`SKILL.md` (model-decided + bundled scripts) lepiej pasuje do Construct-graph workflow-ów niż
ręcznie wołany `.prompt.md`.

## Historia decyzji

- Wcześniej ten katalog był **placeholderem** „czekamy na stable spec GitHuba; nie wymyślaj formatu".
- Spec jest stabilny: GitHub Copilot ogłosił Agent Skills 2025-12-18, wsparcie `SKILL.md` w VS Code
  (agent mode) ustabilizowane ~2026-04. README zaktualizowane **2026-05-29** — placeholder → active.
- Najwcześniejszy sygnał (zachowany dla kontekstu): spec-kit 0.8.12 provisioning `.github/skills/`.

## Źródła

- [VS Code — Use Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [GitHub Docs — About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
- [Changelog — Copilot now supports Agent Skills (2025-12-18)](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/)
