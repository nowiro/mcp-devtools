#!/usr/bin/env node
/**
 * `mcp-devtools-cdk` — CLI for the Copilot CDK.
 *
 * Usage:
 *   npx mcp-devtools-cdk compile [--out=.github/prompts] [--workflows=src/cdk/workflows]
 *   npx mcp-devtools-cdk help
 *
 * Layout: per-command handlers live in `src/cli/commands/<verb>.ts`. This
 * file is just the entry point (arg parse + dispatch). Mirrors the
 * `github/spec-kit` 0.8.14 refactor pattern (`commands/init.py` extracted
 * from `__init__.py`).
 */
import { compileCommand, type CompileArgs } from './commands/compile.js';
import { printHelp } from './commands/help.js';

interface CliArgs extends CompileArgs {
  readonly command: 'compile' | 'help';
}

function parseArgs(argv: readonly string[]): CliArgs {
  const command = (argv[0] ?? 'help') as CliArgs['command'];
  let outDir = '.github/prompts';
  let workflowsDir = 'dist/cdk/workflows';
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('--out=')) outDir = arg.slice('--out='.length);
    else if (arg.startsWith('--workflows=')) workflowsDir = arg.slice('--workflows='.length);
  }
  return { command, outDir, workflowsDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'compile': {
      const code = await compileCommand(args);
      process.exit(code);
      break;
    }
    case 'help':
      printHelp();
      break;
    default: {
      const unknown: never = args.command;
      process.stderr.write(`mcp-devtools-cdk: unknown command "${String(unknown)}"\n`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`mcp-devtools-cdk: ${(err as Error).message}\n`);
  process.exit(1);
});
