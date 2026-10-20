---
id: ADR-010
title: Inject workflow instructions when the workflow tool is exposed
status: proposed
date: 2026-10-19
scope: OpenCode RUG harness; prompt injection of workflow guidance for every agent whose request exposes the workflow tool
---

# ADR-010: Inject workflow instructions when the workflow tool is exposed

## Decision

Workflow guidance is injected from `.opencode/plugins/workflow.ts`, the module that already registers the `workflow` tool at `:91-115`. The same module registers the tool and `context.session.hook('context', ...)`. On the `@opencode/plugin` 2.0.24 Effect surface, the hook appends one `<workflow_instructions source="...">` block to `event.system` when the request tool map (typed as `SessionContext.tools`) contains a model-visible exposure tool: `WORKFLOW_EXPOSURE_TOOLS = ['workflow', 'execute']` (`workflow.ts:33`). That map never carries `workflow`. Registering a plugin tool is not the same as exposing it to the model: the harness collapses plugin tools into the Code Mode tool `execute`, so a request that can call `workflow` lists `execute`, and `workflow` is accepted only for a harness that surfaces it directly. The hook injects nothing when neither key is present, so every request that can reach the tool inherits the block without an edit to its definition. Verified on 2026-10-20: a standalone session logged `workflow.instructions.injected blockBytes=9560 exposure=execute`, a 9,560-byte block against the 9,499-byte source file plus the 61-byte wrapper. `context.tool.list()` is global rather than per-request and is not used as the trigger. The instruction source is `harnessConfig.plugins["workflow"].instructions` in `.opencode/plugins/config/harness.config.ts`: a repository-relative path resolved against the project directory (`context.location.directory`), defaulting to `.agents/skills/task-delegation/SKILL.md`. The whole file is loaded and injected verbatim, with no size limit, truncation, or skip. The path is resolved and the file read once, inside the plugin's `effect` generator before it yields the tool and hook registrations, so a read failure throws during plugin load; the plugin signature has no typed error channel (`Effect.Effect<void, never, R>`, `plugin.d.ts:56`), so the throw becomes a defect that the loader reports, not a per-request failure inside the hook. The read decodes the bytes as UTF-8, which never throws, then rejects an empty result or one containing a NUL byte or a U+FFFD replacement character, the marker for invalid UTF-8; any of those throws an Error naming the configured path and the cause, so initialization fails visibly and the session reports it. Do not swallow that error with `catchAll` or `catchAllDefect`, and do not fall back to an empty payload. After a successful load the content is cached for the plugin lifetime and the resolved path is fixed, so a change to the file or to the configured path requires a restart. The hook keeps one block per request: it strips any block carrying the sentinel and appends exactly one. The payload is the configured file verbatim; the tool description is the single authority for core mechanics. Injection is the whole decision; trimming the tool description and retiring agent-definition prose follow from it and are constrained under Consequences.

The config surface follows the repository, not the other way around. Local plugins are auto-discovered from `.opencode/plugins/*.ts`. `Context.options: PluginOptions` exists (`plugin.d.ts:28`), but a discovered module receives empty options, and only an explicit `plugins` entry can supply them; adding one for an auto-discovered module would load it twice. `PluginOptions` is `Readonly<Record<string, any>>` with no declared key and no documented source for a discovered local plugin, so a path supplied at load time has nowhere to come from. `harness.config.ts` is the established plugin config module and siblings already import it (`goal-continuation.ts:24`, `tool-limit-reminder.ts:32`, `helpers/gate-config.ts:2`), so `harnessConfig.plugins["workflow"].instructions` puts the pointer where plugin configuration already lives.

This hook is distinct from the edit-path loader. `.opencode/plugins/instructions-loader.ts` gates on `execute.before` (`:84`) with `TARGETED_TOOLS = new Set(['edit', 'write', 'read'])` plus a matching input path, so it fires only on file work; its own `context` hook (`:124`) only flushes text that gate queued. This hook registers as `context.session.hook('context', ...)`, gates on the request tool map containing `execute` or `workflow`, and fires for every agent that can reach the tool, regardless of file paths. Gating happens on the `context` hook, not on `execute.before`.

## Considerations

### Context

Workflow guidance currently lives in two containers. `.opencode/plugins/workflow.ts:91-115` registers `workflow`; its description is a 35-entry array at `:16-52`, passed at `:97`, rendering to 2,205 bytes when the entries are joined with newlines. The description documents `subtask`, `log`, the result envelope, the script guard, and the error statuses; its usage text is the per-subtask `skills` note at `:29`, which loads skill text rather than workflow rules, plus the Patterns block at `:34-37` and the Example at `:49-51`, both guidance that moves out of the description. The second container is `.opencode/agents/rug-workflow.md` — 53,165 bytes, 686 lines, 7,990 words — which only that definition loads. A definition that exposes `workflow` without repeating that prose hands the agent the tool and no rules. The repository holds no measurement of description obedience; the verifiable cost is bytes per request.

The harness already injects conditionally, on file paths. `instructions-loader.ts:84` hooks `execute.before`; `:14` and `:85-86` gate on `TARGETED_TOOLS = new Set(['edit', 'write', 'read'])` plus a path; `:124-129` pushes text into `event.system` (`:127`). The v2 session context exposes the per-request map as `tools: Record<string, { description; input }>` (`dist/effect/session.d.ts:29-34`, field at `:31`). That map is the model-visible surface, and it lists plugin tools under `execute` rather than under each plugin tool's own name, so a gate that looks only for `workflow` never fires. `context.tool.list()` is not typed as per-request and is not relied on for the trigger.

The plugin API is `@opencode/plugin` 2.0.24; `.opencode/bun.lock` pins sdk 1.18.34 and the plugin at 2.0.24. The runtime version comes from `opencode --version`, not from those lines. The typings define neither inter-plugin hook order nor whether `event.system` mutations persist across turns, so dedupe runs per request and eviction is not promised. Text under `.opencode/instructions/*.instructions.md` is indexed by the edit-path loader (`instructions-loader.ts:66-70`), so the payload cannot live there. The configured path can point anywhere else, which is why the default is the task-delegation skill rather than an instruction file. Forces: correctness (apply exactly when the request exposes a tool that reaches `workflow`, which the map shows as `execute`), context cost (whatever the configured source costs, one block, cache-stable), single ownership (one configured source, one read, one module), portability (no claim for other harnesses), observability (one event per injection, with measured bytes), reversibility (repoint the config or revert the module).

Evidence: `mem:architecture/adr-rules`, `mem:architecture/adr-template`, `mem:architecture/about`; registration `.opencode/plugins/workflow.ts`; config `.opencode/plugins/config/harness.config.ts`; loader `.opencode/plugins/instructions-loader.ts`; typing `dist/effect/session.d.ts`; verified injection log from a standalone session (2026-10-20).

### Options considered

#### Option A: Keep the agent-definition prose and the tool description

Pros:
- Costs nothing to build and changes no runtime behavior.
- The prose sits in the same definition as that agent's tool grants, so its reader finds it in context.
Cons:
- Does not travel: an exposing definition without the prose gets no guidance.
- Guidance is reviewed separately from the tool, and nothing detects divergence.
- The description carries the per-subtask `skills` note at `:29` next to call mechanics, so guidance shares a container with the contract.

#### Option B: Expand the tool description and drop agent prose

Pros:
- Travels with the tool schema to every agent that receives the tool.
- Requires no plugin API surface.
Cons:
- Turns the description into an instruction manual that competes with the call contract.
- Every guidance edit becomes a plugin-code change with no separate source.
- No injection event and no measure of whether guidance reached the model.

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
- The trigger is the model-visible tool map, so the text reaches every agent whose request exposes `execute` or `workflow`, including definitions added later.
- Isolation: the injection code and source selection have their own module, so reviewers can review and roll back the injection without touching tool registration.
- Lives outside the instruction glob, so the edit-path loader cannot double-inject it.
Cons:
- Adds a second module and a second load unit, so ownership splits: the tool lives in `workflow.ts`, its instructions elsewhere, and a reader follows an indirection from the tool to its guidance.
- A second plugin adds a silent failure mode: if it does not load, nothing reports.
- Depends on the v2 Effect surface and on `SessionContext.tools` keeping its shape.
- A second writer to `event.system` makes hook order and duplicate text a review concern.

#### Option F: Co-locate injection in `workflow.ts`

Pros:
- One module registers the tool and the `context` hook, so the tool, gate, loader and injection cannot version apart.
- The guidance source is a config pointer, so pointing at another file is a config edit with no tool-description or agent-definition change.
- One review surface: a reviewer sees the tool contract, the gate, the configured path and the hook in one diff.
- No second plugin, so no extra load unit and no split ownership.
Cons:
- The tool module grows to carry the read, gate, dedupe and injection logic, so it owns two contracts and every edit reviews the hook with the registration.
- Testing injection requires loading the tool plugin, so prompt tests depend on tool registration.
- A change to either contract touches the same file, which widens review of ordinary tool edits.

### Scoring

Criteria (each scored -2 to +2):
- Maintainability: ease of understanding and evolving over time
- Flexibility: adaptability to future requirements
- Implementation ease: straightforwardness with the current stack
- Initial implementation cost: effort to build (higher score = cheaper)

| Criterion | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Maintainability | -1 | -2 | 0 | 1 | 1 | 2 |
| Flexibility | -1 | -2 | 0 | -1 | 2 | 1 |
| Implementation ease | 2 | 2 | 1 | 1 | 0 | 1 |
| Initial implementation cost | 2 | 2 | 1 | 1 | 0 | 1 |
| Total | 2 | 0 | 2 | 2 | 3 | 5 |

Option F wins on total. A hard constraint decides the primary mechanism: guidance must apply exactly when the request exposes a tool that reaches `workflow`, stay out of the tool contract, and come from a configurable source. A and C fail reach; B fails separation and source ownership; D fails the trigger. E and F satisfy the constraint. F wins on locality and a single review surface; E is second because isolation buys independent review and rollback at the cost of a second module and split ownership.

### Consequences

Positive:
- Every agent whose request exposes `execute` or `workflow` receives the same guidance, including definitions added later, with no edit to those definitions.
- One configured source and one read path; the block is the file verbatim, so a reviewer reads the guidance where it is authored and a change is reviewed there.
- Sessions whose request tool map carries neither `execute` nor `workflow` pay nothing.
- The contract, gate, source pointer and hook live in one file, so there is one review surface and repointing the source is a config edit.
- Acceptance is testable: a test for exactly one block with `execute` present, the same test with `workflow` present, an absence test with neither key, and an init-failure test for a missing, unreadable, empty or non-text source.

**Injected payload.** The block is the configured file verbatim, so the guidance is whatever that file holds and the plugin embeds no guidance text of its own. In this repository the configured source is `.agents/skills/task-delegation/SKILL.md`, the delegation skill's entry file, which indexes that skill's workflow and routed files. The call contract lives in the tool description; the payload repeats no mechanics.

Changing the guidance is one edit to the configured file, with no plugin change, effective at the next restart. The wrapper adds `<workflow_instructions source="...">` sentinels around the bytes; the bytes inside are unchanged.

**Description size.** The rendered description is measured for review, not capped: the array entries at `workflow.ts:16-52` joined with newlines render to 2,205 bytes, and removing the Patterns block at `:34-37` and the Example at `:49-51` removes 497 bytes and leaves 1,708 bytes. The description carries core mechanics only. Retained entries are `:17` (tool purpose), `:18` (helpers), `:20-21` (`subtask` signature and input fields), `:22` (required `description`), `:23` (`timeout_minutes` default 15), `:24` (result envelope), `:25` (status values), `:26` (failures do not throw, concurrency default 4), `:27` (`rug-swe` default), `:28` (`task_id` and `fork_from`), `:29` (`skills` note), `:30` (`schema`), `:32` (`log`), `:39` (script return contract), `:40` (guard), `:41` (`forbidden_script` and `invalid_script`), `:43-44` (tool result and title), `:46-47` (envelope and error statuses), and the blank separators at `:19`, `:31`, `:33`, `:38`, `:42`, `:45`, `:48`. Deletions are guidance only: the Patterns block and the Example, seven entries, whose content is guidance rather than contract. No patterns, no examples, and no per-flow advice remain in the description. The input schema at `:54-64` carries the numeric defaults. The deleted lines are the only ones that name orchestration patterns: `:34-37` shows fan-out, chain and structured fan-out, and `:49-51` shows a map-reduce run. The `schema` option itself stays in the description at `:30`. Nothing enforces a byte threshold; the numbers document the trim for review.

**Agent-definition prose.** Retiring prose from `.opencode/agents/rug-workflow.md` is a follow-on consequence, not part of the injection decision, and happens only after a content-parity check. The definition retains its tool grants, model settings, agent identity, and any statement that is specific to that agent; the workflow mechanics prose is removed only when every normative sentence in the 53,165-byte file maps to the payload, the tool description, or a definition-specific item. The payload carries the configured file's text; the tool description carries the `subtask` input fields, per-subtask defaults, `task_id` and `fork_from`, `skills`, `schema`, `log`, the script return contract and guard, the tool result, and the envelope statuses. A line qualifies as definition-specific only when it names the agent's identity, model settings, tool grants, or output contract and contains no workflow-mechanics term (`workflow`, `subtask`, `log`, the script guard, the error statuses). The check is a line-by-line checklist reviewed before deletion; it fails when a retained line matches a workflow-mechanics term or a deleted line maps to none of the payload, the tool description, or the input schema. The deletion lands only after at least 20 sessions show the block reaching every workflow-exposing session.

**Cache cost.** Presence is one block per request while `execute` or `workflow` is in the request tool map and zero otherwise. The block is appended at the end of `event.system` and is byte-identical while the configured file is unchanged, so the system prefix through the block stays stable and only the history after it is mutable. The cost is whatever the configured source costs: an N-byte file is roughly N/4 tokens, paid as a cache write near 1.25x input price on first exposure and as a cache read on later exposures of the same content. Nothing truncates the block, so a large source costs proportionally more per request, and the injection event reports the measured bytes and the token estimate. If dedupe makes presence alternate — an intermittent persisted `event.system` where the sentinel survives one turn and not the next — each toggle breaks the cached prefix at the block offset, so alternation costs more than either always-present or always-absent. The design removes alternation: the hook strips any existing block that carries the sentinel and appends exactly one, so presence is exactly one block per request whether or not a previous block persisted. Within a run the loaded content cannot change, so the prefix stays valid; after a restart with different content or a different configured path, the first exposure writes the new block and later requests read it. Measure cache-read and cache-write token counts during the dual run.

**Observability.** Each injection emits one log event named `workflow.instructions.injected` through the plugin logger into the OpenCode log sink (`~/.local/share/opencode/log/`; `opencode --print-logs` when the directory is not readable). Fields: `blockBytes` (the whole block, wrapper included), `tools` (the request tool keys), `exposure` (the matched key, `execute` or `workflow`), and `stripped` (whether a prior block was removed). The hook logs `workflow.instructions.skipped` with `tools` when neither key matches, and `workflow.instructions.context` at debug with the matched `exposure`. A reviewer queries `rg '"event":"workflow.instructions.injected"' ~/.local/share/opencode/log/ | jq -c` and counts events per session, then sums `blockBytes` to see the per-injection cost. The verified line (2026-10-20, `blockBytes=9560 exposure=execute`) is one such event. Initialization failure is not an injection event: the thrown Error surfaces through the plugin loader, naming the configured path and cause.

**Precedence review rule.** Precedence is a review rule, not a mechanism. During the dual run both the block and the definition prose reach the model; reviewers treat the block as authoritative for flow selection and the tool description as authoritative for call mechanics, and reject a definition whose prose contradicts either. Nothing enforces order at runtime, and the rule lapses when the prose is retired.

Negative:
- The hook can fail silently if an edit drops its registration: the tool still loads and no session reports the missing block; the tests and the dual-run observation are the only detection.
- Loud failure blocks the tool: a missing or unreadable file, an empty one, or one that fails the text check throws at init, so the whole `opencode.workflow` plugin fails and sessions lose the `workflow` tool along with the instructions. That is the intended trade: the error names the path and the cause, and the session reports it.
- The payload costs whatever the configured source costs per request while an exposure key is present; a large file raises every request's input tokens, with the cache behavior above.
- Removing the last exposure key from the request mid-session stops injection on the next request only; text already accumulated in a persistent system prompt may remain.
- If the edit-path loader's target set later includes `workflow`, both it and this module can write to `event.system`; the sentinel strips only this module's block.
- The block carries no version marker, so a reader of the injected text cannot tell which revision of the source produced it.
- The mechanism is OpenCode-only. The record makes no claim about Copilot or DSH.
- Hook absent: if the `context` hook is renamed or dropped, no block appears and no error surfaces.
- Tool map unavailable: if `event.tools` is missing or no longer a map after an API change, the gate finds no exposure key and injects nothing; the tests and dual run detect it.
- Version drift: a change past `@opencode/plugin` 2.0.24 or in the shape of `SessionContext.tools` can break load or gate; the tests and dual run detect it.

Neutral:
- The change adds no plugin file: the hook lives in `.opencode/plugins/workflow.ts`, the source is an existing file named in config, and the config gains a `workflow` section in `.opencode/plugins/config/harness.config.ts`. The plugin id `opencode.workflow` is unchanged, and directory scanning already loads the module.
- Dual run: the prose stays until at least 20 sessions show exactly one injection per session whose tool map exposes `execute` or `workflow`, no injection without either key, and no init failure for the configured path.
- Rollback: repoint the config, or revert `.opencode/plugins/workflow.ts` and restore the prose from git. No runtime flag is verified, so rollback is a config or code revert.
- Revisit when `@opencode/plugin` moves past 2.0.24, `SessionContext.tools` changes shape, the harness stops collapsing plugin tools into `execute`, the harness exposes `workflow` directly to the model, the plugin config mechanism changes, the configured source's format changes, the injected block needs versioning, another registrar adds a tool named `workflow`, another harness needs the same behavior, or a duplicate is observed.
