---
applyTo: '**'
description: Zasady inżynierskie — DRY, SOLID, KISS, YAGNI, kompozycja nad dziedziczeniem
---

# Zasady inżynierskie

**Złote reguły** — meta-reguły, gdy agent nie ma pewności. Nie zastępują reguł zakresowych (security, tool-contract).

## 1. DRY

Każda istotna wiedza w jednym miejscu. Duplikacja = manual sync; pierwszy zapomniany sync = bug.

- Zod schemas deklarowane raz, importowane.
- Stałe (timeouty, budżety, limity) w `src/shared/` jako exported named constants.
- `description` MCP tooli: jedna canonical fraza, nie powielana w docs.

**Rule of three:** pierwsza duplikacja OK, druga podejrzana, trzecia ekstrahuje helper.

## 2. SOLID

- **SRP** — jedna funkcja / moduł, jeden powód do zmiany. `sandbox.ts` = walidacja ścieżek (nie analizuje kodu). `analyze-code.ts` = static analysis (nie spawn). `run-playwright.ts` = spawn (nie parsuje TS).
- **OCP** — nowy tool = nowy plik w `src/tools/` + rejestracja w `server.ts`, nie edycja istniejących.
- **DIP** — handler nie wie o transporcie MCP. `defineTool({ handle(input) })`, kompozycja w `server.ts`.

## 3. KISS

Jeśli wymaga wyjaśnienia, za skomplikowane. Brak Builder gdy obiekt literałowy. Brak Factory gdy `new Cls(...)`. Sandbox = jeden `resolve()` + prefix compare, nie biblioteka.

## 4. YAGNI

Pierwsza implementacja najprostsza. Druga wymusi refactor — wtedy abstrakcja powstaje z prawdziwym kontekstem.

## 5. Composition over inheritance

Narzędzia to funkcje, nie subklasy `BaseTool`. `analyze-code.ts` komponuje `walkFiles → countLines → findPatterns` (każdy kawałek osobno testable).

## 6. Fail fast, fail loud

- Zod walidacja na granicy każdego toola.
- Sandbox odrzuca path traversal w pierwszej linii handlera.
- Brak silent `null` coerce na defaulty — ujawnij brakujący input.

## 7. Convention over configuration

- Pliki: `kebab-case`.
- Tool naming: `verb_noun` (`analyze_code`, `run_playwright`).
- Jeden plik = jedno narzędzie: `src/tools/<tool>.ts` + `<tool>.spec.ts`.
- Commits: Conventional Commits.

## 8. Reversibility

Jeden concern per PR. ADR dla decyzji trudnych do odwrócenia.

## 9. Kod czytany więcej niż pisany

Nazwy zamiast komentarzy. Explicit types na granicach API.

## 10. Wrap external dependencies

Każde `spawnSync` / `execFile` / system call żyje za wrapperem w `src/shared/`, nigdy bezpośrednio w handlerze.

## Jak agenci to stosują

Dwa podejścia spełniają spec → wybór bliższy zasadom, notuj trade-off w hand-off. Code reviewer cytuje **id zasady** (`SRP`, `KISS`) przy odrzucaniu.

## Zobacz też

[`core.instructions.md`](core.instructions.md) · [`security.instructions.md`](security.instructions.md) · [`tool-contract.instructions.md`](tool-contract.instructions.md)
