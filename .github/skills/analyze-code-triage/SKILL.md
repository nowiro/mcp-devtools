---
name: analyze-code-triage
description: Triage static-analysis findings from the mcp-devtools analyze_code tool — group by severity/kind, summarise framework metrics, and propose a fix order. Use when the user asks to review, prioritise, or decide "what to fix first" in a TS/JS/Angular/React/Vue tree.
---

# analyze-code-triage

Bierze surowy output `analyze_code` i zamienia go w **uporządkowany triage**: co naprawić najpierw,
pogrupowane wg severity i rodzaju. Read-only — nie modyfikuje plików.

## Kiedy się uruchamia

Gdy user prosi o przegląd / priorytetyzację jakości kodu w drzewie TS/JS/Angular/React/Vue
("przejrzyj findingi", "co naprawić najpierw", "zrób triage tego modułu").

## Wejście

- `path` — katalog lub plik do analizy (wymagany; w obrębie sandboxa `PROJECT_ROOT`).
- (opcjonalnie) `framework` — gdy auto-detekcja ma być nadpisana; domyślnie `auto`.

## Procedura

1. **Wywołaj `analyze_code`** z `{ path, depth, metrics: true, framework: "auto" }`. Dla dużych drzew
   zacznij od `depth: 2` i zwiększaj tylko w razie potrzeby (tool jest O(files × depth), cap `depth: 5`).
2. **Pogrupuj `findings`** po `severity` (`error` → `warning` → `info`), w obrębie severity po `kind`
   (`legacy-pattern`, `dangerous-html`, `console-log`, `todo`).
3. **Ustal priorytet** — najpierw `error` (np. Angular legacy `*ngIf`/`*ngFor` → `@if`/`@for`,
   `dangerouslySetInnerHTML`), potem `warning` (`console.*`), na końcu `info` (`todo`).
4. **Podsumuj metryki** — `files_scanned`, `total_lines`, oraz framework-specific (np. ile `signal()`
   vs legacy patterny; class components vs function components).
5. **Zaproponuj kolejność naprawy** — top 3–5 pozycji z `file:line` i jednozdaniowym „dlaczego".

Znaczenie poszczególnych `kind`/`severity` → resource `mcp-devtools://docs/analyze-findings-catalog`.

## Format odpowiedzi

1. **Nagłówek** — wykryty `framework` + skala (`files_scanned`, `total_lines`, `cache_hit`).
2. **Findings** pogrupowane: severity | kind | count | przykłady `file:line`.
3. **Fix order** — ponumerowana lista top pozycji z uzasadnieniem.
4. (opcjonalnie) „Chcesz, żebym odpalił `propose_fix` dla #1?"

## Czego NIE robić

- Nie edytuj plików — to triage. Zmiany idą osobno (`propose_fix` lub ręcznie).
- Nie wywołuj `analyze_code` poza `PROJECT_ROOT` — sandbox to odrzuci.
- Nie raportuj findingów bez `file:line` — bez lokalizacji są bezużyteczne.
