/**
 * Resource registry — natywny MCP feature `resources/list` + `resources/read`.
 *
 * Resources to read-only docs / configs / samples które Copilot Chat
 * może załadować deterministically jako kontekst (zamiast pytać "jakie
 * findings analyze_code rozpoznaje", server odsłania
 * `mcp-devtools://docs/analyze-findings-catalog`).
 *
 * Token saving:
 *   - cached przez Copilot — załaduj raz, użyj wielokrotnie;
 *   - deterministic content — żadnego LLM round-trip żeby "wyjaśnić";
 *   - structured URIs (`mcp-devtools://<category>/<slug>`) ułatwiają discovery.
 *
 * Mirror sibling `mcp-alm`: ta sama shape definicji żeby wiedza jednego repo
 * przenosiła się na drugie (różne use-case'y, identyczny kontrakt).
 *
 * @see src/server.ts — handlery `ListResourcesRequestSchema` + `ReadResourceRequestSchema`
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface ResourceDefinition {
  /** URI in format `<server>://<category>/<slug>` (e.g. `mcp-devtools://docs/analyze-findings-catalog`). */
  readonly uri: string;
  /** Display name in Copilot resource picker. */
  readonly name: string;
  /** One-liner — pokazuje się obok name. */
  readonly description: string;
  /** MIME type. Default `text/markdown` dla docs. */
  readonly mimeType: string;
  /** Async (read from fs) lub sync (inline string). Returns full content. */
  readonly read: () => Promise<string> | string;
}

/** Constructor preserving readonly contracts. */
export function defineResource(r: ResourceDefinition): ResourceDefinition {
  return r;
}

/**
 * Helper for `templates/resources/<file>.md` markdown docs. Resolves the path
 * relative to the compiled `dist/` location (via `import.meta.url`), so the
 * server works regardless of caller's `cwd` (`npx mcp-devtools` from anywhere).
 *
 * @example
 *   defineMarkdownResource({
 *     uri: 'mcp-devtools://docs/analyze-findings-catalog',
 *     name: 'analyze_code findings catalog',
 *     description: 'All finding kinds, what triggers each, suggested triage.',
 *     file: 'analyze-findings-catalog.md',
 *   })
 */
export function defineMarkdownResource(spec: {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly file: string;
}): ResourceDefinition {
  return {
    uri: spec.uri,
    name: spec.name,
    description: spec.description,
    mimeType: 'text/markdown',
    read: async () => {
      const url = new URL(`../../templates/resources/${spec.file}`, import.meta.url);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file slug is a hard-coded literal from caller
      return readFile(fileURLToPath(url), 'utf8');
    },
  };
}
