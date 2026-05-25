import { describe, expect, it } from 'vitest';

import type { CompiledWorkflow } from './synth.js';
import { assertBindsValid, validateBinds } from './validate.js';

function wf(steps: CompiledWorkflow['steps']): CompiledWorkflow {
  return { id: 'W', trigger: 'w', description: 'd', steps };
}

describe('validateBinds', () => {
  it('passes when refs point at earlier binds', () => {
    const issues = validateBinds(
      wf([
        { type: 'user_input', n: 1, title: 'Ask', question: 'q', bind: 'name' },
        {
          type: 'mcp_call',
          n: 2,
          title: 'Greet',
          tool: 'greet',
          args: { hello: '{{vars.name}}' },
        },
      ]),
    );
    expect(issues).toEqual([]);
  });

  it('flags forward references', () => {
    const issues = validateBinds(
      wf([
        {
          type: 'mcp_call',
          n: 1,
          title: 'Use',
          tool: 't',
          args: { v: '{{vars.later}}' },
        },
        { type: 'user_input', n: 2, title: 'Define', question: 'q', bind: 'later' },
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('vars.later');
  });

  it('flags unknown refs', () => {
    const issues = validateBinds(
      wf([{ type: 'mcp_call', n: 1, title: 'X', tool: 't', args: { v: '{{vars.nonsense}}' } }]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('vars.nonsense');
  });

  it('assertBindsValid throws on issues', () => {
    expect(() => {
      assertBindsValid(wf([{ type: 'mcp_call', n: 1, title: 'X', tool: 't', args: { v: '{{vars.nope}}' } }]));
    }).toThrow(/Bind validation failed/);
  });
});
