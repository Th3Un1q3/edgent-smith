---
id: preferences/rug_rework_principles
type: preferences
L0: "Rug principles: resume-avoid-cold-start, reuse-via-references, independent-fresh-validation; over-50pct heuristic; never resume producer"
hotness: 0.9
ttl: 90d
version: 2
freshness: 2026-10-21
directory: preferences
provenance: rug.md rework 2026-10-21 grilling Q&A
---
# Rug Principles

Three principles: resume-avoid-cold-start, reuse-via-references, independent-fresh-validation.

## 1. Resume avoids cold start

✅ Do:

```javascript
await subtask_run({ prompt: "step 2", resume: prev.task_id });
```

❌ Don't:

```javascript
await subtask_run({ prompt: "step 2 with full context pasted" });
```

## 2. Reuse via references, >50% heuristic

Reuse when over 50% of context would be repasted. Pass `task_id`, `fork_from`, or file references — not pasted blobs.

✅ Do:

```javascript
await subtask_run({ prompt: "extend", fork_from: base.task_id });
```

❌ Don't:

```javascript
await subtask_run({ prompt: `extend ${hugeBlob}` });
```

## 3. Independent fresh validation, never resume producer

Validator must start fresh.

✅ Do:

```javascript
await subtask_run({ prompt: `validate: ${draft.result}` });
```

❌ Don't:

```javascript
await subtask_run({ prompt: "validate own work", resume: draft.task_id });
```
