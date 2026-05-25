---
applyTo: '**'
description: Core engineering principles — DRY, SOLID, KISS, YAGNI, Boy Scout
---

# Core principles

## 1. Truth over speed

- Czytaj kod zanim go opiszesz.
- Cytuj plik:linię gdy odwołujesz się do konkretnego miejsca.
- Nie zgaduj wersji pakietu / nazwy funkcji / ścieżki.

## 2. Smallest reasonable change

- Jeden cel na PR.
- Nie miksuj refactoru z fix'em; nie miksuj formatu z behaviour'em.
- Brak "po drodze" cleanup'ów które nie wynikają z zadania.

## 3. Sześć zasad

- **DRY** — duplikat ≠ konwencja; szukaj wzorca dopiero przy trzecim wystąpieniu.
- **KISS** — najprostsza rzecz, która działa. Brak "smart" rozwiązań bez user-visible benefit.
- **YAGNI** — buduj dla potrzeby która JEST, nie która MOŻE BYĆ.
- **SOLID** (light) — Single Responsibility i Dependency Inversion liczą się najbardziej w MCP toolach.
- **Boy Scout** — zostaw kod ciut czystszy niż go zastałeś, ale nie poza scope'em.
- **Fail fast** — waliduj na granicy (Zod input), throw na invariant violation, nie zwracaj `null` z "może się uda".

## 4. Komentarze

- Default: nie pisz komentarzy.
- Wyjątek: nieoczywiste WHY (workaround dla buga upstream, ukryty constraint, subtelna inwariantka).
- Nigdy: WHAT już opisany przez nazwę funkcji/zmiennej.
- Nigdy: referencje do bieżącego ticketu/PR — to żyje w git log.
