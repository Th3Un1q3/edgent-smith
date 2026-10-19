---
id: ADR-010
title: Inject workflow instructions when the workflow tool is exposed
status: proposed
date: 2026-10-19
scope: OpenCode RUG harness; prompt injection of workflow guidance for every agent whose request exposes the workflow tool
---

# ADR-010: Inject workflow instructions when the workflow tool is exposed

## Decision

Workflow guidance is injected by a dedicated OpenCode plugin, `opencode.workflow-instructions`, loaded from the entry file `.opencode/plugins/workflow-instructions.ts`, with its payload in `.opencode/plugins/helpers/workflow-tool-instructions.ts`. On the `@opencode/plugin` 2.0.24 Effect surface, the plugin's `context` hook appends one versioned `<workflow_instructions version="1">` block to `event.system` when `'workflow' in event.tools` (the request tool map typed as `SessionContext.tools`) and injects nothing when that key is absent, so every definition that exposes `workflow` inherits the block without an edit. The hook keeps one block per request: it strips any block carrying the version sentinel and appends exactly one; it skips the whole block and logs when it exceeds 4 KB, and fails open: its body runs inside `Effect.catchAll` plus `catchAllDefect`, and the failure branch logs and returns `Effect.void`, so a hook or render error never fails the session. Injection is the whole decision; trimming the tool description and retiring agent-definition prose follow from it and are constrained under Consequences.

## Considerations

### Context

Workflow guidance lives in two containers. `.opencode/plugins/workflow.ts:91-115` registers `workflow`; its description is a 35-entry array at `:16-52`, passed at `:97`, rendering to 2,215 bytes. The description documents `subtask`, `log`, the result envelope, the script guard, and the error statuses; its only usage line is the per-subtask `skills` note at `:29`, which loads skill text, not workflow rules. The second container is `.opencode/agents/rug-workflow.md` — 53,192 bytes, 686 lines, 7,998 words — which only that definition loads. A definition that exposes `workflow` without repeating that prose hands the agent the tool and no rules. The repository holds no measurement of description obedience; the verifiable cost is bytes per request.

The harness already injects conditionally, on file paths. `instructions-loader.ts:84` hooks `execute.before`; `:14` and `:85-86` gate on `TARGETED_TOOLS = new Set(['edit', 'write', 'read'])` plus a path; `:124-129` pushes text into `event.system` (`:127`). The v2 session context exposes the per-request map as `tools: Record<string, { description; input }>` (`dist/effect/session.d.ts:29-34`, field at `:31`). `context.tool.list()` is not typed as per-request and is not relied on for the trigger.

The plugin API is `@opencode/plugin` 2.0.24; `.opencode/bun.lock` pins sdk 1.18.34 and the plugin at 2.0.24. The runtime version comes from `opencode --version`, not from those lines. The typings define neither inter-plugin hook order nor whether `event.system` mutations persist across turns, so dedupe runs per request and eviction is not promised. Text under `.opencode/instructions/*.instructions.md` is indexed by the edit-path loader (`instructions-loader.ts:66-70`), so the payload cannot live there. Forces: correctness (apply exactly when `workflow` is exposed), context cost (bounded, no duplicate, cache-stable), single ownership (one payload, one version), portability (fail open, no claim for other harnesses), observability (one event per attempt), reversibility (revert the plugin).

Evidence: `mem:architecture/adr-rules`, `mem:architecture/adr-template`, `mem:architecture/about`; registration `.opencode/plugins/workflow.ts`; loader `.opencode/plugins/instructions-loader.ts`; typing `dist/effect/session.d.ts`.

### Options considered

#### Option A: Keep the agent-definition prose and the tool description

Pros:
- Costs nothing to build and changes no runtime behavior.
- The prose sits in the same definition as that agent's tool grants, so its reader finds it in context.
Cons:
- Does not travel: an exposing definition without the prose gets no guidance.
- Guidance is reviewed separately from the tool, and nothing detects divergence.
- The description already carries usage text at `:29` alongside the call contract.

#### Option B: Expand the tool description and drop agent prose

Pros:
- Travels with the tool schema to every agent that receives the tool.
- Requires no plugin API surface.
Cons:
- Turns the description into an instruction manual that competes with the call contract.
- Every guidance edit becomes a plugin-code change with no separate version.
- No injection event, no cap, and no measure of whether guidance reached the model.

#### Option C: One shared text referenced from each agent definition

Pros:
- One canonical file, cheap to author.
- No runtime dependency.
Cons:
- Markdown agent definitions have no verified runtime include, so each definition embeds a copy.
- Every new exposing definition needs a manual edit, and nothing detects a missed one.
- Copies drift without a shared version.

#### Option D: A static skill or instruction file

Pros:
- Reuses the existing instruction channel and review path.
- No new plugin.
Cons:
- The loader indexes `.opencode/instructions/*.instructions.md` and gates on edit/write/read plus a path (`instructions-loader.ts:14`, `:66-70`, `:85-86`), not on tool availability.
- A file there fires on file edits and never on workflow use, unless the loader's target set changes, which mixes path and tool triggers.
- The payload would sit under the same glob, so edit-path injection can duplicate it.
- Skills load when an agent or subtask asks for one, so a skill cannot trigger on tool exposure.

#### Option E: A dedicated plugin gated on the request tool map

Pros:
- The trigger is the tool map, so the text reaches every agent that exposes `workflow`, including definitions added later.
- One payload, one version, one testable injection point.
- Lives outside the instruction glob, so the edit-path loader cannot double-inject it.
Cons:
- A new plugin adds a silent failure mode: if it does not load, nothing reports.
- Depends on the v2 Effect surface and on `SessionContext.tools` keeping its shape.
- A second plugin now writes to `event.system`, so hook order and duplicate text become review concerns.

#### Option F: Co-locate injection in `workflow.ts`

Pros:
- The tool and its instructions ship in one file, so they cannot version apart.
- No second plugin; same hook and gate as Option E.
Cons:
- Mixes prompt text with tool registration, so `workflow.ts` owns two contracts.
- Testing the renderer requires loading the tool plugin, so prompt tests depend on tool registration.
- A change to either contract touches the same file, widening review.

### Scoring

Criteria (each scored -2 to +2):
- Maintainability: ease of understanding and evolving over time
- Flexibility: adaptability to future requirements
- Implementation ease: straightforwardness with the current stack
- Initial implementation cost: effort to build (higher score = cheaper)

| Criterion | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Maintainability | -1 | -2 | 0 | 1 | 1 | 0 |
| Flexibility | -1 | -2 | 0 | -1 | 2 | 1 |
| Implementation ease | 2 | 2 | 1 | 1 | 0 | 0 |
| Initial implementation cost | 2 | 2 | 1 | 1 | 0 | 1 |
| Total | 2 | 0 | 2 | 2 | 3 | 2 |

Option E wins on total. A hard constraint decides the primary mechanism: guidance must apply exactly when `workflow` is exposed, stay out of the tool contract, and carry its own version and cap. A and C fail reach; B fails separation and versioning; D fails the trigger. E and F satisfy the constraint, and E wins on maintainability because the renderer tests without tool registration.

### Consequences

Positive:
- Every agent that exposes `workflow` receives the same guidance, including definitions added later, with no edit to those definitions.
- One versioned payload and one review path; a golden fixture pins the rendered block and its version.
- Sessions without `workflow` pay nothing.
- Acceptance is testable: a fixture for the rendered block, an exactly-once test with the tool present, and an absence test without it.

**Description budget.** The rendered description is capped at 1,600 bytes (currently 2,215 bytes), enforced by a fixture that reads the rendered string. Deletions required to meet the cap: the Patterns block at `workflow.ts:34-37`, the Example at `:49-51`, and the defaults restated at `:23`, `:26`, `:27`, which the input schema at `:54-64` already carries. Retained subset: the tool's purpose, `subtask` and `log` semantics, the result envelope, the script guard, and the error statuses. The `skills` note at `:29` is the one non-contract line in the current description; it moves into the block rather than staying, so the description afterwards carries only the call contract. Parity check: a fixture compares the retained lines against the block, and every deleted line must appear in the block or the input schema; the fixture fails when the rendered description exceeds 1,600 bytes, a retained line is missing, or a deleted line is absent from both.

**Agent-definition prose.** Retiring prose from `.opencode/agents/rug-workflow.md` is a follow-on consequence, not part of the injection decision, and happens only after a content-parity check. The definition retains its tool grants, model settings, agent identity, and any statement that is specific to that agent; the workflow mechanics prose is removed only when every normative sentence in the 53,192-byte file maps to the block or to a definition-specific item. A line qualifies as definition-specific only when it names the agent's identity, model settings, tool grants, or output contract and contains no workflow-mechanics term (`workflow`, `subtask`, `log`, the script guard, the error statuses). The check is a line-by-line checklist reviewed before deletion; it fails when a retained line matches a workflow-mechanics term or a deleted line maps to neither the block nor the input schema. The deletion lands only after at least 20 sessions show the block reaching every workflow-exposing session.

**Cache cost.** Expected block presence is one block per request while `workflow` is in the request tool map and zero otherwise. The block is appended at the end of `event.system` and is byte-identical for a given version, so the system prefix through the block stays stable and only the history after it is mutable. At 4 KB and roughly 4 bytes per token the block is about 1,000 tokens: the first exposure pays a cache write near 1.25x input price (about 1,250 token-equivalents), and later exposures of the same version read the cached prefix, so the steady-state cost is a cache read on about 1,000 tokens. If dedupe makes presence alternate — an intermittent persisted `event.system` where the sentinel survives one turn and not the next — each toggle breaks the cached prefix at the block offset, so present requests rewrite the 1,000-token block at cache-write price and the trailing history is re-read after every toggle. Alternation therefore costs more than either always-present or always-absent. The design removes alternation: the hook strips any existing block that carries the version sentinel and appends exactly one, so presence is exactly one block per request whether or not a previous block persisted. The bound is one block, at most 4 KB, in any accumulated `event.system` string; the block keeps identical bytes, so the cached prefix through it stays valid. Measure cache-read and cache-write token counts during the dual run and revisit the cap if the block grows.

**Observability.** Each attempt emits one JSON event named `workflow_instructions.injection` through the plugin logger into the OpenCode log sink (`~/.local/share/opencode/log/`; `opencode --print-logs` when the directory is not readable). Fields: `ts`, `sessionID`, `agent`, payload `version`, `bytes`, `outcome` (`injected | skipped | failed`), and `reason`. `reason` is always present and takes one value per outcome: `injected` → `no-prior-block` or `replaced-prior-block`; `skipped` → `no-tool-map` or `cap-exceeded`; `failed` → `render-error` or `hook-error`. A reviewer queries `rg '"event":"workflow_instructions.injection"' ~/.local/share/opencode/log/ | jq -c` and counts events per `sessionID`, filters `outcome=="failed"`, and groups `outcome=="skipped"` by `reason` to separate `no-tool-map` from `cap-exceeded`.

**Precedence review rule.** Precedence is a review rule, not a mechanism. During the dual run both the block and the definition prose reach the model; reviewers treat the block as authoritative for workflow mechanics and reject a definition whose prose contradicts it. Nothing enforces order at runtime, and the rule lapses when the prose is retired.

Negative:
- The plugin can fail silently. If the file is not loaded, no block appears and no session reports it; the tests and the dual-run observation are the only detection.
- Fail-open behavior is implemented, not incidental: a render or hook error is caught inside the Effect body (`catchAll` for typed failures, `catchAllDefect` for thrown errors), logged as `outcome: "failed"`, and returned as `Effect.void`. A broken plugin therefore changes agent behavior silently; there is no user-facing error.
- The payload costs up to 4 KB per request while `workflow` is exposed, with the cache behavior above.
- Removing `workflow` mid-session stops injection on the next request only; text already accumulated in a persistent system prompt may remain.
- If the edit-path loader's target set later includes `workflow`, both it and this plugin can write to `event.system`; the sentinel strips only this plugin's block.
- The payload version and the text can drift if an edit skips the fixture.
- The mechanism is OpenCode-only. The record makes no claim about Copilot or DSH.
- Hook absent: if the plugin is not loaded or the `context` hook is renamed, no block appears and no error surfaces.
- Tool map unavailable: if `event.tools` is missing or malformed after an API change, the hook records `skipped` with reason `no-tool-map` and injects nothing.
- Cap exceeded: the whole block is skipped and logged; partial instructions never reach the model.
- Version drift: a change past `@opencode/plugin` 2.0.24 or in the shape of `SessionContext.tools` can break load or gate; the fixture and dual run detect it.

Neutral:
- The change adds two files: the plugin entry `.opencode/plugins/workflow-instructions.ts` and the payload `.opencode/plugins/helpers/workflow-tool-instructions.ts`. The plugin id `opencode.workflow-instructions` is a label; under directory scanning the load unit is the entry file, so the file must exist at that path.
- Dual run: the prose stays until at least 20 sessions show exactly one injection per workflow-exposing session, no injection without the tool, and no failed events.
- Rollback: revert the plugin and payload files and restore the prose from git. No runtime flag is verified, so rollback is a code revert, not a configuration change.
- Revisit when `@opencode/plugin` moves past 2.0.24, `SessionContext.tools` changes shape, another registrar adds a tool named `workflow`, another harness needs the same behavior, or the cap is exceeded or a duplicate is observed.
