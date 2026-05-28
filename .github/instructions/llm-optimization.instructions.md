---
applyTo: 'src/**/*.ts'
description: Reguły budżetu tokenów i shaping odpowiedzi dla narzędzi MCP w mcp-devtools
---

# Optymalizacja zapytań do LLM

Dwie warstwy: **response shaping** + **cache reuse**. Stosuje się do każdego narzędzia MCP i każdej odpowiedzi wracającej do agenta.

Zmarnowany token = wolniejsza odpowiedź, wyższy rachunek, wcześniejszy overflow kontekstu.

## Reguły

### 1. Kompaktowy JSON

Nie zwracaj `null`, `undefined`, pustych tablic/obiektów. `JSON.stringify(value)`, nigdy `JSON.stringify(value, null, 2)` (pretty-print = ~30% tokens waste).

### 2. Odpowiedź zawiera tylko to o co poproszono

Agent mówi "check file X" → zwróć findings tylko dla X. Brak automatic całego drzewa katalogów.

### 3. Truncate, nie crashuj

`propose_fix` ma `window` cap (max 200 linii). `raw_stdout` w `run_playwright` capped do 8 KB. Degraduj z `[truncated]` markerem, nigdy nie odrzucaj.

### 4. Cache identycznych wywołań

`analyze_code` używa mtime-based cache per `path+depth+metrics+framework`. Każde narzędzie scanujące FS wielokrotnie z tymi samymi parametrami = cache.

### 5. English w `description` MCP toola

`description` wysyłane przy **każdym** `tools/list`. Polski tokenizuje się ~1.4× drożej.

✅ `"Walk a TS/TSX/JS/JSX/HTML/Vue file tree. Return generic findings and per-framework metrics."`
❌ `"Przejdź po drzewie plików TS/TSX i wróć metryki frameworka."`

### 6. Deterministyczne skrypty dla powtarzalnych operacji

Powtarzalne well-defined operacje (bootstrap, doctor, validate, release) wykonuj **skryptem Node** o stałej kolejności kroków — nie ad-hoc promptem.

**MUSI być skryptem:**

- Bootstrap → `npm run bootstrap`
- Diagnostics → `npm run doctor`
- AI config validation → `npm run ai:validate`
- Full gate → `npm run verify`

**Anti-pattern:** `copilot-instructions.md` ze 200-linijkową procedurą release — to skrypt, nie prompt. Każde uruchomienie marnuje tokeny.

### 7. `_meta` envelope

Każda odpowiedź wrapowana:

```json
{
  "data": { ... },
  "_meta": { "tokensEstimate": 420, "correlationId": "9e1c7c1f-...", "durationMs": 42 }
}
```

`tokensEstimate` szacunkowy (naiwne `ceil(chars/4)`) — pozwala agentowi na świadome zarządzanie kontekstem bez external observability stack.

## Anti-patterns

- ❌ `JSON.stringify(value, null, 2)` do LLM
- ❌ Pełne pliki gdy wystarczy slice ±25 linii
- ❌ Polski w MCP tool `description`
- ❌ Hard-cap bez `truncated` flagi w odpowiedzi
- ❌ `console.log(large_object)` w handlerze (stdout = transport MCP)
