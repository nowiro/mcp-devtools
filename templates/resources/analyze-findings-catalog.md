# analyze_code — findings catalog

Pełna lista finding kinds które `analyze_code` rozpoznaje. Severities są stałe
(nie zależą od inputu) — agent może planować triage bez wcześniejszego wywołania.

## Generic findings (każdy framework)

| kind             | severity  | detector                                       | triage hint                                                                                                                                 |
| ---------------- | --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `console-log`    | `warning` | `\bconsole\.(log\|warn\|error\|debug\|info)\b` | Zamień na structured logger (`pino`, `winston`, `log()` z `src/shared/log.ts`). W mcp-server NIGDY nie pisz do `stdout` — to ramka MCP.     |
| `debugger`       | `warning` | `\bdebugger\b\s*;`                             | Leftover debug statement — usuń przed commitem (pauzuje runtime gdy DevTools otwarte, łatwo przeoczyć w bundlu).                            |
| `todo`           | `info`    | `\b(TODO\|FIXME\|XXX\|HACK)\b[:\s]`            | Surface w PR description — albo zrób ticket i usuń, albo zamień na ADR jeśli to design choice. `XXX` / `HACK` traktuj poważniej niż `TODO`. |
| `dangerous-html` | `warning` | `dangerouslySetInnerHTML` (React only)         | XSS risk. Sanitize z `DOMPurify` przed wstawieniem. Audit czy `__html` nie pochodzi z user-input.                                           |
| `legacy-pattern` | `error`   | `\*ngIf\|\*ngFor\|\*ngSwitch` (Angular)        | Angular 17+ syntax: `@if`, `@for`, `@switch`. Migration: `npx ng generate @angular/core:control-flow`.                                      |

## Framework auto-detection

Detektor patrzy na importy + wzorce. Tylko jeden framework wygrywa per plik:

- **Angular**: `from '@angular/core'`, `from '@angular/common'`, signal API (`signal()`, `computed()`).
- **React**: `useState`, `useEffect`, `useMemo`, `useCallback`, class components (`extends React.Component`), `dangerouslySetInnerHTML`.
- **Vue**: `defineComponent`, `defineProps`, `defineEmits`, SFC (`.vue` extension).
- **None**: brak match'u → tylko generic findings.

Override przez `framework: 'angular' | 'react' | 'vue' | 'none'`. `auto` (default) wybiera per-plik na podstawie importów.

## Per-framework metrics (`metrics: true`)

### Angular (`metrics.angular`)

- `signal_count`, `computed_count`, `effect_count` — adoption nowego signal API.
- `legacy_directive_count` — `*ngIf` / `*ngFor` / `*ngSwitch` (powinno być 0 w nowym kodzie).

### React (`metrics.react`)

- `use_state_count`, `use_effect_count`, `use_memo_count`, `use_callback_count` — hook usage.
- `class_component_count` — class components (anti-pattern w nowym kodzie).
- `dangerous_html_count` — XSS surface area.

### Vue (`metrics.vue`)

- `sfc_files` — `.vue` SFC count.
- `define_component`, `define_props`, `define_emits` — composition API adoption.

## Cache

mtime-based — analyze ponawia plik tylko jeśli `mtime` się zmieniło między wywołaniami w jednej sesji. `cache_hit: true` w response → wszystkie pliki z cache.

## Sandbox

`path` musi być wewnątrz `PROJECT_ROOT` (env). Path traversal (`../../`) jest blokowany przez `assertWithinSandbox`.

## Praktyczne workflow

1. **Pre-commit lekki**: `analyze_code({ path: ".", depth: 3, framework: "auto" })` — szybki scan zmienionego subtree.
2. **Pre-release głęboki**: `analyze_code({ path: ".", depth: 5, metrics: true, framework: "auto" })` — pełen scan z framework metrics.
3. **Specific subtree**: `analyze_code({ path: "src/auth", depth: 2 })` — focus na sensitive area.

Pełen output schema → `Output` zod w [`src/tools/analyze-code.ts`](src/tools/analyze-code.ts).
