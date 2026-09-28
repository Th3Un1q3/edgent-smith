# Which Customization Type Owns This?

Read this first when choosing between an instruction, prompt, agent, skill, and hook. It answers one question: what kind of file should hold this job? Once you have the answer, use [file-locations-and-frontmatter.md](./file-locations-and-frontmatter.md) for naming and placement, or the scan workflow if you first need a map of what the repo already has.

## Canonical Split

| Type | Primary role | Use it for | Avoid using it for |
|---|---|---|---|
| Instruction | Stable guidance that auto-applies when matching work is touched | Repo-wide rules, style constraints, navigation hints, and scoped guidance targeted by path, directory, file type, or file pattern | Workflow walkthroughs, deep references, orchestration |
| Prompt | Task-specific workflow launcher | Starting one focused job with clear inputs, task-specific framing, and a narrow outcome | Durable repo policy, large references, orchestration logic |
| Agent | Orchestration and context selection | Staged workflows, delegation, context isolation, tool restrictions, choosing what to load | Long reference content or restating instructions verbatim |
| Skill | Reusable technical nuance, checklists, references | Multi-step playbooks, decision aids, reference tables, and reusable guidance that loads on demand | Always-on rules or single-shot task launchers |
| Hook | Deterministic enforcement at lifecycle boundaries | Blocking unsafe actions, requiring approval, formatting, injecting context, and running checks automatically | Narrative guidance, policy explanation, reusable reference content |

## The Border Lines

| Confusion | Prefer | Because |
|---|---|---|
| Skill vs instruction | Instruction for guidance that should auto-apply on a repo or scoped surface; skill for on-demand reusable guidance. Use both when a concise scoped rule stays in an instruction and the richer playbook stays in a skill. | Instructions apply automatically when matching work is touched, including by path, directory, file type, or file pattern; skills load when a task needs optional depth. |
| Skill vs agent | Skill when the asset mainly teaches, compares, or checks. Agent when it mainly decides sequence, context boundaries, or tool use. | Delete the branching logic and keep the value: skill. Delete the reference prose and keep the value: agent. |
| Prompt vs agent | Prompt when the user needs a repeatable way to start one job. Agent when the system needs a controller that stages work after launch. | A prompt frames the task; an agent manages context selection and tool policy during execution. |
| When is a hook involved? | Hook for deterministic enforcement. | If behavior must run or block reliably at a lifecycle point, instructions alone cannot guarantee it. |

When one prompt depends on one specific custom agent, bind the coupling in the prompt frontmatter as `agent: "<agent-name>"`. Couple only when the prompt would be wrong without that named agent; keep it uncoupled when it is still valid in default mode. A prompt that names a specific agent but has no `agent:` binding is missing runtime wiring, not a documentation issue.

## Decision Rules

Choose the owner by answering these questions in order:

1. Should this guidance auto-apply whenever work touches a repo-wide or scoped surface? — **Instruction**.
2. Must this run or block deterministically at a lifecycle boundary? — **Hook**.
3. Is the primary need to launch or frame one specific task with a clear entry point? — **Prompt**.
4. Is the primary need reusable workflow detail, checklists, or reference material? — **Skill**.
5. Is the primary need orchestration, delegation, tool restrictions, or deciding what context to load? — **Agent**.

If the answer is still unclear, split by time horizon: long-lived surface-scoped guidance → instruction; task launch → prompt; runtime coordination → agent; reusable know-how → skill; deterministic enforcement → hook.

## Boundary Examples

| Scenario | Best owner | Why |
|---|---|---|
| "Always run focused validation after edits in this repo" | Instruction | Repo-specific constraint that should apply broadly |
| "When touching `cli/**/*.py`, always preserve command-local structure rules" | Instruction | Stable local guidance that auto-applies on that file surface |
| "Start a review of a failed eval run" | Prompt | Focused task launcher with one main job |
| "Reference for how eval datasets are structured here" | Skill | Reusable technical guidance that loads only when relevant |
| "Apply a concise `tests/**` rule automatically, but keep the deeper testing playbook available" | Instruction plus skill | The stable rule auto-applies; the richer workflow stays on demand |
| "Choose between a troubleshooting skill and a refactor skill" | Agent | Orchestration decision based on task shape |
| "Block `git push` until a local safety check passes" | Hook | Deterministic enforcement at a lifecycle point |

## Ownership Smells

- A prompt contains policy that should apply even when the prompt is not used.
- A skill carries stable local guidance that should auto-apply whenever a matching path or file type is touched.
- An instruction explains a long reusable workflow with many branches.
- A skill root file reads like an always-on policy document.
- An agent exists only because the team could not decide where to put the content.
- A hook compensates for unclear instructions instead of enforcing a specific deterministic behavior.
- Two customization types both need the same sentence — the ownership is probably wrong.

If the description could apply to half the stack, or the file mixes scoped rules with optional workflow detail, the boundary is wrong; split it.
