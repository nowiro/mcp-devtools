/**
 * Prompt registry — natywny MCP feature `prompts/list` + `prompts/get`.
 *
 * Eksponuje preconfigured prompts że Copilot Chat widzi gotowe slash-commands
 * zamiast użytkownika musieć je pisać. Konwencja MCP —
 * patrz [spec](https://modelcontextprotocol.io/specification).
 *
 * Tokens saved przez:
 *   - LLM nie musi wymyślać kształtu zapytania;
 *   - skomplikowane multi-step flows redukują się do jednej linii;
 *   - Copilot cache'uje prompt — nie tracimy contextu na "powtórz".
 */

export interface PromptArgument {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

export interface PromptMessage {
  readonly role: 'user' | 'assistant';
  readonly content: {
    readonly type: 'text';
    readonly text: string;
  };
}

export interface PromptDefinition {
  readonly name: string;
  readonly description: string;
  readonly arguments?: readonly PromptArgument[];
  readonly buildMessages: (args: Record<string, string>) => readonly PromptMessage[];
}

export function definePrompt(p: PromptDefinition): PromptDefinition {
  return p;
}
