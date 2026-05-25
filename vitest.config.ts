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
    include: ['src/**/*.spec.ts'],
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
        // Niskie progi startowe — podnieść po zmierzeniu baseline.
        // Cel: shared/ i tools/ ≥ 80%, całość ≥ 70%.
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
});
