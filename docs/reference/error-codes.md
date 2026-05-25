# Error codes

> Co serwer rzuca, jak to widzi klient (Copilot Chat).

Tools rzucają zwykły `Error` (z message). Serwer (MCP SDK) mapuje to na JSON-RPC error
object — domyślnie `code: -32603` (Internal error), `message` przeniesione 1:1.
**Nie ma custom error classes** w v0.3.0 — message-string jest jedynym kanałem.

## Standard JSON-RPC codes

| Code     | Name             | When                                                         |
| -------- | ---------------- | ------------------------------------------------------------ |
| `-32700` | Parse error      | Malformed JSON. Rzadkie z MCP SDK.                           |
| `-32600` | Invalid Request  | JSON valid ale nie JSON-RPC.                                 |
| `-32601` | Method not found | Method nieznany (np. literówka — używaj `tools/list/call`).  |
| `-32602` | Invalid params   | Method exists ale params nie pasują (Zod parse fail).        |
| `-32603` | Internal error   | Wszystkie pozostałe — zawartość `Error.message` w `message`. |

## Konwencja message-prefixów

Stosuj **prefix `<tool>:`** na początku `Error.message` — agent może po nim filtrować
i klient widzi która warstwa rzuciła:

```ts
throw new Error(`analyze_code: path ${resolved} escapes sandbox ${root}`);
```

## Co rzuca każdy z 5 tooli

| Tool                             | Typowe komunikaty                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `analyze_code`                   | `analyze_code: path X escapes sandbox Y` (sandbox).                                                                   |
| `propose_fix`                    | `propose_fix: path X escapes sandbox Y`; Zod refine: `At least one of test_path, source_path, or paths is required.`  |
| `run_playwright`                 | `run_playwright: path X escapes sandbox Y`.                                                                           |
| `compliance_report`              | `compliance_report: path X escapes sandbox Y`; ReDoS-cap: `pattern exceeds 200-char limit` (w `evidence`, nie throw). |
| `mcp-devtools.get_usage_history` | brak; nigdy nie throw'uje.                                                                                            |

## Przykład wire response

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "error": {
    "code": -32603,
    "message": "analyze_code: path /etc/passwd escapes sandbox /workspace"
  }
}
```

Stack trace nigdy nie trafia do klienta — tylko do stderr log (patrz [src/shared/log.ts](../../src/shared/log.ts)).
