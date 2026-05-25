# Configuration reference

> Wszystkie env vars + ich precedencja.

## Precedencja

```
explicit env var > .env (loaded by host) > compiled default
```

Pierwsze niepuste źródło wygrywa. Serwer nie czyta argumentów / stdin do konfiguracji — stdin jest zarezerwowany dla MCP protocol.

## Server-wide

| Variable       | Default | Cel                                                                                  |
| -------------- | ------- | ------------------------------------------------------------------------------------ |
| `PROJECT_ROOT` | `cwd()` | Absolutna ścieżka projektu, na którym pracują tools. Path arg poza root'em → reject. |
| `LOG_LEVEL`    | `info`  | `trace`/`debug`/`info`/`warn`/`error`/`fatal`. Logi na stderr.                       |

## Intranet / network

Żaden tool w v0.3.0 nie wykonuje outbound HTTP. Pełna tabela env vars
(`HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`, `MCP_DEVTOOLS_ALLOW_PRIVATE_HOSTS`,
…) → [`docs/how-to/corporate-proxy.md`](../how-to/corporate-proxy.md).

## Per-tool

Wszystkie tool inputs idą przez JSON-RPC `arguments`. Brak per-tool env vars w v0.3.0.

## Przykład: VS Code `.vscode/mcp.json`

```jsonc
{
  "$schema": "https://aka.ms/vscode-mcp.schema.json",
  "servers": {
    "devtools": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/server.js"],
      "env": {
        "PROJECT_ROOT": "${workspaceFolder}",
        "LOG_LEVEL": "info",
      },
    },
  },
}
```
