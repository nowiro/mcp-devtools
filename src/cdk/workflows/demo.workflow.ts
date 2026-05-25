/**
 * Demo workflow — the simplest end-to-end exercise of Construct → Workflow →
 * App → render → write. Proves Faza 1 plumbing.
 *
 * Compiles to `.github/prompts/sdd-demo.prompt.md` and shows all three
 * `SynthStep` kinds (mcp_call, llm_reason, user_input).
 */
import { Construct, Workflow } from '../core/index.js';
import type { App, SynthStep } from '../core/index.js';

class AskName extends Construct {
  synth(): SynthStep[] {
    return [
      {
        type: 'user_input',
        n: 0, // re-numbered by Workflow.compile()
        title: 'Pobierz nazwę projektu',
        question: 'Jak nazywa się projekt który chcesz przeanalizować?',
        bind: 'project_name',
        description: 'Wpisz nazwę widoczną później w raporcie.',
      },
    ];
  }
}

class RunSanity extends Construct {
  synth(): SynthStep[] {
    return [
      {
        type: 'mcp_call',
        n: 0,
        title: 'Uruchom Playwright (sanity)',
        tool: 'mcp-devtools.run_playwright',
        args: {
          project_root: '.',
          reporter: 'json',
        },
        bind: 'sanity_result',
        timeoutMs: 600_000,
        description: 'Krótki run end-to-end żeby zweryfikować zdrowie aplikacji.',
      },
    ];
  }
}

class Summarize extends Construct {
  synth(): SynthStep[] {
    return [
      {
        type: 'llm_reason',
        n: 0,
        title: 'Podsumuj wyniki dla użytkownika',
        prompt:
          'Wygeneruj krótkie (max 5 zdań) podsumowanie projektu {{vars.project_name}} oraz wyniku sanity ({{vars.sanity_result}}). Skup się na pass/fail i ewentualnych flakes.',
        inputFrom: 'sanity_result',
        outputSchema: '{ "summary": "string", "should_proceed": "boolean" }',
        bind: 'summary',
        description: 'Output trafia do użytkownika jako finalna odpowiedź.',
      },
    ];
  }
}

export class DemoWorkflow extends Workflow {
  readonly description = 'Demo workflow — proof of Faza 1 plumbing (CDK compile end-to-end).';
  readonly trigger = 'sdd-demo';

  constructor(scope: App, id: string) {
    super(scope, id);
    new AskName(this, 'AskName');
    new RunSanity(this, 'RunSanity');
    new Summarize(this, 'Summarize');
  }

  synth(): SynthStep[] {
    return [];
  }
}
