# Troubleshooting

> Symptom → cause → fix. Dodawaj wpis, gdy incident zajął > 5 minut.

## Runtime

### Tool zwraca `<tool>: path X escapes sandbox Y`

**Cause.** Wejściowa ścieżka resolwuje się poza `PROJECT_ROOT`. Każdy z tooli plikowych (`analyze_code`, `propose_fix`, `run_playwright`, `compliance_report`) sandboxuje ścieżki przed I/O.
**Fix.** Albo podaj path pod `PROJECT_ROOT`, albo ustaw `PROJECT_ROOT` env var na właściwego roota (default `process.cwd()` jest rzadko tym, czego chcesz przy launch przez MCP host).

### Output toola jest obcięty / ma dziwne znaki

**Cause.** Coś poza protokołem MCP zapisało do stdout.
**Fix.** ESLint rule `no-console: error` powinien to złapać. Re-run `npm run lint`. Logging idzie tylko przez `src/shared/log.ts` → stderr.

### Network-tool errors (`SSRF guard`, `HTTPS_PROXY`, private CA)

`mcp-devtools` w v0.3.0 nie wykonuje outbound HTTP — żadne te błędy nie powstaną w runtime. Gdy dodasz tool sieciowy (wzorzec z `mcp-alm/src/shared/http-client.ts`), przejdź do [`docs/how-to/corporate-proxy.md`](how-to/corporate-proxy.md) → sekcja "Troubleshooting".

## CI

### `npm audit --audit-level=high` fails

**Cause.** High-severity CVE w deps.
**Fix.** Upgrade do patched wersji albo, jeśli dep nieużywany, usuń. Last resort: `npm overrides` w `package.json`.

### Secret scanning flaguje sekret

**Cause.** Diff / historia zawiera string pasujący do credential pattern (natywny GitHub secret scanning / push protection — repo nie używa gitleaks-action).
**Fix.** Jeśli real — **rotuj sekret** i wyczyść historię (`git filter-repo`). Jeśli false positive — dismiss w UI GitHub secret scanning albo dodaj wyjątek do pattern config.
