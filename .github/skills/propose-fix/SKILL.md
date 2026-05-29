---
name: propose-fix
description: Assemble a tight bug-fix context bundle (failing test, source slices around the fault lines, and coding rules) via the propose_fix MCP tool, then reason out the smallest fix. Use when the user has a failing test or a stack trace and asks why it fails or how to fix it (e.g. "this test is red", "fix this error"). Gathers context only — stays inside the PROJECT_ROOT sandbox and does not edit files itself.
---

# propose-fix

Składa **ciasny pakiet kontekstu** pod naprawę buga — failujący test, wycinki źródeł wokół linii błędu
oraz reguły kodowania — przez tool `propose_fix`, a potem proponuje **najmniejszą** poprawkę. Sam nie
edytuje plików: to primitive zbierający kontekst w obrębie sandboxa `PROJECT_ROOT`.

## Kiedy się uruchamia

Gdy user ma czerwony test albo stack trace i pyta dlaczego failuje / jak naprawić
("ten test jest czerwony", "napraw ten błąd", "czemu to się wywala").

## Wejście

- `failure_text` — output błędu / stack trace (wymagane; z niego parsowane są `path:line`).
- `paths[]` i/lub `test_path` / `source_path` — co najmniej jedno (pliki do wczytania).
- `rules_paths[]` — opcjonalne pliki reguł/konwencji do uwzględnienia.
- `window` — ile linii kontekstu wokół fault location (5–200, domyślnie 25).

## Procedura

1. **`propose_fix`** z `{ paths, failure_text, rules_paths, window }`. Tool sam wytnie ±`window`
   linii wokół miejsc z `failure_text` i zwróci `context` + `hint`.
2. **Przeczytaj `context`** — `files[].excerpt`, `failure`, `rules[]`. Zlokalizuj root cause na `file:line`.
3. **Zaproponuj najmniejszą zmianę** zgodną z `rules` — konkretny diff/edycja z `file:line`,
   bez przepisywania niezwiązanych fragmentów.
4. **Zaproponuj weryfikację** — re-run przez skill `playwright-sanity` albo `npm test`.

## Format odpowiedzi

1. **Root cause** — 1–2 zdania, z `file:line`.
2. **Proponowana zmiana** — minimalny diff albo opis edycji per `file:line`.
3. **Jak zweryfikować** — która komenda / który test potwierdzi naprawę.

## Czego NIE robić

- **Nie aplikuj** edycji po cichu — to skill proponujący. Zmianę wprowadza user lub `tool-author`.
- Nie czytaj plików **poza** `PROJECT_ROOT` — sandbox to odrzuci (`assertWithinSandbox`).
- Nie ustawiaj `window` > 200 (cap) — większy kontekst to zmarnowane tokeny, nie lepsza diagnoza.
- Nie zgaduj bez `context` — jeśli `failure_text` nie zawiera `path:line`, poproś o pełny stack trace.
