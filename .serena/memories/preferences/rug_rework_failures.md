---
id: preferences/rug_rework_failures
type: preferences
L0: "Rug failures: permission plus empty plus cap-exhausted; try-catch plus subtask_ls caps with non-empty checks"
hotness: 0.9
ttl: 90d
version: 1
freshness: 2026-10-21
directory: preferences
provenance: rug.md rework 2026-10-21 grilling Q&A
---
# Rug Failures

Three failure modes and handling.

1. **permission** — subtask denied. Catch, report exact denial, continue rest with permitted actions.
2. **empty** — gateway returns empty or `content:[]`. Treat as infra flake, fall back once, check non-empty before synthesis.
3. **cap-exhausted** — budget or context cap hit. Stop fanning out, return partial with blocker note.

Pattern:

```javascript
try {
  const r = await subtask_run({ prompt });
  if (!r || !r.result) throw new Error("empty subtask result");
  const live = await subtask_ls({ cap: 10 });
  if (!live || live.length === 0) throw new Error("empty subtask list");
  return r.result;
} catch (e) {
  report(e.message);
  return null;
}
```

Always: try/catch around `subtask_run`, cap `subtask_ls`, verify non-empty before use.
