---
mode: agent
description: Add a new MCP tool to mcp-devtools
---

# Dodanie nowego narzędzia MCP

Cel: dodać nowy tool do `mcp-devtools` zgodnie z [`tool-contract.instructions.md`](../instructions/tool-contract.instructions.md).

## Kroki

1. **Plan** (1-akapitowy w komentarzu PR): co tool robi, jaki Input → Output, czy potrzebuje sieci/filesystem/spawn.
2. **Utwórz** `src/tools/<tool-name>.ts`:
   - `Input` i `Output` jako Zod schema (export).
   - `definition: ToolDefinition<InputT, OutputT>` z `name`, `description`, `handle(input, ctx)`.
   - `Input.parse(input)` na granicy. `Output.parse(...)` na zwrocie.
3. **Sandbox**: każda ścieżka z `input` przez `nodePath.resolve()` + prefix-check vs `ctx.projectRoot`.
4. **Network** (jeśli potrzebne): skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts` (sibling repo) — SSRF + proxy + CA już obsłużone.
5. **Test**: `src/tools/<tool-name>.spec.ts` z contract testem (Input parse round-trip, Output shape).
6. **Rejestracja**: import + dodaj do `tools` array w `src/server.ts`.
7. **Docs**: wiersz w tabeli `Narzędzia` w [`README.md`](../../README.md) z krótkim opisem Input/Output.

## Definition of Done

- `npm run lint && npm run typecheck && npm test && npm run build` — wszystko zielone.
- Brak nowych env-zmiennych bez wpisu w `docs/reference/configuration.md`.
- Conventional commit (`feat(<scope>): add <tool-name>`).
