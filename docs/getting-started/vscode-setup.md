# VS Code setup

> Cel: po otwarciu repo w VS Code ≥ 1.121, Copilot Chat ma dostęp do `devtools` MCP serwera (plus opcjonalnie 5× `mcp-alm` jeśli sklonowałeś sibling repo). Działa identycznie na Windows i macOS.

## 1. Wymagania

- **VS Code 1.121+** — natywne wsparcie `.vscode/mcp.json` z `${workspaceFolder}` substitution + `${input:*}` variables.
- **GitHub Copilot Chat extension** (Settings → Extensions → instaluj `github.copilot-chat`).
- **Node.js 22+** (`.nvmrc` w repo).
- **Build mcp-devtools**: `npm ci && npm run build`.
- **(opcjonalnie) Build mcp-alm** jako sibling clone, żeby dostać 5 ALM connectorów.

## 2. Plik konfiguracji

W repo jest gotowy [`.vscode/mcp.json`](../../.vscode/mcp.json). Definiuje:

- `devtools` — lokalny `dist/server.js` przez `${workspaceFolder}` (zawsze dostępny).
- `alm-jira`, `alm-confluence`, `alm-figma`, `alm-sonar`, `alm-gitlab` — przez `${input:mcp-alm-path}` (VS Code zapyta przy pierwszym reload).

Brak hardcoded ścieżek — działa od razu na Windows, macOS i Linux.

## 3. Reload Copilot Chat

1. Otwórz Command Palette: `Ctrl+Shift+P` (Windows / Linux) lub `Cmd+Shift+P` (macOS).
2. **MCP: List Servers** → **Reload**.
3. VS Code zapyta o **ścieżkę do `mcp-alm`** (input `mcp-alm-path`):
   - **Windows**: `C:\dev\mcp-alm` lub `D:\projects\mcp-alm` (akceptowalne też `C:/dev/mcp-alm`).
   - **macOS**: `/Users/you/dev/mcp-alm` lub `~/code/mcp-alm`.
   - **Linux**: `/home/you/code/mcp-alm`.
   - **Default** (Enter bez wpisywania): `${workspaceFolder}/../mcp-alm` — czyli folder `mcp-alm` obok bieżącego workspace.
   - **Skip**: wpisz pustą wartość albo nieistniejącą ścieżkę — `devtools` zadziała, `alm-*` zwrócą startup error (bezpieczne — Copilot je pominie).
4. VS Code zapyta o **write-mode** (`mcp-alm-write-enabled`): `false` (default) lub `true`. Default safe — write tools są wyłączone.
5. Zaakceptuj trust prompts per server (`devtools`, `alm-*`).
6. Sprawdź **Copilot Chat → Tool picker** — powinno być widać tools z każdego serwera (devtools: 5 tools, plus mcp-alm jeśli wpisana valid ścieżka).

## 4. Per-workspace overrides

`devtools` automatycznie ustawia `PROJECT_ROOT=${workspaceFolder}`. Jeśli chcesz override (np. analizujesz repo poza otwartym workspace), edytuj wpis w `.vscode/mcp.json`:

```jsonc
"devtools": {
  "type": "stdio",
  "command": "node",
  "args": ["${workspaceFolder}/dist/server.js"],
  "env": {
    "PROJECT_ROOT": "/abs/path/to/target/repo",  // override
    "LOG_LEVEL": "debug"                          // verbose stderr
  }
}
```

## 5. Pytanie o write-mode (mcp-alm)

`alm-jira`, `alm-confluence`, `alm-gitlab` mają write tools (`create_issue`, `add_comment`, …). `.vscode/mcp.json` zapyta przy reload:

> _Enable mutating tools in mcp-alm for this workspace?_

Default: `false`. Dla code-review / triage włącz; dla audit-only zostaw `false`. Każdy write tool dodatkowo wymaga `assertWriteAllowed` runtime check (patrz `mcp-alm/SECURITY.md`).

## 6. Troubleshooting

| Symptom                            | Fix                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| "Server not found" przy reload     | Zbuduj: `npm run build`. Sprawdź że `dist/server.js` istnieje.                               |
| `alm-*` nie startuje               | Zła ścieżka `mcp-alm-path` — uruchom **MCP: List Servers → Reset Inputs**, podaj poprawną.   |
| Tools nie widać w pickerze         | Restart VS Code. Sprawdź **View → Output → MCP** dla logów stderr.                           |
| `EACCES` / permission denied       | macOS/Linux: `chmod +x dist/server.js` (zazwyczaj nie potrzebne, Node CLI radzi sobie sam).  |
| `node: command not found` (macOS)  | Zainstaluj Node 22+: `brew install node@22` lub przez `nvm install 22 && nvm use 22`.        |
| Ścieżki Windows nie działają       | VS Code akceptuje zarówno `C:\path` jak i `C:/path`. Unikaj mieszania separatorów.            |
| `mcp-alm-path` Enter nie ustawia default | Wpisz explicit `${workspaceFolder}/../mcp-alm` w polu inputa.                          |

## 7. Re-prompt o inputs

VS Code cache'uje wartości inputów per workspace. Żeby zmienić ścieżkę `mcp-alm` lub przełączyć write-mode:

**Command Palette → MCP: List Servers → Reset Inputs**, potem **Reload**.
