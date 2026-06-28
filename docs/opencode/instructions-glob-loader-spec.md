# Instructions Glob-Loader Configuration Format — Specification v1.0

---

## Rule Author's Quick Reference

**Every rule file needs exactly these three fields in its YAML front-matter.** Everything else is optional — use only what your rule requires.

```yaml
id: my-rule-id                    # Required: unique identifier across all rules
trigger:                          # Required: at least one trigger type below
  event: "on_save"                # or on_edit, on_command, or a path/content/tool block
cascade_mode: "priority"           # Optional: "first" | "all" | "priority" (default)
```

### Minimal working rule (single file):

```yaml
id: lint-python
trigger:
  event: on_save
actions:
  - type: run
    command: ruf .
cascade_mode: "first"
```

That's a complete, functional rule. It runs `ruff .` every time any file is saved. No other fields are needed.

### When you need more — here are the optional pieces:

| Piece | What it does | Example |
|-------|-------------|---------|
| **Path trigger** | Match specific files instead of all on_save | `trigger.path: "*.py"` |
| **Content filter** | Only match if file contains certain text | `trigger.content.patterns: ["TODO"]` |
| **Tool args filter** | Only match when a command is invoked with specific flags | `trigger.tool.command: "git"` + `args_match` |
| **Budget cap** | Stop injecting rules that exceed context limits | `budget.max_chars: 4096` |
| **Inheritance** | Pull additional config from another rule file | `extends: "./base-rule.md"` |

### How to find the right trigger type for your use case:

- **"Run on every save"** → just `trigger.event: "on_save"` (no other fields needed)
- **"Run only on Python files"** → add `trigger.path: "*.py"` under event or replace event with path trigger
- **"Run when a TODO comment is detected"** → use `trigger.content.patterns` with mode `"any"`
- **"Run specific rules for different file types"** → use multiple rules, each with its own `id` and `trigger.path`

### Key constraints (quick):

- Each rule file must have a **unique** `id`. No two rules may share an `id`.
- `cascade_mode: "first"` stops processing subsequent matching rules. Use this to prioritize.
- The YAML front-matter ends at the closing `---`. Everything after that is the markdown body (optional, used as additional context when the rule fires).

### Next steps in this document:

For full schema definitions, trigger types, action models, and examples, continue reading **Section 2** below.


(End of file - total 413 lines)

## 2. Front-Matter Schema Specification

The table below defines every front-matter field. All values are parsed as YAML before validation.

| Field | Type | Required? | Default | Constraints | Description |
|-------|------|-----------|---------|-------------|-------------|
| `$schema_version` | string | **Yes** | — | Must exactly match loader's compiled version (e.g., `"1.0"`) | Loader-enforced; mismatch is FATAL |
| `id` | string | **Yes** | — | Unique across entire config set; no duplicates allowed in any loaded rule file | Rule identifier and context key |
| `trigger` | object | **Yes** | — | See Section 3 (Trigger Model) | Activates the rule via events, paths, content, or args |
| `description` | string | No | `""` | Free-form text; supports YAML multi-line (`|`, `>`) | Human-readable label for tooling/debug output |
| `priority` | integer | No | `50` | Range: 1–100 inclusive; higher = evaluated first under global budget | Evaluation order (higher first) |
| `cascade_mode` | enum | No | `"priority"` | Values: `"first"`, `"all"`, `"priority"` | Which matching rules fire |
| `extends` | string \| array[string] | No | `null` | Path(s) relative to the rule file's directory; circular chains detected at load time with FATAL severity | Parent path(s) for field inheritance |

Fields never inherited: `$schema_version`, `id` — both require explicit per-file declarations (FATAL on omission). Inheritance precedence: current rule > first parent > second parent > schema default.

---


## 3. Trigger Configuration

All trigger sub-components match simultaneously (AND logic across top-level keys). A rule fires only when every present component matches its criteria.

| Key | Type / Schema | Required? | Default | Constraints & Semantics |
|-----|---------------|-----------|---------|------------------------|
| `events` | `[enum: read\|write\|edit]` | No (omitted = all three) | All events | Values must be a subset of the enum; duplicates silently collapsed on parse. `read`=file opened, `write`=saved/created/overwritten, `edit`=in-place modification detected. |
| `paths` | `[{pattern: string, exclude?: [string]}]` | No (omitted = all files) | — | Each entry is a glob pattern (Bun.Glob syntax: `*`, `**`, `[abc]`, `{a,b}`). `exclude` patterns apply **after** the primary match to remove results. Multiple entries use OR logic across them; any file matching at least one `pattern` plus none of its `exclude`s activates the rule. At least one non-empty entry required per array; empty arrays cause FATAL. Unsupported glob extensions produce ERROR-level skip (rule loads, trigger inactive). |
| `content` | `{mode: enum: any\|all\|none, patterns: [{type: regex\|text, ...}]}` | No | `mode: "any"` | `mode:"any"` = at least one pattern matches; `"all"` = every pattern matches simultaneously; `"none"` = no pattern may match (negative filter). Each pattern entry requires either `{type:"regex", expression, flags?}` (PCRE, flags:`m`/`i`/`s`) or `{type:"text", value}` (case-sensitive literal). Pattern array must have ≥1 entry; empty patterns → ERROR-level skip of content trigger. |
| `args_match` | `[{field: string, pattern: string, match_type?: enum: glob\|regex\|literal}]` | No | — | Each entry matches a named argument in the tool invocation JSON payload against its `pattern` using `match_type`. All entries must match simultaneously (AND across arguments). If a specified `field` does not exist in the tool's schema, the rule is skipped with ERROR-level logging. |

---

## 4. Pattern Matching Semantics & Conflict Resolution

When multiple rules match a single event, `cascade_mode` determines which fire.
| Mode | Behavior | Use Case |
|------|----------|----------|
| `"first"` | Only the highest-priority matching rule fires; all others suppressed | Single-source-of-truth where only one response is desired |
| `"all"` | Every matching rule fires in priority order (highest first); no suppression | Cumulative context injection, multi-stage pipelines |
| `"priority"` (default) | Highest-priority rule fires; ties broken by lowest config-file path lexicographically | Standard behavior — single winner with deterministic tiebreak |

`cascade_mode` is a top-level front-matter key alongside `id`, `trigger`, and `actions`. Not valid inside sub-blocks. Exclusion precedence: within a rule, `exclude` always overrides its own `pattern`; between rules, higher-priority exclusions propagate downward only (low never excludes high).

## 5. Action Model Specification

### 5a. Shared Action Field Catalog

| Field | Type / Default | Req? | Scope | Description |
|-------|----------------|------|-------|-------------|
| `id` | string, required | Yes | all four | Unique action identifier and context reference key |
| `type` | enum: run_command\|session_augment\|attach_to_output\|route_output, default "session_augment" | No | all four | Determines which additional fields are required |
| `command` | string (interpolates `{filePath}`, `{basename}`) | Conditional (run_command) | run_command | Shell command to execute; 30s timeout per instance |
| `capture_output` | bool, default true | No | run_command, session_augment, attach_to_output | Whether stdout/stderr are captured for downstream references |
| `max_output_size` | int, default 4096 | No | run_command, session_augment, attach_to_output | Byte cap on captured output; excess truncated silently per-action |
| `target` | enum: agent_context\|tool_response\|log_file\|webhook_url, default "agent_context" | Conditional (session_augment/attach_to_output) | session_augment, attach_to_output | Injection destination for templated content |
| `position` | enum: before\|after\|replace(default after), replace attach_to_output only | No | session_augment, attach_to_output | Position relative to existing target content |
| `template` | string (interpolates `{filePath}`, `{basename}`, `{rule_id}`, `${ctx.<id>.<field>}`) | Conditional (session_augment/attach_to_output) | session_augment, attach_to_output | Injected content template with context references |
| `max_chars` | int, default no limit | No | session_augment, attach_to_output | Hard cap on injected text bytes; prevents oversized context injection |
| `window_usage_pct_above` | float, default 95 | No | session_augment, attach_to_output | Context usage % threshold that triggers enforcement action |
| `action_on_limit` | enum: abort\|truncate-to-half\|log-and-skip, default "abort" | No | session_augment, attach_to_output | Enforcement action when budget or threshold is exceeded |
| `url` | string (resolved from system config at load time) | Conditional (route_output) | route_output | Webhook URL; not declared in front-matter |
| `format` | enum: json\|text\|markdown, default "json" | No | route_output | Output payload serialization format before transmission |

**Budget enforcement:** Fields above gate injection by character budgets and window usage thresholds. Global pre-check uses `budget.global_window_usage_pct_threshold: 90` (system config); exceeding it rejects **all** per-action injections immediately — preventing cascade-mode "all" rules from collectively overflowing context.

### 5b. Action Chaining & Context References (`${ctx}`)

Actions execute sequentially in declaration order; each action's captured output is registered under its `id`. Later actions reference prior output via `${ctx.<action_id>.<field>}` where field traverses into captured stdout, stderr, or exit code (`.rc`). Dot-separated keys resolve nested JSON properties. Context persists only for the rule evaluation cycle and clears after all actions complete; circular references produce ERROR-level skip with structured warning. Parallel groups are not currently supported — future versions may add explicit `parallel` blocks.

---

## 9. Concrete Examples (Full System Demonstration)

```yaml
---
$schema_version: "1.0"
id: "flake8-migration-detector"
priority: 95
cascade_mode: "all"
trigger:
  events: [write, edit]
  matches:
    - parameter: "input.args.filePath"
      pattern: "**/*.py"
      exclude: ["**/tests/**", "**/__pycache__/**"]
  content:
    mode: "any"
    patterns:
      - type: "regex"
        expression: "^import\\s+(flake|flake8)\\W"
        flags: "m"
      - type: "text"
        value: "from flake import"
actions:
  - id: "classify_migration"
    type: "run_command"
    command: |
      flake8-classify {filePath} \
        --detect-imports \
        --output json | jq '.scope'
    capture_output: true

  - id: "warn_minimal"
    type: "session_augment"
    when: '${ctx.classify_migration.stdout} == "minimal"'
    template: |
      📋 Minimal flake8 migration detected in {filePath}.
      Suggested actions: update imports, verify runtime behavior.

  - id: "generate_fix_plan"
    type: "run_command"
    when: '${ctx.classify_migration.stdout} == "major"'
    command: |
      flake8-plan --scope=major \
        --file={filePath} \
        --output /tmp/flake8-fix-{basename}.sh

  - id: "report_fix_plan"
    type: "session_augment"
    when: '${ctx.generate_fix_plan.rc} == 0'
    template: |
      🔧 Fix plan generated at /tmp/flake8-fix-{basename}.sh.
      Review before applying. Run with `flake8-apply /tmp/flake8-fix-{basename}.sh`.

description: |
  Handles flake → flake8 migration detection and planning.
  Classifies scope of changes needed and generates appropriate fix plans.
---
This rule fires on Python files containing flake imports.
---

