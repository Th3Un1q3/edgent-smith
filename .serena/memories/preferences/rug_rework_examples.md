---
id: preferences/rug_rework_examples
type: preferences
L0: "Rug examples: chain-resume task_id, fan-out Promise.all plus fork_from, fresh validation; link rug-workflow; ban CONTEXT template"
hotness: 0.9
ttl: 90d
version: 2
freshness: 2026-10-21
directory: preferences
provenance: rug.md rework 2026-10-21 grilling Q&A
---
# Rug Examples

Three cases, 5-10 lines each. Full detail in [.opencode/agents/rug-workflow.md](../../.opencode/agents/rug-workflow.md). Ban full CONTEXT template copy-paste.

## 1. Chain resume via task_id

```javascript
const a = await subtask_run({ prompt: "research auth" });
const b = await subtask_run({ prompt: "design API", resume: a.task_id });
const c = await subtask_run({ prompt: "implement", resume: b.task_id });
return c.result;
```

Resume passes `task_id` to continue the chain without cold start.

## 2. Fan-out with Promise.all and fork_from

```javascript
const base = await subtask_run({ prompt: "plan breakdown" });
const parts = await Promise.all([
  subtask_run({ prompt: "build UI", fork_from: base.task_id }),
  subtask_run({ prompt: "build API", fork_from: base.task_id })
]);
return parts.map(p => p.result);
```

Fan-out forks parallel single steps from one parent context.

## 3. Fresh validation, never resume producer

```javascript
const draft = await subtask_run({ prompt: "draft report" });
const verdict = await subtask_run({ prompt: `validate: ${draft.result}` });
if (!verdict.pass) throw new Error("validation failed");
return verdict.result;
```

Validator starts fresh — never resume the producer `task_id`.
