> **Historical design record.** Superseded by `CONTRACT.md` for anything it states about current behaviour; removed action ids appear here only as history, not as the current interface.

# Template files: mechanics

Decision in one line: seven prompt texts move to `machines/session/templates/<template>.md`, read synchronously from disk at module load, rendered with a mustache subset (`{{name}}`, `{{#name}}…{{/name}}`, `{{^name}}…{{/name}}`), one file per `TemplateId`, literal `text` stays inline in `machine.json`.

## 1. Inventory — seven templates, counted from the switch

`TemplateId` is a seven-member union (`machines/session/definitions.ts:21-37`) and `renderTemplate` has seven cases (`:214-238`). Seven arms; five receive `context` (`quality_check_failed`, `memorize`, `panic_escalation`, `park_summary`, `work_towards_goal`), two receive nothing (`goal_request`, `validation_self_report`). Distinct placeholder names: six (`reason`, `detail`, `goal`, `improvements`, `memories`, `preferences`) plus one intent section (`improvement`).

| Template | Placeholders | Today's rule | Call sites |
|---|---|---|---|
| `goal_request` | none | literal sentence | none — see fork F1 |
| `quality_check_failed` | `reason` (default `unknown`), `detail` (optional parenthetical) | `'Quality check failed: ' + reason + (detail === undefined ? '' : ' (' + detail + ')') + '. Parked in panic for investigation.'` (`:185-188`) | `machine.json:245` |
| `validation_self_report` | none | literal sentence | `machine.json:259` and `request_dispatch` (`definitions.ts:517`) |
| `memorize` | `improvement` section, no value | `intent === 'improvement' ? 'Name one improvement.' : 'Name what to change next attempt.'` (`:194-196`) | `machine.json:361` |
| `panic_escalation` | `reason` (default `unknown`), `detail` (optional parenthetical) | `'Parked for investigation: ' + reason + (detail === undefined ? '' : ' (' + detail + ')')` (`:198-200`) | `machine.json:347` |
| `park_summary` | `goal`, `improvements` | `'Goal reached: ' + sentence(goal) + ' Improvements: ' + sentence(improvements.join(' \| ') \|\| 'none') + ' Waiting for your next instruction.'` (`:204-207`) | `machine.json:428` |
| `work_towards_goal` | `goal`, `memories`, `preferences` | `'Work towards: ' + goal + '. Memories: ' + (memories.join(' \| ') \|\| 'none') + '. Preferences: ' + (injected['preferences/user']?.full.join(' \| ') \|\| 'none')` (`:209-212`) | `machine.json:154` |

Row cap: one row per template, seven rows, no others. The mapping test in §6 fails if a row, a name, or a file is added on one side only.

Formatting stays in code, wording stays in the file. `sentence()` (`:202`), the `' | '` join, the `'none'` default and the `?? 'unknown'` fallback are value providers, not template text; the file holds only the words and the punctuation around them.

## 2. File bodies

`machines/session/templates/`:

```text
goal_request.md
This session runs a state machine. What goal should it accomplish?
```

```text
quality_check_failed.md
Quality check failed: {{reason}}{{#detail}} ({{detail}}){{/detail}}. Parked in panic for investigation.
```

```text
validation_self_report.md
Verdict: call signal_send with type GOAL_ACHIEVED when the goal is met, or GOAL_INCOMPLETE when it is not.
```

```text
memorize.md
{{#improvement}}Name one improvement.{{/improvement}}{{^improvement}}Name what to change next attempt.{{/improvement}}
```

```text
panic_escalation.md
Parked for investigation: {{reason}}{{#detail}} ({{detail}}){{/detail}}
```

```text
park_summary.md
Goal reached: {{goal}} Improvements: {{improvements}} Waiting for your next instruction.
```

```text
work_towards_goal.md
Work towards: {{goal}}. Memories: {{memories}}. Preferences: {{preferences}}
```

Each file is one line, no frontmatter, no trailing blank line inside the content (the loader trims exactly one trailing newline, so an editor that appends one cannot change the output). `park_summary` and `work_towards_goal` end without a period, matching today.

## 3. Layout and the one-to-one rule

- Directory: `machines/session/templates/`, beside the machine's other four files.
- Filename: `<template>.md`, exactly the `TemplateId` string, snake_case, no prefix or suffix.
- Rule: one `TemplateId` ↔ one file, both directions. No template name without a file, no file without a name. `TEMPLATE_IDS` becomes the runtime list (`as const`, `TemplateId` derived from it, the pattern `ACTION_TYPES` already uses at `definitions.ts:146-160`), so the union and the filesystem have one enumerable source.
- Literal `text` values stay inline in `machine.json`. A `text` entry exists to be set from JSON without touching code; giving it a file would invent an eighth name the renderer does not know, break the one-to-one rule, and hide a one-off line behind a lookup. Promote a literal to a template only when a second action reuses it or it grows multi-line.

## 4. Placeholder syntax

Grammar, parsed once per file at load, no nesting (a section body may contain value tags only):

| Tag | Meaning |
|---|---|
| `{{name}}` | substitute the value |
| `{{#name}}…{{/name}}` | render the body when the value is not `undefined`, `null` or `false` |
| `{{^name}}…{{/name}}` | render the body when the value is `undefined`, `null` or `false` |

The section test is "defined", not "truthy": today's `detail === undefined ? '' : ' (' + detail + ')'` renders a leading space and `()` for `detail: ''`, and a truthiness test would silently change those bytes.

| Case | Rule |
|---|---|
| Unknown tag (`{{nope}}`, no key in the provider's map) | throws at render, message names the file and the tag |
| Declared but `undefined` | `{{name}}` renders empty; `{{#name}}` skipped; `{{^name}}` rendered |
| Same tag twice | substituted at each occurrence with the same value; no error, no accumulation |
| Malformed (`{{name`, unclosed section, nested section) | throws at load, naming the file and the line |
| Provider omits a key the file uses | that is the unknown-tag case, not the missing-value case: providers build their map with explicit keys, `detail: undefined` included, and never delete a key |

## 5. Loader

Decision: **synchronous runtime read** with `node:fs` at module load, base resolved from `import.meta.url`, cached in a module-level `Map`; the directory is injectable for tests (`createTemplateLoader(directory: URL)`), and the module's default instance points at `new URL('./templates/', import.meta.url)`.

Evidence that this is the mechanism the plugin's load path supports:

- The host loader scans root `.opencode/plugins/*.ts` only and "the runtime loads `.ts` directly", with relative imports resolved from the source file (`.opencode/instructions/opencode-plugin-interfaces.instructions.md`, §Loading and imports).
- No build step sits in the load path: `.opencode/package.json` declares `"build": "tsup"`, but there is no `tsup.config.*` under `.opencode/` and no `.opencode/dist/`.
- Relative data imports from source already work today: `machines/index.ts:6-7` imports `machine.json` and `signals.manifest.json` with `with { type: 'json' }`.
- The plugin already reads files at runtime with node builtins: `core/memory.ts:8` imports `readFile` from `node:fs/promises`, `:44` builds a path with `path.join`.
- Rendering is synchronous — `renderTemplate` (`:214`) is called from `runtime.emit` (`:502-506`) — so the read must be `readFileSync`, not a promise.

Rejected alternatives: static `import text from './templates/x.md' with { type: 'text' }` (Node's import attributes accept `json` only; whether the host's transform accepts `text` is not visible in the tree — unknown, not assumed); tsup inlining (needs a build step that does not exist in the load path); a generated TS module of strings (gives the `.md` files a second, derived home and a codegen step that can drift).

Unknown, and how it is settled: whether the host's module transform preserves `import.meta.url` as the on-disk source path. The hot-reload note — the runtime "appends `__opencode_reload=<generation>` to every local module it resolves" (same instruction file, §Hot reload) — is consistent with on-disk resolution but is not proof for `import.meta.url`. One live `rug` run that prints a rendered prompt settles it. Fallback if it fails: read `<context.location.directory>/.opencode/plugins/state-machine/machines/session/templates/<name>.md`, the same workspace directory `core/memory.ts` already consumes; that is one extra parameter at assembly, no change to the loader's shape.

## 6. Failure policy and the mapping test

- Missing file: throws at load — the loader's default instance reads and parses all seven when `definitions.ts` is first evaluated, so the failure lands at plugin assembly, naming the absolute path.
- Malformed file: throws at load, naming the file and the line.
- Unknown tag: throws at render (the value map is runtime data, so load cannot know it), naming the file and the tag.
- Two tests pin the map: every `TemplateId` has `<name>.md`, and every file stem in `templates/` is a `TemplateId`. A third walks all seven with a full fixture context and asserts no unknown-tag throw, so a typo fails the suite instead of a session.

## 7. CONTRACT.md §5

The `prompt` row's text becomes a pointer to the files. Replacement sentence, verbatim (only the third clause changes; the rest of the row stays byte-identical):

> `template` alone renders `machines/session/templates/<template>.md`, filling the placeholders that file declares from the loop context

and after the table, one added sentence:

> A template file is the only home for its wording; `text` stays inline in `machine.json` because a literal no second action reuses has no name to look up.

The params cell keeps `{ template, description }`, `{ text, description }`, or both.

Two documentation lines become false with this change and are part of the migration: `.opencode/plugins/AGENTS.md` ("`definitions.ts` carries … the template texts") and this directory's header comment at `definitions.ts:1-5` ("plus the prompt templates they render").

## 8. Parity guard

Extend the existing suite, `tests/state-machine/definitions.test.ts`, which already asserts four exact strings (`:60-89`). Shape:

```ts
const cases: readonly { name: TemplateId, context: LoopContext, expected: string }[] = [/* 7 + value rows */]

describe('template parity with the pre-extraction output', () => {
  it('renders every template byte-identically', () => {
    for (const { name, context, expected } of cases) expect(renderTemplate({ template: name }, context)).toBe(expected)
  })

  it('covers every template and every placeholder', () => {
    expect(new Set(cases.map(c => c.name))).toEqual(new Set(TEMPLATE_IDS))
    expect(new Set(cases.flatMap(c => PLACEHOLDERS_OF[c.name]))).toEqual(new Set([...PLACEHOLDER_NAMES, 'improvement']))
  })
})
```

Rows, with the literals the assertion must use:

| name | context overlay | expected |
|---|---|---|
| `goal_request` | — | `This session runs a state machine. What goal should it accomplish?` |
| `validation_self_report` | — | `Verdict: call signal_send with type GOAL_ACHIEVED when the goal is met, or GOAL_INCOMPLETE when it is not.` |
| `quality_check_failed` | no `failure` | `Quality check failed: unknown. Parked in panic for investigation.` |
| `quality_check_failed` | `failure: { reason: 'exit 1', detail: 'type error' }` | `Quality check failed: exit 1 (type error). Parked in panic for investigation.` |
| `quality_check_failed` | `failure: { reason: 'exit 1', detail: '' }` | `Quality check failed: exit 1 (). Parked in panic for investigation.` |
| `panic_escalation` | no `failure` | `Parked for investigation: unknown` |
| `panic_escalation` | `failure: { reason: 'attempts exhausted', detail: 'three tries' }` | `Parked for investigation: attempts exhausted (three tries)` |
| `memorize` | `intent: 'improvement'` | `Name one improvement.` |
| `memorize` | `intent: 'none'` | `Name what to change next attempt.` |
| `park_summary` | `goal: 'ship it'`, `improvements: ['read the line.']` | `Goal reached: ship it. Improvements: read the line. Waiting for your next instruction.` |
| `park_summary` | `goal: 'ship it.'`, `improvements: []` | `Goal reached: ship it. Improvements: none. Waiting for your next instruction.` |
| `work_towards_goal` | `goal: 'ship it'`, `memories: ['a', 'b']`, `injected: { 'preferences/user': { full: ['p'], index: [] } }` | `Work towards: ship it. Memories: a \| b. Preferences: p` |
| `work_towards_goal` | `goal: 'ship it'`, `memories: []`, `injected: {}` | `Work towards: ship it. Memories: none. Preferences: none` |

Each of the six placeholder names appears in at least one row with a non-default value (so deleting the substitution changes bytes), and each section appears in both branches (`detail` absent/present/empty, `improvement` true/false). The two existing punctuation tests in `prompt-text.test.ts:73-88` stay as the end-to-end guard.

Structural loader tests go in `tests/state-machine/template-files.test.ts` (1:1 with the new `machines/session/template-files.ts`): missing file throws with the path, malformed file throws with the line, unknown tag throws with file and tag, and a good file renders.

## 9. Migration order and the smallest first slice

1. `TEMPLATE_IDS` + `TemplateId` derived; `renderTemplate`'s switch replaced by `Record<TemplateId, (context) => Values>`; providers call today's text functions. Suite green, no file reads yet. This is the only prerequisite.
2. **Smallest slice, one commit:** `machines/session/template-files.ts` (parse + render + loader), the seven `.md` files, providers switched to values, `renderTemplate` reading files, parity rows and mapping tests, and deletion of the seven text constants. Text must not have two homes, so the files and the switch-over land together; `definitions.ts:182-212` shrinks to value providers.
3. Failure-policy tests (missing, malformed, unknown tag) with the injectable loader directory.
4. Docs: `CONTRACT.md` §5 clause and added sentence, `.opencode/plugins/AGENTS.md` invariant line, `definitions.ts:1-5` header.
5. Live check, quoting the `[state-machine]` lines: `opencode run --format json --standalone --agent rug --model <authenticated route> --print-logs "…"` for the define-goal and work prompts.

Rollback: step 2 is one revert; templates carry no state and no snapshot field, so nothing persisted has to be migrated. Steps 1 and 4 are independent of step 2 and can stay.

## 10. Risks and forks

- **Unknown, from §5:** `import.meta.url` under the host transform. A failing read breaks every session at assembly, not one prompt, which is why the fallback in §5 is written down before the code lands.
- Mutation gate: the Stryker sandbox must copy `templates/*.md`. If it does not, the load-time throw names the missing path, so the failure is loud rather than silent; verify with one mutation run on the new module.
- Hot reload: the loader caches per module instance, so editing a `.md` alone changes nothing until a `.ts` in the graph is saved. Fork F3.

Forks a user must settle:

- **F1 `goal_request` is unreferenced.** Six `"template"` keys appear in `machine.json` (`:154, 245, 259, 347, 361, 428`); `goal_request` is not one of them, and `machine.json:79` hand-writes its sentence byte-for-byte. Recommend keeping the file and pointing `define_goal` at `{ "template": "goal_request", "description": … }` in a separate commit, so the sentence has one home.
- **F2 Section syntax.** Accept `{{#name}}`/`{{^name}}` for `memorize` (recommended), or hold `memorize` back and keep its two strings in code.
- **F3 Staleness.** Require a `.ts` save to reload templates (recommended, no stat on every render), or re-read on mtime change in development.
- **F4 Inline literals.** Confirm `text` stays in `machine.json` (§3); the alternative is an eighth file and a name the renderer must learn.
