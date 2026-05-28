/**
 * `help` command — prints usage to stdout. Sync (no async work).
 */

export function printHelp(): void {
  process.stdout.write(
    [
      'mcp-devtools-cdk — Copilot CDK compiler',
      '',
      'Commands:',
      '  compile           Compile all *.workflow.* files to .prompt.md',
      '  help              Show this message',
      '',
      'Options for `compile`:',
      '  --out=<dir>       Output directory (default: .github/prompts)',
      '  --workflows=<dir> Workflow source directory (default: dist/cdk/workflows)',
      '',
    ].join('\n'),
  );
}
