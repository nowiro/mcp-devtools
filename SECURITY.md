# Polityka bezpieczeństwa

## Wspierane wersje

| Wersja | Wspierana |
| ------ | --------- |
| 0.3.x  | ✅        |
| < 0.3  | ❌        |

## Zgłaszanie podatności

**NIE otwieraj publicznego issue** dla podatności.

Skorzystaj z [private vulnerability reporting GitHub](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) na tym repo.

Zawrzyj:

1. Opis i potencjalny impact.
2. Kroki reprodukcji.
3. Dotknięte wersje.
4. Proof-of-concept (jeśli dostępny — traktowany jako confidential).

Potwierdzenie w 48h, fix lub plan mitygacji w 14 dniach dla critical.

## Model zagrożeń

| Wektor                               | Mitigacja                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path traversal**                   | Każdy tool resolves vs `PROJECT_ROOT` + prefix-check. `run_playwright` weryfikuje `project_root`.                                                                       |
| **SSRF (gdy doda się network tool)** | Wzorzec do zaadoptowania: `mcp-alm/src/shared/http-client.ts` (sibling repo) — blokuje loopback / RFC1918 / link-local. Opt-in `MCP_DEVTOOLS_ALLOW_PRIVATE_HOSTS=true`. |
| **ReDoS w `compliance_report`**      | `pattern:` z YAML capped at 200 chars + try/catch na `new RegExp(...)`.                                                                                                 |
| **Mutacja repo bez zgody**           | Tool który by mutował → `apply: true` w input (default: dry-run). Żaden v0.3.0 tool ich nie ma.                                                                         |
| **stdout pollution (MCP)**           | ESLint `no-console: error`; logger wyłącznie na stderr.                                                                                                                 |
| **Sekrety w logach**                 | [`log.ts`](src/shared/log.ts) redacts `token` / `secret` / `password` / `apikey` / `authorization` na każdej głębokości.                                                |
| **Supply chain**                     | `npm audit --audit-level=high` w CI (`security.yml`); `dependabot.yml` grupuje aktualizacje.                                                                            |

## Intranet posture

- **Outbound HTTP**: zero w runtime (read_docs usunięty w 0.3.0).
- **Proxy ready**: gdy dodasz tool z siecią, wzorzec z `mcp-alm/src/shared/http-client.ts` honor'uje `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `ALL_PROXY`.
- **Private CA**: `NODE_EXTRA_CA_CERTS=/path/to/bundle.pem` honored natively przez Node.
- **Self-hosted hosts**: `MCP_DEVTOOLS_ALLOW_PRIVATE_HOSTS=true` opt-in.

Pełen runbook → [docs/how-to/corporate-proxy.md](docs/how-to/corporate-proxy.md).

## Zakres

| W zakresie                                          | Poza zakresem                       |
| --------------------------------------------------- | ----------------------------------- |
| Path traversal poza `PROJECT_ROOT`                  | Podatności w Playwright / ESLint    |
| ReDoS w tool inputach                               | Ataki fizyczne / social engineering |
| Podatności zależności wprowadzone przez ten projekt | Self-hosted intranet misconfig      |
| Mutacja bez `apply: true`                           |                                     |

## Responsible disclosure

90-dni coordinated disclosure. Detale publikowane po 90 dniach od initial report LUB gdy fix shippuje (cokolwiek wcześniej, z reporter agreement).
