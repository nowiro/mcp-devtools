---
mode: agent
description: Resolve open placeholders in a docs/specs spec via structured Q&A, then re-validate. The clarify step of the SDD triad (clarify → analyze → implement). Writes only the target spec.md and never fabricates — unanswered items stay draft.
---

# /clarify — domknij spec przed planem

Zamienia placeholdery `[?]` w `docs/specs/<slug>/spec.md` w konkrety przez **ustrukturyzowane Q&A**,
zanim powstanie plan i kod. Środkowy krok triady SDD:

```
/new-tool → /clarify → /analyze → /implement
```

`workflow-new-tool.mjs` zostawia `[?]` w sekcjach specu, a `validate-sdd.mjs` traktuje `[?]` w nie-draft
specie jako błąd. Ten prompt jest **resolverem** tych dziur. Pisze wyłącznie do docelowego `spec.md`,
w obrębie sandboxa `PROJECT_ROOT`.

## Wejście

- `/clarify <slug>` — konkretny spec, **albo**
- bez argumentu — przeskanuj `docs/specs/*/spec.md` po `[?]`, pokaż kandydatów i zapytaj który.

## Procedura

1. **Zbierz luki.** Wypisz każdą linię `[?]` z jej nagłówkiem sekcji (`## User story`,
   `## Acceptance criteria`, `## Success metrics`, `## Non-goals`, `## Open questions`). Dołóż luki
   implicytne: AC nie w formie Given/When/Then, metryki bez liczb (`tokensEstimate`, P95, coverage ≥ 80%),
   nieostry zakres.
2. **Pytaj pojedynczo.** Jedno pytanie naraz, najpierw `Acceptance criteria` i zakres. Do każdego
   **zaproponuj konkretny default/opcje**, żeby user odpowiadał szybko. Limit ~5–7 pytań na przebieg —
   resztę drobiazgów zostaw jako `[?]`.
3. **Zapisz odpowiedzi do specu:**
   - podmień `[?]` na konkretną treść **in-place**,
   - dopisz sekcję `## Clarifications` z logiem `data — pytanie → odpowiedź`,
   - gdy **nie został żaden `[?]`**, ustaw frontmatter `status: clarified` (zamiast `draft`).
4. **Re-waliduj.** Uruchom `npm run sdd:check`. Flip do `clarified` przejdzie tylko, gdy wszystkie `[?]`
   są domknięte (skrypt wymusza uczciwość). Zaraportuj green/red.
5. **Hand-off.** Zaproponuj `/analyze` (spójność spec↔plan↔kod), a potem `/implement`.

## Format odpowiedzi

- W trakcie: pojedyncze pytania z proponowanym defaultem.
- Na koniec: lista domkniętych `[?]` (sekcja → wartość), status specu (`draft` / `clarified`),
  wynik `sdd:check` i następny krok.

## Czego NIE robić

- **Nie zmyślaj.** „Nie wiem / pomiń" → zostaw `[?]` i **trzymaj `status: draft`** (nie udawaj kompletności).
- Nie dotykaj kodu (`src/**`) ani planu — to robią `/implement` / orchestrator. `/clarify` rusza tylko `spec.md`.
- Nie wychodź poza `PROJECT_ROOT`.
- Nie zadawaj 15 pytań naraz — sekwencyjnie, z priorytetem na to, co blokuje plan.
