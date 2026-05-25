<!--
Conventional Commits: type(scope): subject
Types: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
Scopes: analyze-code | propose-fix | run-playwright | compliance | shared | server | types | log | ci | deps | docs | security
Example: feat(analyze-code): add ESLint findings category
-->

## Summary

<!-- 1–3 bullets. What changed and why. -->

## Linked

- Issue: #

## Security checklist

- [ ] No secrets or credentials in the diff
- [ ] Filesystem access is scoped to `PROJECT_ROOT`
- [ ] Tools do NOT mutate the repo without `apply: true`
- [ ] MCP server writes only to stderr (never stdout)
- [ ] `npm audit --audit-level=high` passes
- [ ] If a new HTTP path was added, SSRF + proxy + CA wiring is in place (port the pattern from `mcp-alm/src/shared/http-client.ts`)

## Definition of Done

- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes (`--max-warnings=0`)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Conventional commit message + PR title

## Test plan

<!-- Bulleted checklist a reviewer can re-run. -->

## Risk

<!-- What could break? Rollback plan? -->
