# IntelliJ IDEA setup

> Cel: AI Assistant lub GitHub Copilot w IntelliJ IDEA ≥ 2026.1.2 ma dostęp do `devtools` MCP serwera (plus opcjonalnie 5× `mcp-alm`). Działa identycznie na Windows i macOS — różnią się tylko ścieżki w XML.

## 1. Wymagania

- **IntelliJ IDEA 2026.1.2+** z włączonym **GitHub Copilot plugin** (Settings → Plugins → install).
- **Node.js 22+** dostępny w PATH (sprawdź: `node --version`).
- **Build mcp-devtools**: `npm ci && npm run build`.
- **(opcjonalnie) Build mcp-alm** w siblings repo.

## 2. Skopiuj template

[`.idea/mcp-servers.example.xml`](../../.idea/mcp-servers.example.xml) to template. IntelliJ **nie** expanduje `${PROJECT_DIR}` ani zmiennych — ścieżki **muszą** być absolutne. Skopiuj template do `.idea/mcp-servers.xml` (gitignored) i podstaw ścieżki dla swojego systemu.

### Windows

```xml
<server name="devtools" command="node">
  <args>
    <arg>C:\dev\mcp-devtools\dist\server.js</arg>
  </args>
  <env>
    <entry key="PROJECT_ROOT" value="C:\dev\mcp-devtools" />
    <entry key="LOG_LEVEL" value="info" />
  </env>
</server>
<server name="alm-jira" command="node">
  <args>
    <arg>C:\dev\mcp-alm\dist\server-jira.js</arg>
  </args>
</server>
<!-- powtórz dla alm-confluence, alm-figma, alm-sonar, alm-gitlab -->
```

### macOS / Linux

```xml
<server name="devtools" command="node">
  <args>
    <arg>/Users/you/dev/mcp-devtools/dist/server.js</arg>
  </args>
  <env>
    <entry key="PROJECT_ROOT" value="/Users/you/dev/mcp-devtools" />
    <entry key="LOG_LEVEL" value="info" />
  </env>
</server>
<server name="alm-jira" command="node">
  <args>
    <arg>/Users/you/dev/mcp-alm/dist/server-jira.js</arg>
  </args>
</server>
<!-- powtórz dla alm-confluence, alm-figma, alm-sonar, alm-gitlab -->
```

### Wykrycie absolute path

- **Windows PowerShell**: `(Resolve-Path .).Path`
- **macOS / Linux**: `pwd` (lub `realpath .`)

## 3. Import w IDE

1. Settings → **Tools → AI Assistant → Model Context Protocol** (lub Settings → **Languages & Frameworks → GitHub Copilot → MCP Servers**, zależnie od buildu).
2. Kliknij **Import from file…** i wskaż edytowany `mcp-servers.xml`.
3. **Apply** + restart IDE (Help → Restart).

## 4. Weryfikacja

AI Assistant / Copilot Chat tool picker pokaże serwery i ich tools (devtools: 5 tools, plus mcp-alm jeśli skonfigurowane).

## 5. Pisanie / mutacje (alm-\*)

Jeśli chcesz włączyć write tools dla Jira/Confluence/GitLab, dodaj do `<env>` bloku w XML:

```xml
<env>
  <entry key="MCP_WRITE_ENABLED" value="true" />
  <entry key="MCP_WRITE_ALLOWLIST" value="jira.add_comment,jira.transition_issue" />
</env>
```

Tokeny dla `alm-*` żyją w:

- **Windows**: `%USERPROFILE%\.config\mcp-alm\config.json`
- **macOS / Linux**: `~/.config/mcp-alm/config.json`

Patrz README `mcp-alm` — file mode `0600` na POSIX (chmod), na Windows uprawnienia NTFS dziedziczone z `%USERPROFILE%`.

## 6. Troubleshooting

| Symptom                       | Fix                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| "Server failed to start"      | Sprawdź absolute path. IntelliJ NIE expanduje zmiennych.                                  |
| Tool picker pusty             | Restart IDE. Sprawdź **Help → Show Log in Explorer/Finder** → search "mcp".               |
| `node: command not found`     | Node nie w PATH IntelliJ. Settings → Tools → Terminal → Shell path. Restart IDE.          |
| Build z dist nie wystartuje   | `node --version` ≥ 22. Sprawdź `engines.node` w `package.json`.                           |
| Slashe w ścieżkach na Windows | Używaj `\\` w XML lub raw `\` z atrybutem `xml:space="preserve"`. Forward slashes też OK. |
