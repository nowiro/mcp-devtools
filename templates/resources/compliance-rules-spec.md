# compliance_report — rules spec

`compliance_report` skanuje `standards_path` w poszukiwaniu plików `*.md` z YAML
frontmatter zawierającym automated check. Każdy plik = jedna reguła. Score = % `pass`.

## Format pliku reguły

```markdown
---
must_exist: README.md
---

# README must exist

Każde repo musi mieć README.md w roocie — minimalna dokumentacja onboardingu.
```

Frontmatter to wzorzec **`klucz: wartość`** (flat scalars, no nested structures).
Body markdown jest tylko do dokumentacji — nie wpływa na ewaluację.

## Dostępne checks

Tylko jeden check per reguła — jeśli podasz kilka, pierwszy zdefiniowany wygrywa
(`pattern` > `must_exist` > `must_not_exist`).

### `must_exist: <path>`

- **Pass**: file/dir o tej ścieżce istnieje (relatywnie do `project_root`).
- **Fail**: nie istnieje.
- **Use case**: enforce obecność `README.md`, `LICENSE`, `.editorconfig`, `package.json`.

### `must_not_exist: <path>`

- **Pass**: file/dir nie istnieje.
- **Fail**: istnieje.
- **Use case**: blokuj `.env` w repo, deprecated `tslint.json`, `npm-debug.log`.

### `pattern: <regex>`

- **Pass**: co najmniej jeden plik (TS/JS/JSON/MD) zawiera linię matchującą regex.
- **Fail**: żaden plik nie matchuje.
- **Unknown**: regex nieparsowalny.
- **Use case**: wymagaj `License: MIT` w nagłówkach, `engine-strict=true` w `.npmrc`, `extends.*@anthropic-eslint` w configu.
- **Uwaga**: regex jest non-anchored, single-line. Backreferences nie są wspierane.

## Score formula

```
score = floor(passCount / totalRules * 100)
```

`unknown` (regex parse error, broken frontmatter) **nie wlicza się** do `totalRules` — score liczy tylko reguły z parsowalnym checkiem.

## Output formats

### `format: "json"` (default)

```json
{
  "score": 85,
  "findings": [
    { "rule": "readme-exists", "status": "pass", "evidence": "README.md found" },
    { "rule": "no-env-in-repo", "status": "fail", "evidence": ".env exists at root" }
  ]
}
```

### `format: "sarif"`

Output zawiera `sarif: { ... }` zgodne z SARIF 2.1.0 — gotowe do uploadu w GitHub
Code Scanning (`github/codeql-action/upload-sarif`). `findings` array nadal jest
w response — SARIF to bonus dla CI surfaces.

## Przykłady reguł

**`docs/standards/license-header.md`** (pattern):

```markdown
---
pattern: License:\s+MIT
---

Pliki źródłowe muszą mieć license header z MIT.
```

**`docs/standards/no-env-committed.md`** (must_not_exist):

```markdown
---
must_not_exist: .env
---

`.env` nie może być w repo (sekretne dane).
```

**`docs/standards/conventional-commits.md`** (must_exist):

```markdown
---
must_exist: commitlint.config.mjs
---

Repo musi mieć commitlint config żeby enforce'ować conventional commits.
```

## Praktyczne workflow

1. **Bootstrap standards**: `mkdir docs/standards && touch docs/standards/readme.md` → pisz reguły iteracyjnie.
2. **CI integration**: `compliance_report({ project_root: ".", standards_path: "docs/standards", format: "sarif" })` → upload SARIF do GitHub Code Scanning.
3. **Pre-release gate**: w `/full-audit` prompt — fail jeśli `score < 80`.

Pełen output schema → `Output` zod w [`src/tools/compliance-report.ts`](src/tools/compliance-report.ts).
