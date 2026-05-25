---
mode: agent
description: Diagnoza środowiska — Node, build, sandbox, OS specifics
tools: ['runCommands', 'search', 'problems']
---

# /diagnose

Cel: szybka diagnostyka dlaczego `mcp-devtools` nie działa u użytkownika. Cross-platform (Windows + macOS + Linux).

## Co zrobić

1. Uruchom `npm run doctor`. Skopiuj output do raportu.
2. Jeśli output ma jakiekolwiek czerwone `✗` — wypisz każdy z hintem z `doctor`.
3. Dodatkowo sprawdź:
   - **Node**: `node --version` (>= 22)
   - **OS / Shell**:
     - Windows: `[System.Environment]::OSVersion`, `$PSVersionTable.PSVersion` (PowerShell)
     - macOS / Linux: `uname -a`
   - **VS Code MCP**: czy `.vscode/mcp.json` parse'uje się jako JSON? (`node -e "JSON.parse(require('fs').readFileSync('.vscode/mcp.json'))"`)
   - **Build**: `dist/server.js` istnieje? Jeśli nie — `npm run build`.
   - **PATH**: `npx` (POSIX) lub `npx.cmd` (Windows) findowalne?
4. Spróbuj uruchomić serwer ręcznie:
   ```sh
   # macOS / Linux / Git Bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
   ```
   ```powershell
   # Windows PowerShell
   '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
   ```
   Powinno zwrócić JSON z 5 toolami. Jeśli nie — pokaż stderr.

## Output

Tabela:

| Check         | Status | Detail                                        |
| ------------- | ------ | --------------------------------------------- |
| Node version  | ✓      | 22.11.0 satisfies >=22                        |
| Build         | ✓      | dist/server.js + 4 tools                      |
| PATH (npx)    | ✓      | C:\Program Files\nodejs\npx.cmd               |
| stdio sanity  | ✓      | tools/list returned 5 tools                   |
| MCP registry  | ⚠      | .vscode/mcp.json mcp-alm-path unset           |

Plus actionable next-steps na każdym ✗ lub ⚠.

## Nie

- Nie uruchamiaj `npm install` jako fix bez sprawdzenia czy `node_modules` faktycznie brakuje.
- Nie sugeruj `chmod +x` na Windows — tam to no-op.
- Nie zakładaj że `~` rozwija się w PowerShell (nie zawsze — używaj `$HOME` lub `$env:USERPROFILE`).
