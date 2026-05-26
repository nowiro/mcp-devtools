---
id: response.compliance_report
description: Canonical markdown view of compliance_report output (scoring + per-rule findings)
version: 1.0.0
vars:
  - target
  - rulesScanned
  - passed
  - failed
  - warnings
  - score
  - findings
---

# Compliance report — `{{ target }}`

**Score:** {{ score | default:"?" }} · **Rules scanned:** {{ rulesScanned | default:"0" }}

**Passed:** {{ passed | default:"0" }} · **Failed:** {{ failed | default:"0" }} · **Warnings:** {{ warnings | default:"0" }}

{{#if findings}}

## Findings ({{ findings }})

{{#each findings}}

### `{{ this.ruleId }}` — {{ this.verdict | default:"?" }}

**Source rule:** `{{ this.ruleSource }}`{{#if this.severity}} · **Severity:** {{ this.severity }}{{/if}}

{{ this.message }}

{{#if this.violations}}
{{#each this.violations}}

- `{{ this.path }}`{{#if this.line}} :{{ this.line }}{{/if}}{{#if this.snippet}} — `{{ this.snippet }}`{{/if}}
  {{/each}}
  {{/if}}

{{/each}}
{{/if}}
