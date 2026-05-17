# Start Here: Which Customization Type Owns This?

Read this first if you are still choosing between an instruction, prompt,
agent, skill, and hook.

This page answers one plain question: "what kind of file should hold this
job?" Once you have that answer, use the file-location reference to see where
that file should live, or use the scan workflow if you first need a map of what
the repo already has.

## Fast Answers

Use these answers when the main problem is choosing the right owner.

| Question | Prefer | Because |
|---|---|---|
| Skill vs instruction? | Instruction for guidance that should auto-apply on a repo or scoped surface. Skill for on-demand reusable guidance. | Instructions can be repo-wide or narrowly scoped by path, directory, file type, or file pattern, and they apply automatically when matching work is touched; skills load when the task needs deeper optional nuance. |
| Skill vs agent? | Skill for reusable know-how. Agent for orchestration. | A skill explains how to do something; an agent decides what to load, what tools to allow, and what stage comes next. |
| Prompt vs agent? | Prompt to launch one focused job. Agent to run a staged workflow. | A prompt frames the task; an agent manages execution and context selection after the task starts. |
| When is a hook involved? | Use a hook for deterministic enforcement. | If the behavior must run or block reliably at a lifecycle point, do not rely on instructions alone. |

## Canonical Split

| Customization type | Primary role | Use it for | Avoid using it for |
|---|---|---|---|
| Prompt | Task-specific workflow launcher | Starting a focused job with task-specific framing, clear inputs, and a narrow intended outcome | Storing durable repo policy, large reusable references, or orchestration logic |
| Agent | Orchestration and deciding which skill or context to load | Staged workflows, delegation, context isolation, tool restrictions, and choosing the right supporting material | Long-lived reference content or restating instructions verbatim |
| Skill | Reusable technical nuance, checklists, and references | Multi-step playbooks, decision aids, reference tables, and reusable technical guidance that should load on demand | Always-on rules or single-shot task launchers |
| Instruction | Stable guidance that should auto-apply when matching work is touched | Repo-wide rules, style constraints, navigation hints, and scoped guidance targeted by path, directory, file type, or file pattern | Large workflow walkthroughs, deep references, or orchestration |
| Hook | Deterministic enforcement at lifecycle boundaries | Blocking unsafe actions, requiring approval, formatting, injecting context, or running checks automatically | Narrative guidance, policy explanation, or reusable reference content |

## Responsibility Distribution

Use this split when designing a reliable workflow instead of letting every file
do a little of everything.

| Layer | What it should own | What it should not own |
|---|---|---|
| Instruction | Stable repo rules plus concise guidance that should auto-apply on matching surfaces | Task launch text, branching workflow logic, large reusable references |
| Prompt | Task entry point, framing, required inputs, expected output shape | Repo policy, orchestration branches, durable technical reference |
| Agent | Orchestration, context isolation, skill selection, tool policy per stage | Long reference prose, repo-wide policy, one-off task framing |
| Skill | Reusable domain nuance, comparisons, checklists, playbooks, lookup docs | Always-on guidance, deterministic enforcement, stage control |
| Hook | Deterministic gates and automatic side effects | High-level reasoning about where content belongs |

### Reliable Composition Pattern

When the stack needs several customization types, assign them in this order:

1. Put broad repo rules and concise surface-specific rules in instructions.
2. Launch the concrete task with a prompt when a reusable entry point is needed.
3. Let an agent decide which context, skills, or tools are needed for that run.
4. Put the reusable workflow detail and reference material in skills.
5. Use hooks only for actions that must happen deterministically.

If a stable local rule should auto-apply but users also need deeper optional execution guidance, use both: keep the concise scoped rule in an instruction and put the richer playbook in a skill.

If two customization types both need the same sentence, the ownership is probably wrong.

## Decision Rules

Choose the owner by answering these questions in order:

1. Should this guidance auto-apply whenever work touches a repo-wide or scoped surface?
   - Yes: instruction.
   - No: continue.

2. Must this run or block deterministically at a lifecycle boundary?
   - Yes: hook.
   - No: continue.

3. Is the primary need to launch or frame a specific task with a clear entry point and intended outcome?
   - Yes: prompt.
   - No: continue.

4. Is the primary need reusable workflow detail, checklists, or reference
   material?
   - Yes: skill.
   - No: continue.

5. Is the primary need orchestration, delegation, tool restrictions, or deciding
   what context to load?
   - Yes: agent.

If the answer is still unclear, split the concern by time horizon:
- Long-lived repo or surface-scoped guidance that should auto-apply: instruction.
- Task launch: prompt.
- Runtime coordination: agent.
- Reusable know-how: skill.
- Deterministic enforcement: hook.

## Compare the Common Confusions

### Skill vs Instruction

Choose an instruction when the guidance should shape normal work automatically
whenever the repo or a matching surface is touched. Instructions are not only
repo-wide: they can be targeted by path, directory, file type, or file pattern,
which makes them a stronger fit than skills for stable local guidance.

Choose a skill when the material is valuable but optional, deeper, or more
workflow-heavy than should remain automatically loaded. Skills stay first-class
for reusable multi-step playbooks, comparisons, and reference-heavy material.

Choose both when a concise scoped rule should auto-apply and a richer
on-demand workflow or reference is also useful.

### Skill vs Agent

Choose a skill when the asset mainly teaches, compares, or checks. Choose an
agent when the asset mainly decides sequence, context boundaries, or tool use.
If you can delete the branching logic and keep the value, it was probably a
skill. If you can delete the reference prose and keep the value, it was probably
an agent.

### Prompt vs Agent

Choose a prompt when the user needs a repeatable way to start one job with the
right framing. Choose an agent when the system needs a controller that decides
which supporting materials to load and how to stage the work after launch.

When one prompt depends on one specific custom agent, split the ownership but
bind the launch explicitly:

- The prompt still owns task entry and user-facing framing.
- The agent still owns orchestration, tool policy, and staged loading.
- The coupling belongs in the prompt frontmatter as `agent: "<agent-name>"`.

Use prompt-to-agent coupling only when the prompt would be wrong or incomplete
without that named agent. Do not hard-wire a prompt to an agent just because
they are often used together. If the prompt is still valid in the default mode
or with a built-in agent, keep it uncoupled.

Failure mode to catch during review:

- The prompt body names a specific agent or assumes its orchestration, but the
   prompt has no `agent:` frontmatter binding.

Treat that as missing runtime wiring, not a documentation issue.

## Boundary Examples

| Scenario | Best owner | Why |
|---|---|---|
| "Always run focused validation after edits in this repo" | Instruction | Repo-specific constraint that should apply broadly |
| "When touching `cli/**/*.py`, always preserve command-local structure rules" | Instruction | Stable local guidance that should auto-apply whenever that file surface is touched |
| "Start a review of a failed eval run" | Prompt | Focused task launcher with one main job |
| "Reference for how eval datasets are structured here" | Skill | Reusable technical guidance that should load only when relevant |
| "Apply a concise `tests/**` rule automatically, but keep the deeper testing playbook available" | Instruction plus skill | The stable rule should auto-apply; the richer workflow should stay on demand |
| "Choose between a troubleshooting skill and a refactor skill" | Agent | Orchestration decision based on task shape |
| "Block `git push` until a local safety check passes" | Hook | Deterministic enforcement at a lifecycle point |

## Practical Ownership Test

For each candidate file, write one sentence for each column:

| Test | Good sign | Rewrite if you find... |
|---|---|---|
| Trigger sentence | "Use this when..." clearly names one intent | The description could apply to half the stack |
| Scope sentence | It is obvious whether the guidance is auto-applied or on-demand | The file mixes scoped rules and optional workflow detail |
| Runtime sentence | It is obvious whether the asset guides or enforces | A hook is being explained with instruction-style prose |
| Duplication sentence | No other primitive needs the same paragraph | The same workflow appears in both an instruction and a skill |

## Ownership Smells

- A prompt contains policy that should apply even when the prompt is not used.
- A skill is carrying stable local guidance that should auto-apply whenever a matching path or file type is touched.
- An instruction explains a long reusable workflow with many branches.
- A skill root file reads like an always-on policy document.
- An agent exists only because the team could not decide where to put the
  content.
- A hook is used to compensate for unclear instructions instead of enforcing a
  specific deterministic behavior.