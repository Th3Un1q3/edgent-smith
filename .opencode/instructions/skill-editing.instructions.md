---
name: skill-editing
description: "Load when editing a skill body or an agent definition: sweep the edited neighbourhood for contradictions and dead names before claiming the edit done, because no gate reads meaning."
applyTo: "{.agents/skills/**/*.md,.opencode/agents/*.md}"
---

# Skill Editing

Every edit under `.agents/skills/**` or `.opencode/agents/*.md` passes these checks against the edited files before you claim the work done. An instruction-file edit (`.opencode/instructions/**/*.md`) runs the overlap check in `writing-instructions.instructions.md`, Before adding or editing an instruction.

## Contradiction sweep

1. **Sweep after the edit.** When an edit lands under `.agents/skills/**` or `.opencode/agents/*.md`, run checks 2–6 on the touched files before reporting done; an edit delivered with no sweep rows is unfinished.
2. **Enumerate before judging.** List every normative statement in the edited neighbourhood — each bullet or sentence carrying `must`, `never`, `always`, `only`, `do not`, or `should`, plus each numbered requirement — each row carrying `file:line` and the quoted text; a statement with no row is unexamined.
3. **Pair by subject.** Two statements pair only when they govern the same subject: one tool, one command, one phase, or one output shape. Textual similarity pairs nothing.
4. **Classify each pair by these definitions.** `DIRECT CONFLICT`: both cannot hold. `UNSTATED PRECEDENCE`: both hold only if one outranks the other and nothing in the tree says which. `COMPATIBLE EXCEPTION`: both hold as written.
5. **Fix only conflict and unstated precedence.** Restate one rule of the pair so both can hold; never add a third rule to reconcile a pair. A `COMPATIBLE EXCEPTION` pair stays as written.
6. **Re-sweep after each fix round.** Re-run checks 2–5 over the edited neighbourhood, because a fix can introduce the next contradiction. The neighbourhood is clean when a complete pass over the list surfaces no new `DIRECT CONFLICT` or `UNSTATED PRECEDENCE` pair.

## Dead names, agent cards, and the gate

7. **Resolve every name the edit introduces.** For each tool, command, path, and config key the edit names, confirm it exists in the tree; a tool absent from the agent cards' tool list is a dead name, and it is replaced rather than documented.
8. **Read agent cards, never write them in a sweep.** `.opencode/agents/*.md` is input during a skill sweep — quote it to resolve a name — and not a write target; an agent-definition change is its own change type, routed through the `harness-management` skill.
9. **Trust the skill gate for mechanics only.** `just agent_utils::validate-skill <name>` checks budgets, links, and fences; it cannot certify semantics, so a passing gate leaves checks 1–8 outstanding.

## Output Format

Report each pair as a row carrying `file:line` plus quoted statement, its paired `file:line` plus quoted statement, the class, and the fix applied; a pair with no row is unexamined. List each dead name with its live replacement.
