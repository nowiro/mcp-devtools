---
applyTo: 'src/**/*.ts'
description: Reguły budżetu tokenów i shaping odpowiedzi dla narzędzi MCP w mcp-devtools
---

# Optymalizacja zapytań do LLM

> Reguły zmniejszania zużycia tokenów na dwóch warstwach: response shaping i cache reuse. Dotyczy każdego narzędzia MCP oraz każdej odpowiedzi wracającej do agenta.

## Dlaczego to ma znaczenie

Tokeny kosztują pieniądze i kontekst. Zmarnowany token to:

- **Wolniejsza odpowiedź** (więcej do wygenerowania).
- **Wyższy rachunek** (per-token billing).
- **Wcześniejszy overflow** kontekstu — agent traci pamięć rozmowy szybciej.

## Reguły

### 1. Kompaktowy JSON

Nie zwracaj `null`, `undefined`, pustych tablic/obiektów.

**Anti-pattern:** `JSON.stringify(value, null, 2)` — pretty-print marnuje 30%+ tokenów.
**Pattern:** `JSON.stringify(value)`.

### 2. Odpowiedź zawiera tylko to, o co poproszono

Gdy agent mówi "check file X" — zwróć tylko findings dla X.
Nie dodawaj automatycznie całego drzewa katalogów, które nie było pytane.

### 3. Truncate, nie crashuj

`propose_fix` jest ograniczone parametrem `window` (max 200 linii).
`raw_stdout` w `run_playwright` jest capped do 8 KB.
Nigdy nie odrzucaj odpowiedzi — degraduj z `[truncated]` markerem.

### 4. Cache identycznych wywołań

`analyze_code` używa mtime-based cache per `path+depth+metrics+framework`.
Każde narzędzie, które skanuje filesystem wielokrotnie z tymi samymi parametrami, powinno mieć cache.

### 5. English w `description` MCP toola

Pole `description` jest wysyłane do LLM przy **każdym** `tools/list`.
Polski tokenizuje się ~1.4× drożej niż angielski.

✅ `"Walk a TS/TSX/JS/JSX/HTML/Vue file tree. Return generic findings and per-framework metrics."`
❌ `"Przejdź po drzewie plików TS/TSX i wróć metryki frameworka."`

### 6. Deterministyczne skrypty dla powtarzalnych operacji

**Zasada:** powtarzalne, dobrze zdefiniowane operacje (bootstrap, doctor, validate AI config, release) wykonuj **skryptem Node** o stałej kolejności kroków — nie ad-hoc promptem do LLM.

**Co MUSI być skryptem:**

- Bootstrap repo → `npm run bootstrap` (`tools/scripts/bootstrap.mjs`)
- Diagnostics → `npm run doctor` (`tools/scripts/doctor.mjs`)
- AI config validation → `npm run ai:validate` (`tools/scripts/validate-ai-config.mjs`)
- Pełny gate → `npm run verify`

**Anti-pattern:** `copilot-instructions.md` ze 200-linijkową procedurą "jak zrobić release" —
to skrypt, nie prompt. Każde uruchomienie marnuje tokeny na ponowne czytanie procedury.

### 7. `_meta` envelope

Każda odpowiedź narzędzia jest wrapowana w:

```json
{
  "data": { ... },
  "_meta": {
    "tokensEstimate": 420,
    "correlationId": "9e1c7c1f-...",
    "durationMs": 42
  }
}
```

`tokensEstimate` jest szacunkowy (naiwne `ceil(chars/4)`), ale pozwala agentowi
na świadome zarządzanie kontekstem bez zewnętrznego stacku observability.

## Anti-patterns

- ❌ `JSON.stringify(value, null, 2)` przy zwracaniu do LLM
- ❌ Zwracanie pełnych zawartości plików gdy wystarczy slice ±25 linii
- ❌ Polski w MCP tool `description`
- ❌ Hard-cap bez `truncated` flagi w odpowiedzi
- ❌ `console.log(large_object)` w handlerze (stdout jest zarezerwowany dla transportu MCP)
