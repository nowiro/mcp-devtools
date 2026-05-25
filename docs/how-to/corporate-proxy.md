# Corporate proxy + private CA

> Forward-looking reference. **Żaden** z 5 tooli v0.3.0 nie wykonuje outbound
> HTTP — pełna izolacja sieciowa. Ta strona jest dla **przyszłych** tooli
> sieciowych.

## Wzorzec referencyjny

`mcp-alm/src/shared/http-client.ts` w sibling repo. Dependency-free (poza
opcjonalnym `undici.ProxyAgent` lazy-loaded), obsługuje wszystkie env vars
poniżej, ma SSRF guard + path-escape + proxy-bypass test coverage.

## Environment variables

Wszystkie czytane natywnie przez Node lub przez wzorzec http-client:

| Variable                           | Cel                                                                       | Przykład                                  |
| ---------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| `HTTPS_PROXY` / `HTTP_PROXY`       | Forward outbound przez proxy (per schema).                                | `http://proxy.corp.lan:8080`              |
| `ALL_PROXY`                        | Fallback gdy schema-specific nieobecny.                                   | `http://proxy.corp.lan:8080`              |
| `NO_PROXY`                         | CSV hostów które omijają proxy. `.foo.com` = suffix match.                | `localhost,127.0.0.1,.corp.lan,.internal` |
| `NODE_EXTRA_CA_CERTS`              | PEM bundle z prywatnymi CA. Node honor natywnie.                          | `C:\corp\ca-bundle.pem`                   |
| `MCP_DEVTOOLS_ALLOW_PRIVATE_HOSTS` | `true` opt-in dla loopback / RFC1918 / link-local (self-hosted intranet). | `true`                                    |
| `MCP_DEVTOOLS_DISABLE_PROXY`       | `true` opt-out na proxy per-process.                                      | `true`                                    |

Wszystkie te zmienne są **standardowe Node** — dokumentacja konfiguracji
per OS (PowerShell `[Environment]::SetEnvironmentVariable`, bash `export`,
`.vscode/mcp.json` w `env:` bloku) w docs Node / VS Code.

## Dodanie tool'a z siecią — checklist

1. Skopiuj `mcp-alm/src/shared/http-client.ts` jako start.
2. Wytnij auth (devtools nie ma per-server tokenów) i ETag/dedup (zbędne dla 5 lokalnych tooli).
3. Zostaw: SSRF guard, proxy resolution, `NODE_EXTRA_CA_CERTS` via Node, identifying headers, timeout, body cap.
4. Dodaj env var prefix `MCP_DEVTOOLS_*` (nie `MCP_ALM_*`).
5. Dodaj test path-escape + SSRF-block + proxy-bypass (wzorzec w mcp-alm spec).
