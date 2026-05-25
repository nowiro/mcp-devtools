import vitestPlugin from '@vitest/eslint-plugin';
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

/**
 * Konfiguracja ESLint — równolegle z sibling `mcp-alm` (twin parity).
 *
 * Bazowe presety:
 *   - `js.configs.recommended`                   — sanity rules dla każdego JS.
 *   - `tseslint.configs.strictTypeChecked`       — strict + type-aware TS.
 *   - `tseslint.configs.stylisticTypeChecked`    — drobne preferencje stylu.
 *   - `eslint-config-prettier`                   — wyłącza reguły kolidujące z Prettier.
 *
 * Pluginy jakości (dodane wybiórczo, nie wszystkie domyślne):
 *   - `eslint-plugin-security`   — wykrywa eval / child_process / regex DoS / fs path
 *                                  injection. Istotne dla narzędzia spawnującego
 *                                  `npx playwright test` (`run_playwright`) i czytającego
 *                                  dowolny PROJECT_ROOT.
 *   - `eslint-plugin-promise`    — czysty async/await (no-return-wrap, prefer-await,
 *                                  no-nesting). Cała powierzchnia MCP jest async.
 *   - `eslint-plugin-import-x`   — higiena importów (no-cycle, no-self-import,
 *                                  no-duplicates, consistent-type-imports parity).
 *   - `@vitest/eslint-plugin`    — reguły dla testów (no-focused-tests,
 *                                  consistent-test-it, expect-expect).
 *
 * Świadomie pominięte: `sonarjs`, `unicorn`, `jsdoc` — w tym repo generowałyby
 * więcej szumu niż sygnału przy `--max-warnings=0` (kontrakt twin z mcp-alm).
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'tools/**',
      'docs/**',
      'templates/**',
      '*.js',
      '*.mjs',
      '*.cjs',
      '*.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── eslint-plugin-security (selektywnie) ─────────────────────────────────
  {
    plugins: { security: securityPlugin },
    rules: {
      'security/detect-child-process': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      // Wyłączone — szumi przy zamierzonych dynamicznych operacjach (np. czytanie
      // walidowanych przez sandbox ścieżek z PROJECT_ROOT).
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },

  // ── eslint-plugin-promise (selected) ─────────────────────────────────────
  {
    plugins: { promise: promisePlugin },
    rules: {
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'warn',
      'promise/no-nesting': 'warn',
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'warn',
      'promise/valid-params': 'warn',
      'promise/prefer-await-to-then': 'warn',
    },
  },

  // ── eslint-plugin-import-x ───────────────────────────────────────────────
  {
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-cycle': ['error', { maxDepth: 5 }],
      'import-x/no-self-import': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-empty-named-blocks': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'warn',
      'import-x/no-useless-path-segments': 'warn',
    },
    settings: {
      'import-x/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
  },

  // ── Reguły specyficzne dla projektu ──────────────────────────────────────
  {
    rules: {
      // MCP servers MUST NOT write to stdout — use src/shared/log.ts (stderr).
      'no-console': 'error',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      // Placeholder tool stubs occasionally have no awaits.
      '@typescript-eslint/require-await': 'off',
      // MCP SDK Server class deprecation — migration is a separate task.
      '@typescript-eslint/no-deprecated': 'off',
    },
  },

  // ── non-literal-fs-filename: legalne false-positives ───────────────────────
  // Wszystkie poniższe pliki czytają / piszą do ścieżek wcześniej walidowanych
  // przez `assertWithinSandbox()` (`src/shared/sandbox.ts`) lub do ścieżek
  // pochodzących z committed konfiguracji (CDK template render). Ścieżki NIE
  // pochodzą z untrusted runtime input — non-literal-fs-filename to false
  // positive. Reguła pozostaje `warn` dla reszty `src/`.
  {
    files: ['src/tools/**/*.ts', 'src/cli/**/*.ts', 'src/cdk/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // ── unsafe-regex: bounded-input heuristic patterns ─────────────────────────
  // `countReactMetrics` używa nested optionals w regex do detekcji React
  // function components. Input zawsze pochodzi z `readFile()` na pliku
  // ograniczonym do 4 KB head (per `scanLines`) — catastrophic backtracking
  // niemożliwy w tym budżecie.
  {
    files: ['src/tools/analyze-code.ts'],
    rules: {
      'security/detect-unsafe-regex': 'off',
    },
  },

  // ── Pliki testowe ────────────────────────────────────────────────────────
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      'vitest/expect-expect': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/consistent-test-it': ['warn', { fn: 'it' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'promise/prefer-await-to-then': 'off',
    },
  },

  // ── Prettier reconciliation (must be last) ───────────────────────────────
  prettierConfig,
);
