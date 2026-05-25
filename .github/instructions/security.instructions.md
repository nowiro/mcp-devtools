---
applyTo: '**'
description: Security rules — sandbox, SSRF, proxy, secrets, dry-run discipline
---

# Security rules

## 1. Sekrety

- **Nigdy** w tracked files: source code, fixtures, commit messages, ADR, PR opisach.
- Lokalne sekrety w `.env.local` (gitignored).
- Serwer w obecnej formie nie wymaga sekretów — żaden tool nie ma upstream auth.

## 2. Sandbox filesystem

- Każdy tool resolves paths przez `nodePath.resolve(path)` i sprawdza prefix względem `ctx.projectRoot`.
- Path traversal (`..`) → throw przed I/O.
- Symlinks: tool sam decyduje czy follow'ować (default: nie).

## 3. SSRF + proxy (gdy dodasz tool z siecią)

- Skopiuj wzorzec z `mcp-alm/src/shared/http-client.ts` (sibling repo) — gotowy helper.
- Domyślnie blokuje loopback / RFC1918 / link-local / IPv6 local.
- Opt-in dla intranet: `MCP_DEVTOOLS_ALLOW_PRIVATE_HOSTS=true`.
- Honor `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` (z `undici.ProxyAgent`, lazy-load).
- Honor `NODE_EXTRA_CA_CERTS` dla private CA bundles (Node natywnie).

## 4. Input validation

- Każdy tool input parsowany przez `Input.parse(...)` w `handle()`.
- Nigdy nie ufaj LLM-generated args — Zod schema na granicy.
- Pattern-y od użytkownika (regex): limit długości + try/catch na parse.

## 5. Outputs

- Errors do użytkownika: generyczny komunikat; detale w stderr log.
- Log redaction w [`src/shared/log.ts`](../../src/shared/log.ts) — token/secret/password/apikey/authorization redacted przy każdej głębokości.
- Brak PII w session-tracker (inputChars / outputChars to **długości**, nie zawartość).

## 6. Mutating ops

- Każdy tool, który zapisuje na repo użytkownika → wymaga `apply: true` w input (default: dry-run).
- Brak takich tooli w v0.3.0.

## 7. Dependency audit

- `npm audit --audit-level=high` na każdym CI run (workflow `security.yml`).
- Nowe zależności — uzasadnij w PR opisie.
