# Contributing — mcp-devtools

Serwer MCP z 5 narzędziami dev-workflow + CDK do generowania prompts SDD. Tools to PRYMITYWY — reasoning żyje w Copilot Chat.

## TL;DR

1. Branchuj z `main`. `feat/` / `fix/` / `chore/` / `docs/`.
2. `npm ci && npm run verify` — green baseline (Quickstart → [README](README.md#quickstart)).
3. Najmniejsza rozsądna zmiana. Dodaj testy.
4. Conventional commit (`type(scope): subject`) — wymuszany przez husky `commit-msg` + commitlint. Pre-commit dodatkowo `lint-staged` (ESLint + Prettier). Użyj `npm run commit` dla interaktywnego prompta.
5. PR z wypełnionym [template](.github/PULL_REQUEST_TEMPLATE.md). Definition of Done → [`.github/copilot-instructions.md`](.github/copilot-instructions.md#validation-gate).

## Standardy kodowania

Reguły w [`.github/instructions/`](.github/instructions/):

- [core](.github/instructions/core.instructions.md) — DRY/SOLID/KISS/YAGNI/comments.
- [security](.github/instructions/security.instructions.md) — sandbox FS, SSRF, secrets policy.
- [tool-contract](.github/instructions/tool-contract.instructions.md) — kontrakt każdego toola.

## Dodanie nowego narzędzia

Patrz [`docs/how-to/add-tool.md`](docs/how-to/add-tool.md) i [`.github/prompts/new-tool.prompt.md`](.github/prompts/new-tool.prompt.md).

## Security issues

Nie otwieraj publicznego issue. [SECURITY.md](SECURITY.md) opisuje private disclosure.

## Code of conduct + licencja

Stosujemy [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Kontrybuując zgadzasz się, że Twój wkład jest pod [MIT](LICENSE).
