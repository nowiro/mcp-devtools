import { describe, expect, it } from 'vitest';

import { renderWorkflow, _resetCache } from './render.js';
import type { CompiledWorkflow } from './synth.js';

describe('renderWorkflow', () => {
  it('renders frontmatter + steps for a minimal workflow', () => {
    _resetCache();
    const compiled: CompiledWorkflow = {
      id: 'Mini',
      trigger: 'mini',
      description: 'A minimal workflow',
      steps: [
        {
          type: 'user_input',
          n: 1,
          title: 'Ask name',
          question: 'Your name?',
          bind: 'name',
        },
        {
          type: 'mcp_call',
          n: 2,
          title: 'Echo',
          tool: 'echo',
          args: { msg: 'Hello {{vars.name}}' },
          bind: 'greeting',
        },
      ],
    };

    const out = renderWorkflow(compiled);
    expect(out).toContain("description: 'A minimal workflow'");
    expect(out).toContain('# /mini');
    expect(out).toContain('### Step 1 — Ask name');
    expect(out).toContain('Your name?');
    expect(out).toContain('`name`');
    expect(out).toContain('### Step 2 — Echo');
    expect(out).toContain('`echo`');
    expect(out).toContain('Hello {{vars.name}}');
  });

  it('emits source link in kebab-case', () => {
    _resetCache();
    const out = renderWorkflow({
      id: 'ScaffoldApp',
      trigger: 'sdd-scaffold-app',
      description: 'x',
      steps: [],
    });
    expect(out).toContain('src/cdk/workflows/scaffold-app.workflow.ts');
  });
});
