---
id: response.analyze_code
description: Canonical markdown view of analyze_code output (per-framework metrics + findings)
version: 1.0.0
vars:
  - target
  - framework
  - filesScanned
  - linesScanned
  - cacheHits
  - metrics
  - findings
  - dependencies
---

# Code analysis — `{{ target }}`

**Framework:** {{ framework | default:"plain TS/JS" }} · **Files scanned:** {{ filesScanned | default:"0" }} · **Lines:** {{ linesScanned | default:"0" }}

**Cache:** {{ cacheHits | default:"0" }} hits

{{#if metrics}}

## Metrics

| metric | value |
| ------ | ----- |

{{#each metrics}}
| `{{ this.name }}` | {{ this.value }} |
{{/each}}
{{/if}}

{{#if findings}}

## Findings ({{ findings }})

{{#each findings}}

### `{{ this.path }}`{{#if this.line}} :{{ this.line }}{{/if}}

**Rule:** `{{ this.rule }}` · **Severity:** {{ this.severity | default:"info" }}

{{ this.message }}

{{#if this.suggestion}}**Suggestion:** {{ this.suggestion }}{{/if}}

{{/each}}
{{/if}}

{{#if dependencies}}

## External dependencies referenced

{{#each dependencies}}

- `{{ this.name }}`{{#if this.version}} @ {{ this.version }}{{/if}}{{#if this.from}} (from `{{ this.from }}`){{/if}}
  {{/each}}
  {{/if}}
