/**
 * Handlebars renderer — turns a `CompiledWorkflow` into the body of a
 * `.prompt.md` file.
 *
 * Template lives in `templates/prompt.md.hbs` at the repo root. Resolved
 * relative to this file so it works for both `src/` during dev and
 * `dist/cdk/core/render.js` after build (root is two `..` up from the
 * compiled file: `dist/cdk/core/` → `dist/` → repo root → `templates/`).
 */
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import Handlebars from 'handlebars';

import type { CompiledWorkflow } from './synth.js';

let cachedTemplate: HandlebarsTemplateDelegate | undefined;

function repoRoot(): string {
  // dist/cdk/core/render.js → ../../.. → repo root
  // src/cdk/core/render.ts  → ../../.. → repo root (same shape under tsc rootDir)
  return nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function loadTemplate(): HandlebarsTemplateDelegate {
  if (cachedTemplate) return cachedTemplate;
  registerHelpers();
  const templatePath = nodePath.resolve(repoRoot(), 'templates', 'prompt.md.hbs');
  const source = readFileSync(templatePath, 'utf8');
  cachedTemplate = Handlebars.compile(source, { noEscape: true });
  return cachedTemplate;
}

function safeString(input: unknown): string {
  if (input === null || input === undefined) return '';
  return typeof input === 'string' ? input : JSON.stringify(input);
}

function registerHelpers(): void {
  Handlebars.registerHelper('kebab', (input: unknown) =>
    safeString(input)
      .replaceAll(/([a-z\d])([A-Z])/g, '$1-$2')
      .replaceAll(/[_\s]+/g, '-')
      .toLowerCase(),
  );
  Handlebars.registerHelper('pascal', (input: unknown) =>
    safeString(input)
      .replaceAll(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^./, (c) => c.toUpperCase()),
  );
  Handlebars.registerHelper('json', (input: unknown) => JSON.stringify(input, null, 2));
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
}

/** Render a compiled workflow into the body of a `.prompt.md` file. */
export function renderWorkflow(compiled: CompiledWorkflow): string {
  return loadTemplate()(compiled);
}

/** Reset cache — test-only. */
export function _resetCache(): void {
  cachedTemplate = undefined;
}
