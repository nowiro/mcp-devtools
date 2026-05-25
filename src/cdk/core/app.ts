/**
 * `App` — root of the CDK tree. Workflows register as children. `synth()`
 * compiles each Workflow, validates binds, and writes one `.prompt.md` per
 * Workflow to `outDir`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Construct } from './construct.js';
import { renderWorkflow } from './render.js';
import type { SynthStep } from './synth.js';
import { assertBindsValid } from './validate.js';
import { Workflow } from './workflow.js';

export interface AppSynthOptions {
  /** Absolute or repo-relative path where `.prompt.md` files land. */
  readonly outDir: string;
  /** Test hook — by default writes through `node:fs`. */
  readonly write?: (filePath: string, content: string) => void;
}

export interface AppSynthResult {
  /** Absolute paths of written files. */
  readonly written: string[];
}

export class App extends Construct {
  constructor() {
    super(undefined, 'App');
  }

  /** `App` itself emits no steps — it just hosts Workflows. */
  synth(): SynthStep[] {
    return [];
  }

  /** Compile every Workflow child, validate, render, write. */
  emit(opts: AppSynthOptions): AppSynthResult {
    const write =
      opts.write ??
      ((p, c) => {
        writeFileSync(p, c, 'utf8');
      });
    const outDir = nodePath.resolve(opts.outDir);
    mkdirSync(outDir, { recursive: true });

    const written: string[] = [];
    for (const child of this.getChildren()) {
      if (!(child instanceof Workflow)) continue;
      const compiled = child.compile();
      assertBindsValid(compiled);
      const body = renderWorkflow(compiled);
      const target = nodePath.resolve(outDir, `${compiled.trigger}.prompt.md`);
      write(target, body);
      written.push(target);
    }
    return { written };
  }
}
