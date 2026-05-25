---
applyTo: '**'
description: Zasady inżynierskie — DRY, SOLID, KISS, YAGNI, kompozycja nad dziedziczeniem
---

# Zasady inżynierskie

To **złote reguły**, na których opiera się każdy agent i kontrybutor gdy
nie ma pewności. Siedzą obok [`core.instructions.md`](core.instructions.md)
na szczycie łańcucha priorytetu. Nie zastępują reguł zakresowych
(security, tool-contract) — są meta-regułami, które te reguły wcielają.

## 1. DRY — Don't Repeat Yourself

Każda istotna wiedza ma żyć w jednym miejscu w systemie. Duplikacja
wymusza, że każda zmiana musi być zsynchronizowana ręcznie — pierwszy
zapomniany sync to bug.

- Reguły walidacji (Zod schemas) deklarowane raz, importowane.
- Stałe (timeouty, budżety, limity) w `src/shared/` jako exportowane
  named constants, nie inline.
- Treści `description` narzędzi MCP: jedna canonical fraza per narzędzie,
  nie powielana w docs.

**Wyjątek:** _Rule of three_. Pierwsza duplikacja jest OK. Druga jest
podejrzana. Trzecia ekstrahuje wspólny helper.

## 2. SOLID

### SRP — Single Responsibility

Jedna funkcja / klasa / moduł ma jeden powód do zmiany.

- `src/shared/sandbox.ts` — walidacja ścieżek (sandbox enforcement). Nie analizuje kodu.
- `src/tools/analyze-code.ts` — statyczna analiza. Nie uruchamia procesów.
- `src/tools/run-playwright.ts` — spawn procesu. Nie parsuje TS.

### OCP — Open / Closed

Moduły otwarte na rozszerzenia, zamknięte na modyfikacje. Dodanie nowego
narzędzia to dodanie pliku w `src/tools/` + rejestracja w `src/server.ts`,
nie edycja istniejących handlerów.

### DIP — Dependency Inversion

Handler narzędzia nie wie o transporcie MCP. `defineTool` przyjmuje
`handle(input)` — kompozycja w `server.ts`.

## 3. KISS — Keep It Simple, Stupid

Jeśli rozwiązanie potrzebuje wyjaśnienia, jest za skomplikowane.

- Brak wzorca _Builder_ tam, gdzie wystarczy obiekt literałowy.
- Brak _Factory_ tam, gdzie wystarczy `new Cls(...)`.
- Sandbox to jeden `resolve()` + porównanie prefix — nie biblioteka.

## 4. YAGNI — You Aren't Gonna Need It

Nie buduj abstrakcji "na zapas". Pierwsza implementacja jest najprostsza.
Druga wymusi refactor — i właśnie wtedy abstrakcja powstaje z prawdziwym
kontekstem.

## 5. Composition over inheritance

Większość problemów daje się rozwiązać kompozycją funkcji.

- Narzędzia to funkcje, nie subklasy abstrakcyjnego `BaseTool`.
- `analyze-code.ts` komponuje `walkFiles → countLines → findPatterns` —
  każdy kawałek testowalny niezależnie.

## 6. Fail fast, fail loud

Błędy na granicy, nie głęboko w kodzie.

- Każdy input jest walidowany przez Zod na granicy toola.
- Sandbox odrzuca path traversal w pierwszej linii handlera.
- Nie coerce po cichu `null` na defaulty — ujaw brakujący input.

## 7. Convention over configuration

- Nazwy plików: `kebab-case`.
- Nazwy narzędzi MCP: `verb_noun` (np. `analyze_code`, `run_playwright`).
- Jeden plik = jedno narzędzie: `src/tools/<tool>.ts` + `src/tools/<tool>.spec.ts`.
- Commits: Conventional Commits.

## 8. Reversibility — małe, bezpieczne kroki

Duże zmiany są straszne. Wiele małych zmian to rutyna.

- Jeden concern na PR. Reviewable w jednym posiedzeniu.
- ADR dla decyzji trudnych do odwrócenia.

## 9. Kod jest czytany więcej niż pisany

- Nazwy zamiast komentarzy.
- Explicit types zamiast inferred na granicach API.

## 10. Wrap external dependencies

Każde `spawnSync` / `execFile` / system call żyje za wrapperem
w `src/shared/`, nie bezpośrednio w handlerze narzędzia.

## Jak agenci to stosują

Gdy dwa konkurujące podejścia spełniają immediate spec, agent wybiera
to bliższe tym zasadom i notuje trade-off w swoim hand-off bloku.
Code reviewer cytuje **id zasady** (np. _SRP_, _KISS_) przy odrzucaniu.

## Zobacz też

- [`core.instructions.md`](core.instructions.md) — nienegocjowalne cross-cutting reguły.
- [`security.instructions.md`](security.instructions.md) — reguły bezpieczeństwa.
- [`tool-contract.instructions.md`](tool-contract.instructions.md) — kontrakt każdego toola.
