# Reference: Workflow and Reference File Templates

Copy-pasteable skeletons for workflow files under `workflows/` and reference files under `references/`. The root skeleton lives in [templates-root.md](./templates-root.md). Fill in a skeleton, then validate the result against the [Shaping Checklist](../workflows/shaping-checklist.md).

When to load: when you need a starting skeleton for a workflow or reference file — copy it, fill it in, and wire the worked examples.

## Workflow File Template

Copy this skeleton for each workflow file under `workflows/`.
~~~~md
# Workflow: <Task Name>

Follow this workflow to [specific outcome].

When to load: [when this workflow applies].

## Prerequisites

- [Required reads or setup before starting]

## Steps

1. **Step one** — brief action and why. Done when: [observable completion signal].
2. **Step two** — brief action and why. Done when: [observable completion signal].
3. **Step three** — brief action and why. Done when: [observable completion signal].

Gate: [hard stop — no [x], no next step] (Rule 20).

## Examples

```language
// concrete example
```

## Clarification Triggers

Ask the user before proceeding if:
- [Ambiguous condition 1]
- [Ambiguous condition 2]

## Acceptance Criteria

- [Measurable check 1]
- [Measurable check 2]
- It's working if: [observable signal that the outcome holds]
~~~~

**Fence validity:** See Rule 15. **No meta-commentary:** See Rule 14. **Completion criteria:** See Rule 20.

The root links this file; place a copy-pasteable example adjacent to every numeric or behavioral rule in the steps.

## Reference File Template

Copy this skeleton for each reference file under `references/`.
~~~~md
# Reference: <Topic>

Canonical details for [topic]; recipes point here instead of re-defining the facts.

When to load: [when to open this reference].

## Vocabulary

- **term:** one-line definition of a load-bearing term.

## Options / API Surface

| Option | Type | Default | Description |
|---|---|---|---|
| `option_a` | `string` | `"default"` | What it controls |
| `option_b` | `boolean` | `false` | What it enables |

## Examples

```javascript
console.log(option_a);
```
~~~~

Define jargon once in the Vocabulary line; place a copy-pasteable example adjacent to each rule. Keep each section to one idea; split a reference into a sibling file before it exceeds 120 lines (Rule 19).
