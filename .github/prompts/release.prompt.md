---
mode: agent
description: Uruchom release flow — bump wersji, regeneracja CHANGELOG, tag
tools: ['editFiles', 'search', 'runCommands', 'runTasks', 'problems']
---

# Release

Uruchamia proces release dla mcp-devtools — **lokalnie, repo nie używa GitHub Actions**. Działa identycznie na Windows (PowerShell) i macOS/Linux (bash/zsh) — wszystkie kroki używają `npm` + `git`.

## Inputs

- `${input:notes:Optional release-notes one-liner}` — krótkie description dla CHANGELOG headline

## Co robić

1. Pre-flight gate (odmów on red):
   - `npm run verify` (format + lint + typecheck + test + build)
   - `npm run doctor` (wszystkie ✓ lub ⚠ — żadnych ✗)
   - Working tree clean (`git status --porcelain` jest empty)
   - Aktualny branch to `main`
2. Określ version bump z Conventional Commits od ostatniego tagu:
   - `feat` → minor
   - `fix` / `perf` → patch
   - `feat!` lub `BREAKING CHANGE:` w body → major
3. Regeneruj `CHANGELOG.md` z commitów (`conventional-changelog` lub równoważne). Wstaw opcjonalną linię `${notes}` pod nową version header.
4. Update `package.json` version.
5. Commit `chore(release): vX.Y.Z` (Conventional Commits, no `[skip ci]`).
6. Tag `vX.Y.Z` (annotated, z release notes w message).
7. Push commita i tag: `git push && git push --tags`. **Publikacja jest ręczna** (brak GitHub Actions) — `npm publish --provenance --access public` (wymaga `npm login` / `NPM_TOKEN` w env). GitHub Release utwórz ręcznie, jeśli chcesz.
8. End-of-turn: blok `done:` z nową wersją i link do release page.

## Nie

- Bypassuj verify gate (`--no-verify`, `git commit --amend` na release commicie).
- Force-push release brancha lub tagów.
- Dodawaj unrelated zmiany do release commita.
- Edytuj CHANGELOG ręcznie poza headline'em — pełna treść z conventional-changelog.
