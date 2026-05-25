/**
 * Correlation IDs — one per MCP `tools/call`. Threaded through the stderr log
 * line for that call so a tool failure can be traced back to the exact
 * invocation that triggered it.
 *
 * Generation: native Node `crypto.randomUUID()` (Node 22+ ships this stable).
 *
 * Accepting an inbound id: MCP `_meta` is optional under the spec; we look for
 * a `correlationId` (or `requestId`) field and reuse it when present. This lets
 * an orchestrator stitch its own trace id through downstream MCP servers.
 */
import { randomUUID } from 'node:crypto';

const MAX_LENGTH = 128;
const SAFE_CHARS = /^[\w.:-]+$/;

/**
 * Pick a correlation id from an optional MCP `_meta` bag, falling back to a
 * freshly generated UUID. Any non-string / overlong / weirdly-charactered value
 * is rejected — we never echo arbitrary client input into logs.
 */
export function correlationIdFromMeta(meta: unknown): string {
  if (meta !== null && typeof meta === 'object') {
    const bag = meta as Record<string, unknown>;
    for (const key of ['correlationId', 'requestId', 'x-request-id']) {
      const raw = bag[key];
      if (typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_LENGTH && SAFE_CHARS.test(raw)) {
        return raw;
      }
    }
  }
  return randomUUID();
}
