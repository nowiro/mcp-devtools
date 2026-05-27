---
mode: agent
description: Defensive security audit toola — sandbox escape, path traversal, ReDoS, secret leakage, spawn injection
tools: ['editFiles', 'search', 'runCommands', 'runTasks', 'problems']
---

# Security review

Inspirowane Copilot CLI `/security-review` slash command. Defensive audyt
pojedynczego narzędzia w mcp-devtools pod kątem typowych klas vulnerabilities.

## Scope

Wybierz **jedno** narzędzie — audyt szerszego scope rozdziela ostrożność.

- `tool` (string, required): jedna z `analyze_code`, `propose_fix`, `run_playwright`, `compliance_report`
- `focus` (string, optional): `sandbox`, `redos`, `injection`, `secrets`, `all` (default)

## Workflow

### 1. Wytyp powierzchnię ataku

Otwórz `src/tools/<tool>.ts` + `src/tools/<tool>.spec.ts`. Wylistuj:

- Wszystkie inputy z Zod schema.
- Wszystkie operacje FS (`readFile`, `readdir`, `stat`).
- Wszystkie operacje spawn / exec (`run_playwright` jedyny).
- Wszystkie regex literals (kandydat na ReDoS).

### 2. Sandbox FS audit

Reguły z [`src/shared/sandbox.ts`](../../src/shared/sandbox.ts):

- Każda ścieżka z user-input MUSI przejść przez `assertWithinSandbox(path, PROJECT_ROOT, toolName)` lub `resolveSandboxPath(path)`.
- Sprawdź: czy gdziekolwiek `path` z `input` trafia do `readFile` / `readdir` BEZ przewodu przez sandbox? Path traversal (`../../etc/passwd`, `../../../../C:\Windows\System32`) musi być blokowane.
- Czy normalizacja działa identycznie na NTFS i POSIX? Backslash vs forward slash; case-insensitive vs case-sensitive matching.
- Symlink resolution: jeśli `PROJECT_ROOT` zawiera symlink poza sandbox, czy `realpath` jest wywołane przed comparison?

### 3. ReDoS (regex denial of service) audit

Inspekcja z `compliance-report.ts`:

- Każdy `RegExp` literal pochodzący z user-input lub rule frontmatter MUSI mieć bounded length (`compliance-report` cap'uje na 512 znaków).
- Nested quantifiers (`(a+)+`, `(a*)*`, `(a|a)+`) — kandydat na catastrophic backtracking. Sprawdź wzorce z `compliance_report` rule patterns.
- Sonarjs/slow-regex rules: czy każdy regex używa character class zamiast `.` żeby uniknąć super-linear backtracking?

### 4. Subprocess / spawn injection (`run_playwright` only)

- `spawn(npx, args)` — czy `args` jest pure array (nie shell-concatenated string)?
- `shell: false` jest default — sprawdź że nikt nie ustawia `shell: true`.
- `cwd` musi być `PROJECT_ROOT` lub jego sub-path; nigdy user-controlled bez sandbox check.
- `--grep` parameter: user-controlled regex passing do Playwright. Tam już bezpieczne (Playwright robi własny safety check), ale verify że nasz code go nie evaluuje przed.
- Environment variables passed do child — czy żadna nie zawiera tokenów lub secretów z naszego config?

### 5. Secret leakage audit

- `console.log` do **stdout** z handlera narzędzia → fatal (uszkadza MCP frame).
- `log(...)` z `src/shared/log.ts` musi redactować token-like keys recursively. Sprawdź czy nowe pole które dodaje narzędzie nie wymyka się redactor'owi.
- `compliance_report` rule files mogą zawierać `must_exist: .env` jako rule. Output rule evaluation — czy zawartość pliku (jeśli match) wycieka do response?
- Stack traces: error messages z full path mogą leak'ować user's directory structure. Sprawdź `tools/<tool>.ts` error handlers.

### 6. Schema validation gaps

- Każdy `Input.parse(input)` musi być pierwszą operacją w `handle()`.
- Discriminated unions: czy zod schema zakrywa wszystkie warianty? Brak `else` w discriminator = silent type confusion.
- `z.string()` bez `.min(1)` / `.max(N)` → unbounded input. Dla path inputs zawsze cap (np. `.max(4096)`).
- `z.array()` bez `.max(N)` → DoS przez wstrzyknięcie 10k entries.

### 7. Output verification

Po review, emituj:

```yaml
security_review:
  tool: <name>
  scope: <focus>
  findings:
    - severity: high | medium | low
      class: sandbox | redos | injection | secrets | schema | other
      file: src/tools/...:LINE
      issue: <one-liner>
      remediation: <konkretny diff suggestion>
  clean_areas: # gdzie audit nic nie znalazł
    - <area>
  next_steps:
    - <task dla user'a (np. dodaj sandbox-escape test)>
```

## Sukces

`security-review` jest done gdy:

1. Każda klasa z #2-#6 ma explicit verdict (clean / N findings).
2. Każde finding ma file:line + konkretną remediation (nie "validate input" — _what_, _where_, _how_).
3. Output blok w YAML jak wyżej.

## Co NIE robi

- **Nie wprowadza zmian** w kodzie. To audit, nie fix.
- **Nie audytuje deps** (axios, fs-extra). Scope to nasz src/.
- **Nie testuje exploitów lokalnie.** Static analysis only.

## Cross-check

Po `/security-review`:

- Otwórz [`.github/agents/security-auditor.agent.md`](../agents/security-auditor.agent.md) jeśli findings wymagają STRIDE deep-dive.
- [`.github/instructions/security.instructions.md`](../instructions/security.instructions.md) — sandbox, secrets policy.
- Powiązany prompt: [`audit-sandbox.prompt.md`](audit-sandbox.prompt.md) — narrow audit tylko sandbox.
