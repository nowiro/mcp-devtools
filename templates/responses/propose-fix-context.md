---
id: response.propose_fix
description: Canonical markdown view of propose_fix output (failing test + source slices + rules context)
version: 1.0.0
vars:
  - testPath
  - testName
  - failureMessage
  - sources
  - rules
  - hint
---

# Bug-fix context

{{#if testPath}}**Failing test:** `{{ testPath }}`{{#if testName}} → `{{ testName }}`{{/if}}{{/if}}

{{#if failureMessage}}

## Failure

```
{{ failureMessage }}
```

{{/if}}

{{#if sources}}

## Source slices ({{ sources }})

{{#each sources}}

### `{{ this.path }}` :{{ this.startLine }}–{{ this.endLine }}

```{{ this.language | default:"" }}
{{ this.snippet }}
```

{{/each}}
{{/if}}

{{#if rules}}

## Applicable rules ({{ rules }})

{{#each rules}}

- **{{ this.id }}**: {{ this.summary }}{{#if this.path}} (`{{ this.path }}`){{/if}}
  {{/each}}
  {{/if}}

{{#if hint}}

## Hint for the fixer LLM

{{ hint }}
{{/if}}
