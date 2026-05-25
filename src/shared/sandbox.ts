/**
 * Sandbox filesystem guard — every tool that consumes a path from user input
 * MUST run it through `assertWithinSandbox` before any I/O. The resolver:
 *
 *   1. Treats absolute candidates verbatim (`/etc/passwd`, `C:\Windows`).
 *   2. Resolves relative candidates against `sandboxRoot` (NOT `process.cwd()`)
 *      so an LLM that says `path: 'src/feature'` always means "the feature
 *      folder inside the workspace", regardless of where the server was launched
 *      from.
 *   3. Throws if the result is not `sandboxRoot` itself or a descendant.
 *
 * Returns the resolved absolute path so callers can pass it straight to I/O.
 */
import nodePath from 'node:path';

export function assertWithinSandbox(candidate: string, sandboxRoot: string, toolName: string): string {
  const root = nodePath.resolve(sandboxRoot);
  const resolved = nodePath.resolve(root, candidate);
  const prefix = root.endsWith(nodePath.sep) ? root : `${root}${nodePath.sep}`;
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new Error(`${toolName}: path ${candidate} escapes sandbox ${root}`);
  }
  return resolved;
}
