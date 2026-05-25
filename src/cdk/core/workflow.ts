/**
 * `Workflow` — root of one `.prompt.md` file. Subclasses declare:
 *   - `description` — one-line summary shown in slash-command picker.
 *   - `trigger`     — slash-command name (e.g. `sdd-scaffold-app`).
 *
 * `compile()` walks all descendants, re-numbers steps starting at 1, and
 * returns a `CompiledWorkflow` ready for rendering.
 */
import { Construct } from './construct.js';
import type { CompiledWorkflow, SynthStep } from './synth.js';

export abstract class Workflow extends Construct {
  abstract readonly description: string;
  abstract readonly trigger: string;

  /** Walk children, re-number n=1..N, freeze. */
  compile(): CompiledWorkflow {
    const raw = this.synthAll();
    const steps = raw.map((s, i) => ({ ...s, n: i + 1 })) as SynthStep[];
    if (!/^[a-z][a-z0-9-]*$/.test(this.trigger)) {
      throw new Error(`Workflow trigger must be kebab-case, got: ${JSON.stringify(this.trigger)}`);
    }
    return {
      id: this.id,
      trigger: this.trigger,
      description: this.description,
      steps,
    };
  }
}
