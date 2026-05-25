---
applyTo: '**'
description: Production readiness — cztery must-haves przed dodaniem lub zmianą narzędzia MCP
---

# Production readiness — cztery must-haves

> Każda zmiana funkcjonalna w `mcp-devtools` MUSI spełnić te cztery kontrole zanim trafi do `main`.

## 1. Sandbox — wszystkie ścieżki przez `resolveSandboxPath`

**Co.** Każde narzędzie czytające FS resolwuje ścieżkę przez `resolveSandboxPath(input.path)`.

**Po co.** Bez tego agent może przez `../../../etc/passwd` wyjść poza `PROJECT_ROOT`.

**Sygnały, że jest w miejscu:**

- Handler toola importuje i woła `resolveSandboxPath` jako pierwszą operację.
- Test spec zawiera case: `path: '../../etc/passwd'` → `SecurityError`.
- `npm run doctor` weryfikuje `PROJECT_ROOT` resolution.

## 2. Zod na granicy — brak `any`

**Co.** Każde `Input` i `Output` narzędzia jest zdefiniowane przez Zod schema.
Input jest parsowany przez `Input.parse(rawInput)` zanim dotknie się logiki.

**Po co.** JSON-RPC nie gwarantuje typów. Agent może wysłać `path: null` zamiast `path: string`.

**Sygnały, że jest w miejscu:**

- Brak `as any` na granicach `handle(input)`.
- `Input.parse()` wywoływane przed pierwszą operacją na danych.
- Schema eksportowane (`export const Input = z.object({...})`) żeby testy mogły je testować.

## 3. Testy — minimum 3 przypadki per narzędzie

**Co.** Każde narzędzie ma `src/tools/<tool>.spec.ts` z co najmniej:

- Happy path (poprawny input → oczekiwany output).
- Sandbox escape (path traversal → `SecurityError`).
- Edge case (pusty katalog, nieistniejący plik, zero findings).

**Po co.** Bez testów każdy refactor `shared/` może złamać narzędzie niezauważalnie.

**Sygnały, że jest w miejscu:**

- `npm test` przechodzi z 0 failed.
- Coverage ≥ 50% (docelowo 70% po stabilizacji).

## 4. Validation gate przed raportem Done

```sh
npm run verify
# = format:check + lint + typecheck + test + build + ai:validate
```

Jeśli którykolwiek krok zawiedzie — **nie** jesteś done.

---

## End-of-feature checklist

Zanim feature trafia do `main`:

- [ ] **Sandbox** — wszystkie ścieżki FS przechodzą przez `resolveSandboxPath`.
- [ ] **Zod** — `Input` i `Output` zdefiniowane, `parse()` na granicy.
- [ ] **Testy** — min. 3 przypadki, `npm test` przechodzi.
- [ ] **Verify** — `npm run verify` zielony lokalnie + CI zielony na 3 OS.
- [ ] **README** — nowe narzędzie opisane w sekcji Narzędzia.
- [ ] **CHANGELOG** — wpis w `[Unreleased]`.

## Zobacz też

- [`security.instructions.md`](security.instructions.md) — sandbox i secrets policy.
- [`tool-contract.instructions.md`](tool-contract.instructions.md) — kontrakt każdego toola.
- [`mcp-server.instructions.md`](mcp-server.instructions.md) — konwencje serwera.
