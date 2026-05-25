/**
 * `Construct` — atomic node in a CDK workflow graph.
 *
 * Each Construct holds:
 *   - `id`        — human-readable identifier, unique among siblings.
 *   - `path`      — slash-joined ancestry, e.g. "App/ScaffoldApp/Spec".
 *   - `children`  — Constructs registered under this one (built by passing
 *                   `scope` in the constructor of the child).
 *
 * Subclasses implement `synth()` to emit their own `SynthStep`-s.
 * `synthAll()` is the public entry that walks the tree depth-first.
 */
import type { SynthStep } from './synth.js';

export abstract class Construct {
  public readonly id: string;
  public readonly path: string;
  protected readonly children: Construct[] = [];

  constructor(scope: Construct | undefined, id: string) {
    if (!/^[A-Za-z][\w-]*$/.test(id)) {
      throw new Error(`Construct id must match /^[A-Za-z][\\w-]*$/, got: ${JSON.stringify(id)}`);
    }
    this.id = id;
    this.path = scope ? `${scope.path}/${id}` : id;
    if (scope) {
      if (scope.children.some((c) => c.id === id)) {
        throw new Error(`Duplicate Construct id ${JSON.stringify(id)} under ${scope.path}`);
      }
      scope.children.push(this);
    }
  }

  /** Each subclass emits zero or more recipe steps. */
  abstract synth(): SynthStep[];

  /** Depth-first aggregation: this Construct's steps, then each child recursively. */
  synthAll(): SynthStep[] {
    return [...this.synth(), ...this.children.flatMap((c) => c.synthAll())];
  }

  /** Test / debug helper — read-only snapshot of children. */
  getChildren(): readonly Construct[] {
    return this.children;
  }
}
