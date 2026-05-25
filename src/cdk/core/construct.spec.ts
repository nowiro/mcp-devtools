import { describe, expect, it } from 'vitest';

import { Construct } from './construct.js';
import type { SynthStep } from './synth.js';

class Leaf extends Construct {
  constructor(
    scope: Construct | undefined,
    id: string,
    private readonly step: SynthStep,
  ) {
    super(scope, id);
  }
  synth(): SynthStep[] {
    return [this.step];
  }
}

class Root extends Construct {
  synth(): SynthStep[] {
    return [];
  }
}

describe('Construct', () => {
  it('builds hierarchical paths', () => {
    const root = new Root(undefined, 'Root');
    const child = new Root(root, 'Child');
    const grand = new Root(child, 'Grand');
    expect(root.path).toBe('Root');
    expect(child.path).toBe('Root/Child');
    expect(grand.path).toBe('Root/Child/Grand');
  });

  it('rejects invalid ids', () => {
    expect(() => new Root(undefined, '')).toThrow(/Construct id/);
    expect(() => new Root(undefined, '1bad')).toThrow(/Construct id/);
    expect(() => new Root(undefined, 'has space')).toThrow(/Construct id/);
  });

  it('rejects duplicate sibling ids', () => {
    const root = new Root(undefined, 'Root');
    new Root(root, 'Dup');
    expect(() => new Root(root, 'Dup')).toThrow(/Duplicate Construct id/);
  });

  it('synthAll() walks depth-first', () => {
    const step = (title: string): SynthStep => ({
      type: 'user_input',
      n: 0,
      title,
      question: 'q',
      bind: title.toLowerCase(),
    });
    const root = new Leaf(undefined, 'Root', step('A'));
    new Leaf(root, 'C1', step('B'));
    new Leaf(root, 'C2', step('C'));

    const out = root.synthAll();
    expect(out.map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });
});
