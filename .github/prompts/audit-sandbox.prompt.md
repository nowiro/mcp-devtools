---
mode: agent
description: Verify that no tool escapes PROJECT_ROOT (path traversal, symlinks, glob over-reach)
---

# Audyt sandbox FS

Cel: udowodnić że żadne narzędzie `mcp-devtools` nie ucieka z `PROJECT_ROOT`.

## Check-list

1. **`assertWithinSandbox` na każdej input-ścieżce** — każdy tool używa wspólnego helpera z [`src/shared/sandbox.ts`](../../src/shared/sandbox.ts):

   ```ts
   import { assertWithinSandbox } from '../shared/sandbox.js';

   async handle(input, ctx) {
     const { path } = Input.parse(input);
     const resolved = assertWithinSandbox(path, ctx.projectRoot, '<tool_name>');
     // …I/O z `resolved`, nie `path`
   }
   ```

   Helper resolwuje relatywne ścieżki vs `sandboxRoot` (NIE `cwd`) i throw'uje
   `<tool>: path X escapes sandbox Y` gdy resultant path nie jest pod root.

2. **Brak raw `readFile` / `readdir` / `stat`** z raw user input — wszystko
   przez `resolved` z `assertWithinSandbox`.

3. **Symlinks** — explicit decyzja per tool. Default: nie follow'uj (przejdź
   przez `lstat` / `realpath` jeśli musisz).

4. **Glob over-reach** — żaden tool nie używa `**/*` bez prefix root'a.

5. **Spawn cwd** — `run_playwright` resolve'uje `project_root` przez
   `assertWithinSandbox` przed `spawn('npx', ...)` (patrz
   `src/tools/run-playwright.ts`).

## Verification

```sh
# Każdy tool plikowy powinien importować assertWithinSandbox:
grep -L "assertWithinSandbox" src/tools/{analyze-code,propose-fix,run-playwright,compliance-report}.ts
# (powinno zwrócić pusty wynik — wszystkie 4 mają helper)
```

## Negative tests

W każdym `src/tools/<tool>.spec.ts` jest test path-escape:

```ts
it('throws when path escapes the sandbox', async () => {
  await expect(
    definition.handle({ path: '../../../etc/passwd' /* … */ }, { ...ctx, projectRoot: tempDir }),
  ).rejects.toThrow(/escapes sandbox/);
});
```

Spec dla samego helpera → [`src/shared/sandbox.spec.ts`](../../src/shared/sandbox.spec.ts).
