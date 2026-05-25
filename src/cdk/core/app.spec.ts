import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app.js';
import { Construct } from './construct.js';
import { _resetCache } from './render.js';
import type { SynthStep } from './synth.js';
import { Workflow } from './workflow.js';

class Greeter extends Construct {
  synth(): SynthStep[] {
    return [
      {
        type: 'user_input',
        n: 0,
        title: 'Ask name',
        question: 'What is your name?',
        bind: 'name',
      },
      {
        type: 'mcp_call',
        n: 0,
        title: 'Echo',
        tool: 'echo',
        args: { value: '{{vars.name}}' },
      },
    ];
  }
}

class HelloWorkflow extends Workflow {
  readonly description = 'Say hello';
  readonly trigger = 'sdd-hello';
  constructor(scope: App, id: string) {
    super(scope, id);
    new Greeter(this, 'Greeter');
  }
  synth(): SynthStep[] {
    return [];
  }
}

describe('App.emit', () => {
  let outDir: string;

  beforeEach(async () => {
    _resetCache();
    outDir = await mkdtemp(nodePath.join(tmpdir(), 'cdk-app-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it('writes one .prompt.md per Workflow', async () => {
    const app = new App();
    new HelloWorkflow(app, 'Hello');
    const { written } = app.emit({ outDir });
    expect(written).toHaveLength(1);
    const target = written[0];
    if (!target) throw new Error('expected one written file');
    const body = await readFile(target, 'utf8');
    expect(body).toContain('# /sdd-hello');
    expect(body).toContain('Ask name');
    expect(body).toContain('Echo');
  });

  it('throws when binds reference undefined vars', () => {
    class BadWorkflow extends Workflow {
      readonly description = 'bad';
      readonly trigger = 'sdd-bad';
      constructor(scope: App, id: string) {
        super(scope, id);
        new BadConstruct(this, 'Bad');
      }
      synth(): SynthStep[] {
        return [];
      }
    }
    class BadConstruct extends Construct {
      synth(): SynthStep[] {
        return [
          {
            type: 'mcp_call',
            n: 0,
            title: 'Use undefined',
            tool: 'x',
            args: { v: '{{vars.missing}}' },
          },
        ];
      }
    }

    const app = new App();
    new BadWorkflow(app, 'Bad');
    expect(() => app.emit({ outDir })).toThrow(/Bind validation failed/);
  });

  it('ignores non-Workflow children', () => {
    const app = new App();
    new Greeter(app, 'Loose'); // not a Workflow
    const { written } = app.emit({ outDir });
    expect(written).toHaveLength(0);
  });
});
