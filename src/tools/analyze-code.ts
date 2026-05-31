/**
 * analyze_code — static analysis findings + per-framework metrics for a file or directory.
 *
 * v1.2: framework-agnostic. The tool walks any TS / TSX / JS / JSX / HTML / VUE
 * tree, surfaces generic findings (console.*, TODO / FIXME) and — when a
 * framework is detected or explicitly selected — adds framework-specific
 * metrics + legacy-pattern detectors.
 *
 * Supported frameworks:
 *   - `angular` — components, services, signal()/computed()/inject(), OnPush, standalone,
 *                 legacy *ngIf / *ngFor / *ngSwitch.
 *   - `react`   — useState/useEffect/useMemo usages, class components (legacy),
 *                 dangerouslySetInnerHTML.
 *   - `vue`     — defineComponent / defineProps / defineEmits, .vue SFC count.
 *   - `none`    — generic findings only.
 *   - `auto`    — detect from imports / decorators / file extensions (default).
 *
 * Out of scope: spawning `tsc --noEmit` or `eslint --format json`. Those
 * require the target's node_modules and config — the orchestrator should
 * call them directly when needed.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import nodePath from 'node:path';
import { z } from 'zod';

import { assertWithinSandbox } from '../shared/sandbox.js';
import type { ToolDefinition } from '../shared/types.js';

// ── Schemas ─────────────────────────────────────────────────────────────────

export const Framework = z.enum(['auto', 'angular', 'react', 'vue', 'none']);

export const Input = z.object({
  path: z.string().min(1),
  depth: z.number().int().min(0).max(5).default(3),
  metrics: z.boolean().default(true),
  framework: Framework.default('auto'),
});

const AngularMetricsSchema = z.object({
  components: z.number().int().min(0),
  services: z.number().int().min(0),
  signal_usages: z.number().int().min(0),
  computed_usages: z.number().int().min(0),
  inject_usages: z.number().int().min(0),
  standalone_components: z.number().int().min(0),
  onpush_components: z.number().int().min(0),
});

const ReactMetricsSchema = z.object({
  function_components: z.number().int().min(0),
  class_components: z.number().int().min(0),
  use_state: z.number().int().min(0),
  use_effect: z.number().int().min(0),
  use_memo: z.number().int().min(0),
  use_callback: z.number().int().min(0),
});

const VueMetricsSchema = z.object({
  sfc_files: z.number().int().min(0),
  define_component: z.number().int().min(0),
  define_props: z.number().int().min(0),
  define_emits: z.number().int().min(0),
});

const MetricsSchema = z.object({
  files_scanned: z.number().int().min(0),
  total_lines: z.number().int().min(0),
  todo_count: z.number().int().min(0),
  angular: AngularMetricsSchema.optional(),
  react: ReactMetricsSchema.optional(),
  vue: VueMetricsSchema.optional(),
});

export const Output = z.object({
  framework: z.enum(['angular', 'react', 'vue', 'none']),
  findings: z.array(
    z.object({
      kind: z.enum(['console-log', 'legacy-pattern', 'todo', 'dangerous-html', 'debugger']),
      severity: z.enum(['info', 'warning', 'error']),
      file: z.string(),
      line: z.number().int().min(1).optional(),
      msg: z.string(),
    }),
  ),
  metrics: MetricsSchema.optional(),
  cache_hit: z.boolean(),
});

type InputT = z.infer<typeof Input>;
type OutputT = z.infer<typeof Output>;
type DetectedFramework = 'angular' | 'react' | 'vue' | 'none';

// ── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  readonly mtime: number;
  readonly result: OutputT;
}
const cache = new Map<string, CacheEntry>();

/** Test-only hook. */
export function _resetCache(): void {
  cache.clear();
}

// ── File walk ───────────────────────────────────────────────────────────────

const SUPPORTED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|html|vue)$/;

async function* walkSource(root: string, depth: number): AsyncGenerator<string> {
  async function* walk(directory: string, depthLeft: number): AsyncGenerator<string> {
    if (depthLeft < 0) return;
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const { name } = entry;
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'coverage' || name === 'build')
        continue;
      const full = nodePath.resolve(directory, name);
      if (entry.isDirectory()) yield* walk(full, depthLeft - 1);
      else if (entry.isFile() && SUPPORTED_EXT.test(name) && !name.endsWith('.d.ts')) yield full;
    }
  }
  yield* walk(root, depth);
}

// ── Framework detection ─────────────────────────────────────────────────────

const ANGULAR_HINTS = /from\s+['"]@angular\/|@Component\s*\(|@Injectable\s*\(/;
const REACT_HINTS = /from\s+['"]react['"]|from\s+['"]react\/|useState\s*\(|useEffect\s*\(/;
const VUE_HINTS = /from\s+['"]vue['"]|defineComponent\s*\(|defineProps\s*[<(]/;

/**
 * Scan up to 50 file heads (~4 KB each) to guess the framework. First match wins.
 * Returns 'none' if no hints found.
 */
async function detectFramework(files: string[]): Promise<DetectedFramework> {
  const sample = files.slice(0, 50);
  for (const file of sample) {
    if (file.endsWith('.vue')) return 'vue';
    const text = await readFile(file, 'utf8').catch(() => '');
    if (!text) continue;
    const head = text.slice(0, 4096);
    if (ANGULAR_HINTS.test(head)) return 'angular';
    if (REACT_HINTS.test(head)) return 'react';
    if (VUE_HINTS.test(head)) return 'vue';
  }
  return 'none';
}

// ── Per-framework counters ──────────────────────────────────────────────────

export interface AngularMetrics {
  components: number;
  services: number;
  signals: number;
  computeds: number;
  injects: number;
  standalones: number;
  onpushes: number;
}

export function countAngularMetrics(text: string): AngularMetrics {
  return {
    components: (text.match(/@Component\s*\(/g) ?? []).length,
    services: (text.match(/@Injectable\s*\(/g) ?? []).length,
    signals: (text.match(/(?<![.\w])signal\s*</g) ?? []).length + (text.match(/(?<![.\w])signal\s*\(/g) ?? []).length,
    computeds: (text.match(/(?<![.\w])computed\s*\(/g) ?? []).length,
    injects: (text.match(/(?<![.\w])inject\s*\(/g) ?? []).length,
    standalones: (text.match(/standalone\s*:\s*true/g) ?? []).length,
    onpushes: (text.match(/ChangeDetectionStrategy\.OnPush/g) ?? []).length,
  };
}

export interface ReactMetrics {
  function_components: number;
  class_components: number;
  use_state: number;
  use_effect: number;
  use_memo: number;
  use_callback: number;
}

export function countReactMetrics(text: string): ReactMetrics {
  return {
    // Heuristic: `export default function X` or `const X = (...) =>` followed by JSX. Cheap proxy.
    function_components: (text.match(/(?:export\s+(?:default\s+)?)?function\s+[A-Z][\w]*\s*\(/g) ?? []).length,
    class_components: (text.match(/class\s+[A-Z][\w]*\s+extends\s+(?:React\.)?Component/g) ?? []).length,
    use_state: (text.match(/(?<![.\w])useState\s*[<(]/g) ?? []).length,
    use_effect: (text.match(/(?<![.\w])useEffect\s*\(/g) ?? []).length,
    use_memo: (text.match(/(?<![.\w])useMemo\s*[<(]/g) ?? []).length,
    use_callback: (text.match(/(?<![.\w])useCallback\s*[<(]/g) ?? []).length,
  };
}

export interface VueMetrics {
  sfc_files: number;
  define_component: number;
  define_props: number;
  define_emits: number;
}

export function countVueMetrics(text: string, isSfc: boolean): VueMetrics {
  return {
    sfc_files: isSfc ? 1 : 0,
    define_component: (text.match(/(?<![.\w])defineComponent\s*\(/g) ?? []).length,
    define_props: (text.match(/(?<![.\w])defineProps\s*[<(]/g) ?? []).length,
    define_emits: (text.match(/(?<![.\w])defineEmits\s*[<(]/g) ?? []).length,
  };
}

// ── Findings detectors ─────────────────────────────────────────────────────

const CONSOLE_RE = /\bconsole\.(log|warn|error|debug|info)\b/;
const DEBUGGER_RE = /\bdebugger\b\s*;/;
const TODO_RE = /\b(TODO|FIXME|XXX|HACK)\b[:\s]/;
const ANGULAR_LEGACY_RE = /\*ngIf|\*ngFor|\*ngSwitch/;

function scanLines(
  file: string,
  text: string,
  framework: DetectedFramework,
  findings: OutputT['findings'],
): { lines: number; todos: number } {
  const lines = text.split('\n');
  let todos = 0;
  for (const [i, line] of lines.entries()) {
    if (CONSOLE_RE.test(line)) {
      findings.push({
        kind: 'console-log',
        severity: 'warning',
        file,
        line: i + 1,
        msg: 'console.* call — prefer structured logger',
      });
    }
    if (DEBUGGER_RE.test(line)) {
      findings.push({
        kind: 'debugger',
        severity: 'warning',
        file,
        line: i + 1,
        msg: 'leftover debugger statement — remove before commit',
      });
    }
    if (TODO_RE.test(line)) {
      todos += 1;
      findings.push({
        kind: 'todo',
        severity: 'info',
        file,
        line: i + 1,
        msg: line.trim().slice(0, 200),
      });
    }
    if (framework === 'angular' && ANGULAR_LEGACY_RE.test(line)) {
      findings.push({
        kind: 'legacy-pattern',
        severity: 'error',
        file,
        line: i + 1,
        msg: 'legacy structural directive — use @if / @for / @switch (Angular 17+)',
      });
    }
    if (framework === 'react' && line.includes('dangerouslySetInnerHTML')) {
      findings.push({
        kind: 'dangerous-html',
        severity: 'warning',
        file,
        line: i + 1,
        msg: 'dangerouslySetInnerHTML — XSS risk, sanitize input',
      });
    }
  }
  return { lines: lines.length, todos };
}

// ── Main handler ───────────────────────────────────────────────────────────

export const definition: ToolDefinition<InputT, OutputT> = {
  name: 'analyze_code',
  description:
    'Static analysis of a TS/TSX/JS/JSX/HTML/Vue tree (slow O(files × depth), capped at depth=5). Reports generic findings (console.*, debugger, TODO/FIXME, dangerouslySetInnerHTML) + per-framework metrics + legacy patterns. Frameworks: angular/react/vue (auto-detected). mtime-cached — cache hits are O(1).',
  inputSchema: Input,
  outputSchema: Output,
  async handle(input, ctx) {
    const { path, depth, metrics, framework: requested } = Input.parse(input);
    const resolvedPath = assertWithinSandbox(path, ctx.projectRoot, 'analyze_code');

    const stats = await stat(resolvedPath).catch(() => null);
    if (!stats) {
      return Output.parse({ framework: 'none', findings: [], cache_hit: false });
    }

    const cacheKey = `${resolvedPath}|d=${depth}|m=${metrics}|f=${requested}`;
    const cached = cache.get(cacheKey);
    if (cached?.mtime === stats.mtimeMs) {
      return { ...cached.result, cache_hit: true };
    }

    // Collect files once — needed for both detection and analysis.
    const allFiles: string[] = [];
    for await (const file of walkSource(resolvedPath, depth)) {
      allFiles.push(file);
    }

    const framework: DetectedFramework = requested === 'auto' ? await detectFramework(allFiles) : requested;

    let total_lines = 0;
    let todo_count = 0;
    const angular: AngularMetrics = {
      components: 0,
      services: 0,
      signals: 0,
      computeds: 0,
      injects: 0,
      standalones: 0,
      onpushes: 0,
    };
    const react: ReactMetrics = {
      function_components: 0,
      class_components: 0,
      use_state: 0,
      use_effect: 0,
      use_memo: 0,
      use_callback: 0,
    };
    const vue: VueMetrics = {
      sfc_files: 0,
      define_component: 0,
      define_props: 0,
      define_emits: 0,
    };
    const findings: OutputT['findings'] = [];

    for (const file of allFiles) {
      const text = await readFile(file, 'utf8').catch(() => '');
      if (!text) continue;

      if (framework === 'angular') {
        const a = countAngularMetrics(text);
        angular.components += a.components;
        angular.services += a.services;
        angular.signals += a.signals;
        angular.computeds += a.computeds;
        angular.injects += a.injects;
        angular.standalones += a.standalones;
        angular.onpushes += a.onpushes;
      } else if (framework === 'react') {
        const r = countReactMetrics(text);
        react.function_components += r.function_components;
        react.class_components += r.class_components;
        react.use_state += r.use_state;
        react.use_effect += r.use_effect;
        react.use_memo += r.use_memo;
        react.use_callback += r.use_callback;
      } else if (framework === 'vue') {
        const v = countVueMetrics(text, file.endsWith('.vue'));
        vue.sfc_files += v.sfc_files;
        vue.define_component += v.define_component;
        vue.define_props += v.define_props;
        vue.define_emits += v.define_emits;
      }

      const scanned = scanLines(file, text, framework, findings);
      total_lines += scanned.lines;
      todo_count += scanned.todos;
    }

    const metricsPayload = metrics
      ? {
          files_scanned: allFiles.length,
          total_lines,
          todo_count,
          ...(framework === 'angular'
            ? {
                angular: {
                  components: angular.components,
                  services: angular.services,
                  signal_usages: angular.signals,
                  computed_usages: angular.computeds,
                  inject_usages: angular.injects,
                  standalone_components: angular.standalones,
                  onpush_components: angular.onpushes,
                },
              }
            : {}),
          ...(framework === 'react' ? { react } : {}),
          ...(framework === 'vue' ? { vue } : {}),
        }
      : undefined;

    const result = Output.parse({
      framework,
      findings,
      metrics: metricsPayload,
      cache_hit: false,
    });
    cache.set(cacheKey, { mtime: stats.mtimeMs, result });
    return result;
  },
};
