import { describe, expect, it } from 'vitest';

import { Construct } from './construct.js';
import type { SynthStep } from './synth.js';
import { Workflow } from './workflow.js';

class StepEmitter extends Construct {
  constructor(
    scope: Construct,
    id: string,
    private readonly steps: SynthStep[],
  ) {
    super(scope, id);
  }
  synth(): SynthStep[] {
    return this.steps;
  }
}

class TestWorkflow extends Workflow {
  readonly description = 'A test workflow';
  readonly trigger = 'test-wf';
  synth(): SynthStep[] {
    return [];
  }
}

describe('Workflow.compile', () => {
  it('renumbers steps starting at 1', () => {
    const wf = new TestWorkflow(undefined, 'TestWorkflow');
    new StepEmitter(wf, 'A', [
      { type: 'user_input', n: 0, title: 'X', question: 'q', bind: 'a' },
      { type: 'user_input', n: 0, title: 'Y', question: 'q', bind: 'b' },
    ]);
    new StepEmitter(wf, 'B', [{ type: 'user_input', n: 0, title: 'Z', question: 'q', bind: 'c' }]);

    const compiled = wf.compile();
    expect(compiled.steps.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(compiled.steps.map((s) => s.title)).toEqual(['X', 'Y', 'Z']);
  });

  it('rejects non-kebab triggers', () => {
    class BadWorkflow extends Workflow {
      readonly description = 'bad';
      readonly trigger = 'Not Kebab';
      synth(): SynthStep[] {
        return [];
      }
    }
    const wf = new BadWorkflow(undefined, 'BadWorkflow');
    expect(() => wf.compile()).toThrow(/kebab-case/);
  });

  it('passes description and trigger through', () => {
    const wf = new TestWorkflow(undefined, 'TestWorkflow');
    const compiled = wf.compile();
    expect(compiled.description).toBe('A test workflow');
    expect(compiled.trigger).toBe('test-wf');
    expect(compiled.id).toBe('TestWorkflow');
  });
});
