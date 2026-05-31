/**
 * Unit tests — analyze_code metrics + cache + framework detection.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _resetCache, countAngularMetrics, countReactMetrics, countVueMetrics, definition } from './analyze-code.js';

describe('countAngularMetrics', () => {
  it('counts @Component / @Injectable decorators', () => {
    const code = `@Component({ standalone: true })\nclass A {}\n@Injectable()\nclass B {}`;
    const m = countAngularMetrics(code);
    expect(m.components).toBe(1);
    expect(m.services).toBe(1);
    expect(m.standalones).toBe(1);
  });

  it('counts signal() / computed() / inject() calls', () => {
    const code = `const x = signal(0);\nconst y = computed(() => x() * 2);\nconst svc = inject(MyService);`;
    const m = countAngularMetrics(code);
    expect(m.signals).toBe(1);
    expect(m.computeds).toBe(1);
    expect(m.injects).toBe(1);
  });

  it('does not count method-call lookalikes like obj.signal()', () => {
    const code = `obj.signal();\nclass.computed();\nthis.inject();`;
    const m = countAngularMetrics(code);
    expect(m.signals).toBe(0);
    expect(m.computeds).toBe(0);
    expect(m.injects).toBe(0);
  });

  it('counts OnPush', () => {
    const code = `changeDetection: ChangeDetectionStrategy.OnPush`;
    expect(countAngularMetrics(code).onpushes).toBe(1);
  });
});

describe('countReactMetrics', () => {
  it('counts useState / useEffect / useMemo / useCallback', () => {
    const code = `const [a, setA] = useState(0);\nuseEffect(() => {}, []);\nconst v = useMemo(() => 1, []);\nconst cb = useCallback(() => {}, []);`;
    const m = countReactMetrics(code);
    expect(m.use_state).toBe(1);
    expect(m.use_effect).toBe(1);
    expect(m.use_memo).toBe(1);
    expect(m.use_callback).toBe(1);
  });

  it('detects legacy class components extending React.Component', () => {
    const code = `class MyView extends React.Component {}\nclass Other extends Component {}`;
    const m = countReactMetrics(code);
    expect(m.class_components).toBe(2);
  });
});

describe('countVueMetrics', () => {
  it('counts defineComponent / defineProps / defineEmits', () => {
    const code = `defineComponent({});\ndefineProps<{ x: number }>();\ndefineEmits<{ change: [n: number] }>();`;
    const m = countVueMetrics(code, false);
    expect(m.define_component).toBe(1);
    expect(m.define_props).toBe(1);
    expect(m.define_emits).toBe(1);
    expect(m.sfc_files).toBe(0);
  });

  it('flags SFC when path ends in .vue', () => {
    expect(countVueMetrics('', true).sfc_files).toBe(1);
  });
});

describe('analyze_code handler — angular', () => {
  let directory: string;

  beforeEach(async () => {
    _resetCache();
    directory = await mkdtemp(nodePath.join(tmpdir(), 'analyze-code-ng-'));
    await mkdir(nodePath.join(directory, 'src'), { recursive: true });
    await writeFile(
      nodePath.join(directory, 'src', 'a.ts'),
      `import { signal, computed } from '@angular/core';\nconst x = signal(0);\nconsole.log('hi');\n// TODO: handle error\n`,
    );
    await writeFile(
      nodePath.join(directory, 'src', 'b.component.html'),
      `<div *ngIf="x">hello</div>\n<span>{{ y }}</span>\n`,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const testContext = { log: () => undefined, projectRoot: '' };
  const baseInput = (d: string): { path: string; depth: number; metrics: boolean; framework: 'auto' } => ({
    path: d,
    depth: 3,
    metrics: true,
    framework: 'auto',
  });

  it('auto-detects angular from @angular/core import', async () => {
    const out = await definition.handle(baseInput(directory), { ...testContext, projectRoot: directory });
    expect(out.framework).toBe('angular');
  });

  it('emits console-log finding and legacy-pattern finding for *ngIf', async () => {
    const out = await definition.handle(baseInput(directory), { ...testContext, projectRoot: directory });
    expect(out.findings.some((f) => f.kind === 'console-log')).toBe(true);
    expect(out.findings.some((f) => f.kind === 'legacy-pattern')).toBe(true);
  });

  it('emits TODO finding', async () => {
    const out = await definition.handle(baseInput(directory), { ...testContext, projectRoot: directory });
    expect(out.findings.some((f) => f.kind === 'todo')).toBe(true);
  });

  it('reports angular.signal_usages > 0 when signal() is present', async () => {
    const out = await definition.handle(baseInput(directory), { ...testContext, projectRoot: directory });
    expect(out.metrics?.angular?.signal_usages).toBeGreaterThan(0);
  });

  it('returns cache_hit=true on the second call with unchanged mtime', async () => {
    await definition.handle(baseInput(directory), { ...testContext, projectRoot: directory });
    const out = await definition.handle(baseInput(directory), { ...testContext, projectRoot: directory });
    expect(out.cache_hit).toBe(true);
  });

  it('throws when path escapes the sandbox', async () => {
    await expect(
      definition.handle(
        { path: '../../../etc', depth: 3, metrics: true, framework: 'auto' },
        { ...testContext, projectRoot: directory },
      ),
    ).rejects.toThrow(/escapes sandbox/);
  });
});

describe('analyze_code handler — react', () => {
  let directory: string;

  beforeEach(async () => {
    _resetCache();
    directory = await mkdtemp(nodePath.join(tmpdir(), 'analyze-code-react-'));
    await mkdir(nodePath.join(directory, 'src'), { recursive: true });
    await writeFile(
      nodePath.join(directory, 'src', 'App.tsx'),
      `import { useState, useEffect } from 'react';\nexport function App() {\n  const [n, setN] = useState(0);\n  useEffect(() => {}, []);\n  return <div dangerouslySetInnerHTML={{ __html: 'x' }} />;\n}\n`,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const testContext = { log: () => undefined, projectRoot: '' };

  it('auto-detects react from react import', async () => {
    const out = await definition.handle(
      { path: directory, depth: 3, metrics: true, framework: 'auto' },
      { ...testContext, projectRoot: directory },
    );
    expect(out.framework).toBe('react');
  });

  it('emits dangerous-html finding for dangerouslySetInnerHTML', async () => {
    const out = await definition.handle(
      { path: directory, depth: 3, metrics: true, framework: 'auto' },
      { ...testContext, projectRoot: directory },
    );
    expect(out.findings.some((f) => f.kind === 'dangerous-html')).toBe(true);
  });

  it('reports react.use_state and use_effect > 0', async () => {
    const out = await definition.handle(
      { path: directory, depth: 3, metrics: true, framework: 'auto' },
      { ...testContext, projectRoot: directory },
    );
    expect(out.metrics?.react?.use_state).toBeGreaterThan(0);
    expect(out.metrics?.react?.use_effect).toBeGreaterThan(0);
  });
});

describe('analyze_code handler — framework=none', () => {
  let directory: string;

  beforeEach(async () => {
    _resetCache();
    directory = await mkdtemp(nodePath.join(tmpdir(), 'analyze-code-none-'));
    await writeFile(nodePath.join(directory, 'plain.ts'), `console.log('x');\ndebugger;\n// FIXME: refactor this\n`);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const testContext = { log: () => undefined, projectRoot: '' };

  it('forces framework=none when explicitly requested', async () => {
    const out = await definition.handle(
      { path: directory, depth: 3, metrics: true, framework: 'none' },
      { ...testContext, projectRoot: directory },
    );
    expect(out.framework).toBe('none');
    expect(out.metrics?.angular).toBeUndefined();
    expect(out.metrics?.react).toBeUndefined();
    expect(out.metrics?.vue).toBeUndefined();
  });

  it('still emits generic findings (console + TODO/FIXME)', async () => {
    const out = await definition.handle(
      { path: directory, depth: 3, metrics: true, framework: 'none' },
      { ...testContext, projectRoot: directory },
    );
    expect(out.findings.some((f) => f.kind === 'console-log')).toBe(true);
    expect(out.findings.some((f) => f.kind === 'todo')).toBe(true);
  });

  it('emits a debugger finding for a leftover debugger; statement', async () => {
    const out = await definition.handle(
      { path: directory, depth: 3, metrics: true, framework: 'none' },
      { ...testContext, projectRoot: directory },
    );
    expect(out.findings.some((f) => f.kind === 'debugger')).toBe(true);
  });
});
