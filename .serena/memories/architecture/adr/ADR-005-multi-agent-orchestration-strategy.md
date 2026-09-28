---
id: ADR-005
title: Multi-agent orchestration for weak, slow local models
status: accepted
date: 2026-09-23
scope: multi-agent orchestration for weak, slow local models; choosing among a code-workflow orchestrator, sequential child spawning, a hybrid, and a zero-subagent memory loop on any harness that offers a code-workflow tool plus a child-spawn primitive
---

# ADR-005: Multi-agent orchestration for weak, slow local models

## Decision

Adopt the hybrid (Option C): drive the code-workflow tool one small subtask per call by default, and use fork and bounded fan-out only for small, independent subtasks over a shared context prefix. Separate validator agents judge complete child outputs; the orchestrator does not.

- A one-subtask workflow call reproduces the read-output-then-decide steering of sequential spawning, so the workflow tool already covers the sequential loop.
- Forking copies the source history into each fork, so the parent never rebuilds that context; small subtasks run over it independently, and prefill is cheap only where the runtime caches the shared prefix (docs/workflow-tool.md).
- Envelope trimming keeps the orchestrator context small; validators, not the orchestrator, receive and judge the untrimmed output.
- Bounded fan-out raises wall-clock throughput on independent work; single-GPU contention is a caveat, not a reason to serialize everything.

Status: accepted 2026-09-23.

## Considerations

### Decision drivers (hard constraints)

- D1 weak, slow local models: the target runs locally on one GPU, is weak, and is slow. The design must not multiply prefill phases, decode tokens, turns, or structured-output handoffs; it must keep context small; and it must isolate each child from accumulated failures. Failing D1 disqualifies an option regardless of raw score.
- D2 tag contract: the model stack rejects native structured output, so children return `<result_json>...</result_json>` parsed with `JSON.parse` and a top-level required-keys check. See mem:architecture/adr/ADR-003-tag-delimited-structured-output.
- D3 minute timeouts: workflow and subtask timeouts are minutes. See mem:architecture/adr/ADR-004-workflow-timeout-units-minutes.
- D4 evidence gap: no repository measurement covers prefill speed, generation speed, context size, or local tool-calling reliability on the target model. Those criteria are scored from architectural reasoning and third-party measurements.

### Context

The pattern needs two primitives: a code-workflow tool that spawns and composes children, and a child-spawn primitive. Any harness with both can implement it; OpenCode's workflow tool is the reference implementation today.

Four options:

- A code-workflow orchestrator. One script composes children into chains (`await`), maps and fan-out (`Promise.all`), retry loops, and output branches. Hand-off is the serialized result, typed `data` plus capped text, under the rule "pass references, not payloads".
- B sequential spawning. Spawn one child, read its output, spawn the next. Durable state lives in the orchestrator's todo list; validation runs in a fresh session.
- C hybrid. The sequential loop as the default, with fork and bounded fan-out for small, independent, verifiable subtasks, and separate validator agents.
- D zero sub-agents. One agent maintains and prunes working memory and advances through loops or handovers, with no child spawn.

Facts behind the criteria:

1. Prefill is compute-bound and sets time-to-first-token; decode is memory-bandwidth-bound and sets per-token latency. A fresh child pays a fixed preamble; an accumulated context grows super-linearly per turn.
2. Forking a session copies the source history into each fork (docs/workflow-tool.md), so the parent never re-supplies or rebuilds that context and several small subtasks can run over it independently, optionally in parallel. Book case: read once, fork one summarizer per chapter, synthesize. Prefill is cheap only where the runtime caches the shared prefix; each fork counts against the subtask and concurrency budgets, and N forks multiply the source document's token cost.
3. Bounded fan-out over a shared prefix raises throughput on independent work. On one GPU it can trade per-child latency for throughput. The 28.3x time-between-tokens regression in the cited study comes from naive prefill-plus-decode batching, not shared-prefix fan-out, so it bounds the risk rather than measuring it.
4. Weak and quantized models do not fail differently, they fail more: INT4 raised tool-name hallucination from 19.5% to 38.3% and turns per episode. Every extra turn, tool call, and structured handoff multiplies failures.
5. A fresh child context shields a child from prior failures. Tool-selection accuracy decays from 0.873 at 8K tokens to 0.741 at 64K, so one growing context degrades.
6. Extended reasoning hurts small models: 8 to 16 reasoning tokens helps function calling; 256 drops below the no-reasoning baseline.

Children inherit the parent model, so routing easy work to a smaller model needs new plumbing.

### Options considered

#### Option A: Code-workflow orchestrator

Pros:
- Forking copies the source history once per fork, so the parent never rebuilds the shared context by hand and small subtasks over one document can run independently, optionally in parallel; prefill is cheap only where the runtime caches the shared prefix (the book pattern; docs/workflow-tool.md).
- Bounded `Promise.all` fan-out over a shared prefix raises throughput on independent work.
- The result envelope trims child output to a bounded size, keeping the orchestrator context small; the complete output goes to a separate validator.
- Fresh child sessions isolate each child, and composition into chains, maps, reduce, and branches is code, so it is testable and replayable.

Cons:
- N fresh children still pay N fixed preambles. Each fork copies the source history and counts against the subtask and concurrency budgets, so fork cost scales with the shared document.
- Fan-out on one GPU can trade per-child latency for throughput, and the runtime's batching behavior is not documented for the target stack.
- A code-first default multiplies turns, tool calls, and tag-contract handoffs, the failure channel weak models amplify most, unless the script guards on `status` and `data`.
- The 8 KB envelope can drop `steps[]`, and `budget_exceeded` can report more subtasks than step records, so the orchestrator cannot see every executed child from the envelope alone. The full output is still available to a validator.

Disposition: rejected. Two points behind the hybrid, and its code-first default fans out where the hybrid stays sequential.

#### Option B: Sequential spawning, one child at a time

Pros:
- One child in flight keeps the orchestrator context small: it reads one output and discards it.
- A fresh validator catches a bad result before it is chained: resume, relaunch, and treat truncated reports as failures.
- Direct reads mean no envelope cap, so the orchestrator sees the full result.
- The simplest wiring: agent definitions only.

Cons:
- Fully serial, so total time is the sum of child times and independent work does not overlap.
- To pass one child's output into the next, the orchestrator reads it and re-emits it by hand, so the same text is generated twice: once by the child, once by the parent at decode speed.
- Per-step reflection adds a round trip per step, and planning recurs every turn, where a weak orchestrator can stall or loop.
- Each child still pays its fixed preamble, serially.

Disposition: rejected. Its loop is the hybrid's default shape, but standalone it gives up fork reuse and bounded fan-out for no reliability gain.

#### Option C: Hybrid, sequential default with bounded fan-out

Pros:
- A one-subtask workflow call reproduces B's read-then-decide loop, so the hybrid covers the sequential path through one tool and A and B are closer than their shapes suggest.
- Fork and bounded fan-out are available only for small, independent, verifiable subtasks, where shared-prefix reuse (cheap only where the runtime caches the prefix) and overlap pay off.
- The result envelope keeps the orchestrator context small, and full child output goes to separate validator agents, so the orchestrator is not the judge.
- A policy over wired primitives: it adds no runtime and no failure surface when fan-out is unused.

Cons:
- The fan-out decision rests on orchestrator judgement, a weak-model risk: a weak orchestrator can misclassify work as independent.
- The runtime does not enforce the small, independent, verifiable rule.
- Fanned-out children are validated after the fact, with less inspection than a strictly sequential loop.

Disposition: chosen. Leads the raw total, keeps B's sequential loop as its default, and retains A's fork reuse and bounded overlap.

#### Option D: Zero sub-agents, one agent with maintained and pruned memory

Pros:
- Fewest turns, tool calls, and structured handoffs, so the fewest failure channels.
- No per-child preamble, so no repeated fixed prefill.
- One agent, one tool set, one context: the most portable shape, with nothing hidden by an envelope.

Cons:
- One context grows every turn into the super-linear prefill regime, with near-zero prefix reuse.
- No isolation: failures and debugging traces accumulate, tool-selection accuracy decays, and no independent validator exists.
- Fully serial, with no overlap.
- Pruning is lossy, and aggressive pruning drops needed signal.

Disposition: rejected. Fails D1 on prefill (PS -2), context size (CX -2), and isolation (CI -2).

**A versus B, head to head.** Both options spawn a fresh child per subtask, so both isolate each child from accumulated failures (CI +2 each). A wins prefill speed (+1 vs 0) because it forks a session, so the parent never rebuilds the shared context, and prefill is cheap only where the runtime caches the shared prefix (docs/workflow-tool.md). A wins generation speed (+1 vs -1) because the parent passes a result by reference instead of re-emitting it, and wins parallelism (+2 vs -1) through bounded fan-out. B wins context size (+2 vs +1) because it keeps one child in flight, recoverability (+2 vs +1) because it reads each child's full output directly, and implementation complexity (+2 vs 0) because it needs agent definitions only. On reliability on weak models (RW), B scores 0 against A's -1: A's code-first default multiplies turns, tool calls, and tag-contract handoffs, the failure channel weak models amplify most, unless the script guards on `status` and `data`. Net, A leads B +7 to +6, and the whole lead is prefill, generation speed, and parallelism.

**Which works better for less capable models: B.** On the criterion that isolates the question, RW reliability on weak models, B outscores A (0 vs -1). A weak orchestrator fails more with every extra turn, tool call, and structured handoff, and B keeps exactly one child in flight while A's code-first default fans out, so B's one-subtask-at-a-time path carries the smaller failure channel. A's +1 total lead is a speed and parallelism result, not a weak-model reliability result, so it does not transfer to the weakest models. The chosen hybrid (Option C) takes B's sequential loop as its default for this reason and adds A's fork and bounded fan-out only for small, independent, verifiable subtasks.

### Scoring

Each criterion is scored -2..+2; higher is better, and higher IC means simpler and cheaper. These eight criteria replace the four defaults in mem:architecture/about (maintainability, flexibility, implementation ease, initial implementation cost) because D1 makes prefill, decode, context size, reliability, and isolation the decision drivers. PS, GS, CX, RW, and CI are must-haves under D1.

- PS prefill speed: time-to-first-token, prefill tokens per turn, fresh-child preamble count, prefix-cache reuse.
- GS generation speed: tokens per second, total generated tokens, turns and reasoning tokens per task.
- CX context size: peak parent context, per-child context, growth per turn, compaction behavior.
- RW reliability on weak models: tag-parse failure rate, hallucinated tool rate, retries per child, turns per task.
- CI context isolation: whether each child gets a fresh context or inherits accumulated failures.
- RC recoverability: share of bad steps caught before propagation, recovery success, validator independence.
- PL parallelism: presence and safety of a bounded fan-out primitive, wall-clock versus sum of parts.
- IC implementation complexity: wired versus scaffold, new code needed, reusable artifacts.

| Criterion | A | B | C | D |
| --- | --- | --- | --- | --- |
| PS prefill speed | +1 | 0 | +1 | -2 |
| GS generation speed | +1 | -1 | 0 | -1 |
| CX context size | +1 | +2 | +2 | -2 |
| RW reliability on weak models | -1 | 0 | +1 | 0 |
| CI context isolation | +2 | +2 | +2 | -2 |
| RC recoverability | +1 | +2 | +2 | -1 |
| PL parallelism | +2 | -1 | +1 | -1 |
| IC implementation complexity | 0 | +2 | 0 | +1 |
| Total | +7 | +6 | +9 | -8 |

Ranking: C +9, A +7, B +6, D -8.

PS note: fork reuse and fresh-child preambles are weighed together. A fork inherits the source context, so the parent never rebuilds it, and prefill is cheap only where the runtime caches the shared prefix; a non-fork fresh child pays its own full preamble, and N forks multiply the source document's tokens (docs/workflow-tool.md). A and C both score +1: A earns fork reuse but its code-first default pays a preamble per fresh child (its cons), while C's default keeps each call to one small child. B has no fork (0); D never reuses a prefix (-2).

No constraint override applies: D1 is encoded in the must-have criteria, it eliminates D, and the raw winner C also satisfies D1 best.

### Consequences

Positive: the orchestrator context stays small because envelopes trim child output and validators, not the orchestrator, judge full results; fork inheritance and bounded fan-out recover the prefill and throughput a strict sequential loop gives up where the runtime caches the shared prefix; the pattern is a policy over wired primitives, so it adds no runtime and applies to any harness with a code-workflow tool plus a child-spawn primitive; a one-subtask workflow call still covers the simple sequential case.

Negative: the fan-out decision rests on orchestrator judgement, a weak-model risk; the runtime does not enforce the small, independent, verifiable rule; the two-point margin of C over A sits inside the D4 evidence gap; tiering stays unavailable while children inherit the parent model; and the 8 KB envelope can hide executed children from the orchestrator's own view.

### References

Repository:
- `docs/workflow-tool.md`: fork and fan-out semantics, `max_concurrent` and `max_subtasks` budgets, envelope and step caps, tag-contract retry.
- `docs/harness-engineering-patterns.md`: context pollution, pruning risk, minimal harness, compaction.
- `docs/ideas.md`: persistent KV cache for multi-agent edge inference.
- mem:architecture/adr/ADR-003-tag-delimited-structured-output, mem:architecture/adr/ADR-004-workflow-timeout-units-minutes.

External: Sarathi-Serve OSDI 2024 on prefill and decode batching; ContextPilot arXiv 2511.03475 on long-context prefill; ToolStretch clawrxiv 2604.01955 on tool-selection decay; Flat Score, Amplified Failures arXiv 2607.27275 on quantized agent failures; CodeDelegator arXiv 2601.14914 on context isolation; CoT budget for function calling arXiv 2604.02155.
