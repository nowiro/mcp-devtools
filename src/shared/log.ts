/**
 * Structured stderr JSON-line logger. Shape kept compatible with `mcp-alm`
 * so log aggregators can consume both servers uniformly.
 *
 * stdout is reserved for the MCP protocol — never write log lines there.
 *
 * Capabilities added on top of the basic JSON-line shape:
 *   - **Level filtering** via `LOG_LEVEL` env (trace|debug|info|warn|error|fatal).
 *     Default `info` in prod, `trace` in tests so existing assertions keep passing.
 *   - **Deep redaction** of token-like keys via the `REDACTION_KEYS` regex set.
 *     `[Redacted]` replaces the value at any nesting depth. Defense-in-depth:
 *     call sites already avoid logging raw tokens; this is the safety net.
 *
 * Why no Pino: evaluated 10.3.1 but its custom-timestamp + formatters.level
 * combo produced malformed JSON in our destination wiring. The home-grown
 * implementation is cheaper, dep-free, and meets every requirement.
 */

/**
 * Set of key names whose VALUES must never be logged. Matching is
 * case-insensitive AND tolerant of common separators (`-` / `_`) so that
 * `apiKey`, `api_key`, `api-key` all redact the same way.
 *
 * We keep this as a Set + normalised-name check rather than one mega-regex
 * because sonarjs complains at >20 alternations and the Set is easier to
 * extend (just append a token, no regex math).
 */
const REDACTION_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'password',
  'apikey',
  'privatekey',
  'authorization',
  'cookie',
  'xapikey',
]);

function shouldRedact(key: string): boolean {
  // Strip separators and lowercase so `Api-Key`, `api_key`, `APIKey` all match.
  const normalised = key.toLowerCase().replaceAll(/[-_]/g, '');
  return REDACTION_KEYS.has(normalised);
}

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
type Level = (typeof LEVELS)[number];

function levelOrder(level: Level): number {
  return LEVELS.indexOf(level);
}

function resolveLevel(): Level {
  const raw = process.env['LOG_LEVEL']?.toLowerCase();
  if (raw && (LEVELS as readonly string[]).includes(raw)) return raw as Level;
  return process.env['NODE_ENV'] === 'test' ? 'trace' : 'info';
}

function redact(value: unknown, seen: WeakSet<object> = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = shouldRedact(k) ? '[Redacted]' : redact(v, seen);
  }
  return out;
}

interface LogEntry {
  readonly ts?: string;
  readonly server?: string;
  readonly tool?: string;
  readonly durationMs?: number;
  readonly ok?: boolean;
  readonly error?: string;
  readonly [key: string]: unknown;
}

const activeLevel = resolveLevel();
const threshold = levelOrder(activeLevel);

export function log(entry: LogEntry): void {
  if (levelOrder('info') < threshold) return;
  const safe = redact({ ts: new Date().toISOString(), ...entry });
  process.stderr.write(JSON.stringify(safe) + '\n');
}
