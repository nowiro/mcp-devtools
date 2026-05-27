# Wsparcie — mcp-devtools

Wybierz kanał odpowiedni dla swojego problemu.

## Pytania o użycie

- **Czytasz pierwszy raz?** → [README.md](README.md#quickstart)
- **Setup VS Code / IntelliJ** → [`docs/getting-started/vscode-setup.md`](docs/getting-started/vscode-setup.md) / [`docs/getting-started/intellij-setup.md`](docs/getting-started/intellij-setup.md)
- **Za firewallem korporacyjnym (proxy, prywatne CA)** → [`docs/how-to/corporate-proxy.md`](docs/how-to/corporate-proxy.md)
- **Coś nie działa** → [`docs/troubleshooting.md`](docs/troubleshooting.md)
- **Co znaczy ten kod błędu?** → [`docs/reference/error-codes.md`](docs/reference/error-codes.md)

Uruchom `npm run doctor` jako pierwsze — sprawdza Node version, `PROJECT_ROOT` resolution, Playwright availability, OS specifics (Windows vs macOS PATH).

## Bug reports / feature requests

Otwórz issue używając templatek:

- [Bug report](https://github.com/nowiro/mcp-devtools/issues/new?template=bug.yml)
- [Feature request (new tool)](https://github.com/nowiro/mcp-devtools/issues/new?template=feature.yml)

Przed otwarciem: poszukaj w istniejących issues (otwartych i zamkniętych) — duplikaty trafiają na koniec kolejki. Załącz output `npm run doctor` i informację o OS (`uname -a` / `[System.Environment]::OSVersion`).

## Podatności bezpieczeństwa

**NIE otwieraj publicznego issue.** Patrz [SECURITY.md](SECURITY.md) — prywatne disclosure przez [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).

Potwierdzenie otrzymania: 48 h. Plan remediacji dla critical: 14 dni.

## Code of Conduct — zgłoszenia

Patrz [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Zgłoszenia naruszeń przez prywatne kanały do maintainerów (GitHub private advisory albo e-mail ownerów z CODEOWNERS).

## Komercyjne wsparcie

Brak. Projekt jest community-maintained.

## Co nie jest wspierane

- **Podatności w samych Playwright / ESLint / Node.js** — zgłaszaj do upstreamu.
- **Custom tools poza pięcioma z głównego repo** — fork i utrzymuj u siebie; chętnie zobaczymy PR z uzasadnieniem dlaczego coś powinno wejść do core.
- **Wersje Node < 22** — twardo wymagane przez natywne `fetch`, `AbortSignal.any`, top-level await w ESM.
- **Cygwin / MSYS / Git Bash jako primary shell na Windows** — działa best-effort; primary targets to PowerShell 7+ i Windows Terminal.
