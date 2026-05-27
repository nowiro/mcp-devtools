# propose_fix — context assembly guide

`propose_fix` **nie generuje** patcha — komponuje deterministyczny kontekst, który
LLM (Claude / GPT przez Copilot) potem czyta i proponuje fix. Token-aware:
zamiast wysyłać cały plik, sklejasz `window` linii wokół failing fragmentu +
relevant rules.

## Co robi tool

1. Czyta `test_path` (plik testu) — w całości, zawsze.
2. Czyta każdy plik z `paths` — przycięty do `window` linii (default 25) z każdej strony match'a.
3. Czyta każdy `*.md` z `rules_paths` — przycięty do top 10 linii każdego pliku.
4. Łączy w jeden `context` blob z separatorami `--- FILE: <path> ---`.
5. Zwraca `{ context, tokensEstimate }` — Copilot decyduje czy budget pozwala.

Tool **nie wywołuje LLM** — ta praca to job promptu w Copilot Chat. Tool to tylko
deterministyczna ekstrakcja.

## Input shape

| param          | type       | required | default | znaczenie                                                                      |
| -------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `test_path`    | `string`   | tak      | —       | Plik testu który failuje (relative to `PROJECT_ROOT`).                         |
| `failure_text` | `string`   | tak      | —       | Failure output / stack trace (kilka linii, max 4 KB).                          |
| `paths`        | `string[]` | nie      | `[]`    | Pliki źródłowe powiązane z testem (relative). Each → `window` linii kontekstu. |
| `rules_paths`  | `string[]` | nie      | `[]`    | Katalogi z `*.md` rules / standards. Tool czyta top 10 linii każdego `.md`.    |
| `window`       | `number`   | nie      | `25`    | Linie kontekstu z każdej strony match'a w `paths`. `0..200`.                   |

## Sandbox

Wszystkie ścieżki — `test_path`, `paths`, `rules_paths` — muszą być w `PROJECT_ROOT`.
Path traversal (`../etc/passwd`) blokowany przez `assertWithinSandbox`.

## Output shape

```json
{
  "context": "--- FILE: src/auth/auth.spec.ts ---\n<full test>\n\n--- FILE: src/auth/auth.ts ---\n<window=25 around matches>\n\n--- RULES: docs/standards ---\n<top 10 lines of each .md>",
  "tokensEstimate": 1840
}
```

`tokensEstimate` to `Math.ceil(context.length / 4)` — heurystyka GPT-class. Dla
Claude jest konserwatywnie zaokrąglona w górę.

## Praktyczny workflow w Copilot Chat

```
1. Test failuje — copy stack trace.
2. /flaky-investigation
   testPath = src/auth/auth.spec.ts
   failureText = <paste stack trace>
3. Copilot wywołuje propose_fix z paths=[src/auth/auth.ts], rules_paths=["docs/standards"].
4. Z otrzymanego `context` Copilot proponuje konkretny diff + identyfikuje root cause.
```

## Tipy

- **Wybór `paths`**: dodaj plik produkcyjny + każdy plik pomocniczy do którego test się odwołuje (mocki, fixtures). Tool nie czyta całego repo — musisz wskazać.
- **`window`**: domyślnie 25, ale dla flaky race condition warto `50` żeby pokryć cały setup+act+assert.
- **`rules_paths`**: wskaż katalog z reguły coding style — LLM widzi że "musi być pino logger" zamiast halucynować "console.log jest ok".
- **`failure_text`**: trzymaj < 4 KB. Long stack trace tnij do 10-20 linii top + 5 linii bottom — środek zwykle jest noise.

## Co tool NIE robi

- Nie pyta LLM o fix (to job Copilot promptu).
- Nie aplikuje patcha (zawsze human-in-the-loop).
- Nie czyta plików spoza `paths` / `rules_paths` (no implicit dependency walking).
- Nie cache'uje wyniku — każde wywołanie czyta świeże pliki.

Pełen schema → `Input` / `Output` zod w [`src/tools/propose-fix.ts`](src/tools/propose-fix.ts).
