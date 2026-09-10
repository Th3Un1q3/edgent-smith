> Part of [DeepSeek Harness Guide](index.md) — L2 · Workflows

# Workflows — Both Agents Within the Harness

> L2 · All 6 patterns share one contract.

`create_goal` + `todo_write` → worker `subagent` → `artefact_ref` + summary via `workspace/*.md` → validation worker → bounded follow-up.

---

## Prompt contract — every `subagent` prompt includes

```
CONTEXT — original user request verbatim + decomposed task
YOUR TASK — specific task for this worker
SCOPE — files to modify / create / NOT to touch
REQUIREMENTS — concrete requirements
ACCEPTANCE CRITERIA — verifiable checkboxes
CONSTRAINTS — echo user stack as non-negotiable, forbid substitutes
WHEN DONE — report files changed, summary, concerns, per-criterion confirmation
```

Orchestrator decomposes; worker executes one task and writes one artefact.

---

## 4.1 Decompose

Orchestrator never implements decomposition as code — it delegates.

1. Launch discovery worker via `subagent`: "search `.serena/memories/` (list domains, read `about.md`), scan `.agents/skills/` for matching skills, read relevant `AGENTS.md`."
2. `create_goal` with persisted completion objective.
3. `todo_write` full todo list **before** any implementation worker. Every todo uses `#{type}: {description}` (e.g., `#discovery:`, `#execute:`, `#validation:`).
4. Decompose goal into discrete, independently-completable tasks (one file = one worker; research/implementation/verification separate).

Worker tools: `tool-fs-search`, `tool-fs`, `mcp-gateway` (tavily) — all child-runtime harness-provided.

---

## 4.2 Parallel Fan-Out

Both roles harness-native; fan-out uses harness primitives, not code.

- `subagent` with `backgroundMode: continuable` returns job id per worker.
- Launch independent workers in background together; collect via `job_list` / `job_output`.
- `todo_write` marks each task `in_progress` on launch; validation worker marks `completed`.
- Concurrency bounded by harness `maxTokens: 49152` per child and `todo_write` ledger — not external semaphores.

No external concurrency limiter — ledger is limiter.

---

## 4.3 Sequential Chain

Chain via dependency in prompts. Orchestrator passes prior `artefact_ref` + summary into next `subagent` prompt. Both harness-provided:

- `send_message` to resume worker with follow-up context (session resumption).
- Launch fresh worker with prior refs in `CONTEXT`.

Use `history` propagation inside harness session; no external plumbing.

---

## 4.4 Hybrid DAG

Todo ledger encodes DAG. Orchestrator enforces levels via `todo_write`; workers enforce edges.

| Condition | Action |
|-----------|--------|
| No `depends_on` | Launch parallel via `subagent` continuable |
| Has `depends_on` | Wait for `todo_write` completion of dependencies before launching |
| Validation | Dedicated validation worker checks edges — never trust worker self-assessment |

Termination requires every todo `completed` and every task validated by separate worker.

---

## 4.5 Consolidation

Not orchestrator synthesis — dedicated validation workers (child-runtime).

- **Validation workers** (always separate, always fresh): read files via `tool-fs`, check each acceptance criterion against evidence, verify spec compliance (technology substitution = automatic FAIL), check medium-appropriateness, look for bugs/edge cases, run `tool-bash` tests/type checks. Report per-criterion PASS/FAIL + overall verdict. Never hand validator expected verdict — give intent and consumer.
- **Integration-validation worker** after all todos complete: confirms everything works together.
- **Follow-up gating:** on FAIL, launch **new** worker with original prompt + validation failure report + fix instructions (do not reuse failed context) or `send_message` resume.

Termination requires: every todo `completed` + every task validated by separate worker (evidence via `tool-fs` + `tool-bash`) + final integration worker passed + orchestrator did zero direct implementation.

---

## 4.6 Follow-Up (Bounded)

Both roles use harness-provided recovery:

```
validation FAIL → new subagent(fresh prompt + failure report + SPECIFIC fix instructions)
silent failure  → send_message(worker, "detailed status report") → if resume fails → fresh subagent("assume nothing done")
plan phase      → plan-mode: non-mutating reads only, exit_plan_mode with decision-complete plan
```

`plan-mode` plugin (`@deepseek-ai/dsh-tool-plan-mode`) gates non-mutating reads during planning. `maxRounds: 64` on `tool-ralph` caps repetition if enabled. Checklist TBD items use concatenation (`TO` `DO`) to keep file health gate green.

---

← [Index](index.md) · [Next: Reference →](05-reference.md)
