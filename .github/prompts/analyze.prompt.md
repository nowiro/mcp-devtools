---
mode: agent
description: Cross-artifact SDD consistency check — verify spec ↔ plan ↔ code agree before /implement. Runs the deterministic structural gate (npm run sdd:check), then reasons over semantic gaps. Read-only.
---

# /analyze — cross-artifact SDD consistency

Sprawdza spójność artefaktów Spec-Driven-Development **zanim** ruszy implementacja: czy `plan`
pokrywa `spec`, czy zadania są wykonalne i czy kod nie odjechał od specu. Read-only — niczego nie zmienia.

Inspiracja: spec-kit `/speckit.analyze` (cross-artifact consistency przed `/implement`).

## Krok 1 — Structural gate (deterministyczny)

Uruchom `npm run sdd:check`. Waliduje frontmatter, wymagane sekcje specu, tabelę zadań planu
i traceability (plan `new-tool.<slug>` → `docs/specs/<slug>/spec.md`). **Jeśli zwróci błędy —
zatrzymaj się i zaraportuj je**; analiza semantyczna nie ma sensu na niespójnej strukturze.

## Krok 2 — Analiza semantyczna (per spec)

Dla każdego `docs/specs/<slug>/spec.md` i jego planu `docs/plans/*-<slug>.md`:

1. **Pokrycie** — czy każde `## Acceptance criteria` ma odpowiadające zadanie w tabeli planu?
   Wskaż kryteria bez zadania **oraz** zadania bez kryterium (scope creep).
2. **Otwarte pytania** — czy w specu zostały `[?]`? Każde to ryzyko przed implementacją.
3. **Dryf kodu** — jeśli `src/tools/<slug>.ts` już istnieje, czy `Input`/`Output` (Zod) zgadzają się
   ze specem (nazwy pól, typy, granice)? Wskaż rozjazdy z `file:line`.
4. **Sprzeczności** — spec vs plan vs kod: konflikty nazw, budżetów (`tokensEstimate`, P95) lub zakresu.

## Format odpowiedzi

Tabela: `artefakt | finding | severity (blocker / major / minor) | sugestia`. Na końcu jednoznaczny
**go / no-go dla `/implement`** z jednozdaniowym uzasadnieniem.

## Czego NIE robić

- Nie modyfikuj specu / planu / kodu — to read-only analiza. Poprawki idą osobno (`/new-tool`, tool-author).
- Nie pomijaj Kroku 1 — bez zielonego `sdd:check` analiza semantyczna stoi na piasku.
- Nie wymyślaj kryteriów — pracuj na tym, co realnie jest w `docs/specs/`.
