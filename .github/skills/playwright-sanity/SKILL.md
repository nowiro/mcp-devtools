---
name: playwright-sanity
description: Run a fast, scoped Playwright sanity check on the target project via the run_playwright MCP tool and parse pass/fail/flaky from the reporter. Use when the user asks to run e2e/Playwright tests, do a quick smoke or sanity check, or verify a change end-to-end (e.g. "run the e2e tests", "quick sanity run"). Expensive — spawns a real browser; always scope with grep and a timeout.
---

# playwright-sanity

Odpala **szybki, zawężony** sanity-run Playwrighta przez tool `run_playwright` i parsuje
pass/fail/flaky z reportera. Drogi tool — spawnuje prawdziwą przeglądarkę — więc domyślnie
zawężaj zakres przez `grep`, nie puszczaj całego suite.

## Kiedy się uruchamia

Gdy user prosi o uruchomienie testów e2e/Playwright, szybki smoke/sanity albo weryfikację
zmiany end-to-end ("odpal e2e", "zrób szybki sanity run", "sprawdź czy to działa w przeglądarce").

## Wejście

- `project_root` — katalog projektu z testami (domyślnie `.`; w obrębie sandboxa).
- `grep` — wzorzec zawężający (mocno zalecane — bez niego leci cały suite).
- `reporter` — `json` | `junit` | `list` | `line`; **preferuj `json` lub `junit`** (parsowalne staty).
- `timeout_ms` — domyślnie 120000, max 600000.
- `headed` — domyślnie `false` (CI/headless).
- `shard` — `"i/N"` dla równoległości (opcjonalnie).

## Procedura

1. **Zawęź `grep`** do tego, co realnie chcesz sprawdzić — pełny suite jest drogi (browser spawn).
2. **Ustaw `reporter: "json"`** (albo `"junit"`) i rozsądny `timeout_ms`.
3. **`run_playwright`** — uruchom i zbierz `pass`/`fail`/`flaky`, `trace_path`, `exit_code`.
4. **Przy `fail`/`flaky`** — przekaż output do skilla `propose-fix` (jako `failure_text`),
   żeby zdiagnozować pierwszą przyczynę.

## Format odpowiedzi

1. **Wynik** — `pass` / `fail` / `flaky` (liczby) + `exit_code`.
2. **Trace** — `trace_path` (jeśli jest), do podglądu nieudanych przebiegów.
3. **Top failures** — nazwa testu + 1-zdaniowy powód (jeśli reporter je dał).
4. **Rekomendacja** — proceed / fix-first; przy fix-first zaproponuj `propose-fix`.

## Czego NIE robić

- **Nie odpalaj** pełnego suite bez `grep` domyślnie — to drogie (spawn przeglądarki na test).
- Nie przekraczaj `timeout_ms` 600000 (cap) — długie runy świadczą zwykle o złym scope, nie o potrzebie.
- Nie wychodź poza `project_root` (sandbox) i nie zakładaj zainstalowanych przeglądarek bez `npx playwright install`.
