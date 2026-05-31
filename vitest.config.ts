import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration. Eksplicytna konfiguracja zamiast defaultów —
 * daje deterministyczny wybór testów / reporterów w CI i pozwala kontrolować
 * coverage thresholds gdy baseline jest zmierzony.
 *
 * Cross-platform: testy używają tmpdir() z node:os (zwraca poprawny path
 * dla Windows i POSIX), więc nie zakładają konkretnego separator stylu.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'tools/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    environment: 'node',
    reporters: process.env['CI'] ? ['default', 'junit'] : ['default'],
    outputFile: {
      junit: './coverage/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        // Server entrypoint — orkiestracja, pokryta testami integracyjnymi gdy powstaną.
        'src/server.ts',
        // CDK workflows compile do .github/prompts/*.md — testowane przez kompilator, nie unit.
        'src/cdk/workflows/**',
      ],
      thresholds: {
        // Zmierzony floor (2026-05-31, ~72% lines) — blokuje regresję poniżej obecnego pokrycia.
        // Cel długoterminowy: shared/ + tools/ ≥ 80%, całość ≥ 70%.
        lines: 68,
        functions: 62,
        branches: 58,
        statements: 64,
      },
    },
  },
});
