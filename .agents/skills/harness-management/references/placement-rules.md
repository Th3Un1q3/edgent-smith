# Placement Decision List — Expanded Rules

Apply the first rule that matches. Rules 1–2 (behavior) outrank rules 3–4 (knowledge):
place behavior before knowledge when a change could fit either. Rule 5 takes behavior
that no single home can scope; rule 6 holds knowledge until rule 5 applies.

Precedence: if a skill governs the failing domain, that skill owns the change and the
generic homes below are fallbacks, not defaults — see Domain Match in `SKILL.md`.

## 1. Permanent for the whole repo — root `/workspace/AGENTS.md`

- **Positive trigger:** a rule that must bind every task and every agent, regardless of
  file type or directory — access rules, working-memory priority, system boundaries,
  anti-confusion doctrine.
- **Home:** root `/workspace/AGENTS.md`.
- **Counter-example (does NOT belong here):** a rule needed only when editing `docs/**.md`
  is rule 3, not root `AGENTS.md`; one agent's workflow is rule 2.
- **Workflow:** [workflows/directory-agents-md.md](../workflows/directory-agents-md.md).
- **Verify/restart:** root `AGENTS.md` is injected project-wide — edit it carefully and
  re-read it as a fresh agent. Ask for an opencode restart so it is picked up fully.

## 2. Permanent for one agent — `.opencode/agents/<name>.md`

- **Positive trigger:** behavior that shapes one agent's identity, scope, workflow, tools,
  permissions, or anti-patterns — and only that agent.
- **Home:** `.opencode/agents/<name>.md`.
- **Counter-example (does NOT belong here):** a rule that must bind every agent is rule 1;
  guidance that applies only while editing a file type is rule 3.
- **Workflow:** [workflows/agent-definition.md](../workflows/agent-definition.md).
- **Verify/restart:** confirm the agent loads with a real `description`, identity, and
  permission surface. Ask for an opencode restart.

## 3. Applies only while editing certain files or file types — `.opencode/instructions/`

- **Positive trigger:** guidance scoped to a path or glob (`applyTo` / `excludePaths`),
  loaded automatically when an agent touches those files — editing Python, justfiles,
  markdown, or another matched surface.
- **Home:** `.opencode/instructions/<name>.instructions.md`.
- **Counter-example (does NOT belong here):** a rule that must bind all actions or all
  agents is not a file-edit instruction. Do not ship repo-wide or session-wide behavior as
  a file-edit-triggered instruction; make it rule 1 or rule 2 instead.
- **Workflow:** [workflows/scoped-instructions.md](../workflows/scoped-instructions.md).
- **Verify/restart:** confirm the `applyTo` glob matches the intended files and no wider.
  Ask for an opencode restart.

## 4. Knowledge, not behavior, about a directory and its contents — that directory's `AGENTS.md`

- **Positive trigger:** durable context about a directory and its subdirectories — key
  files, structure, commands, what is in or out of scope.
- **Home:** `<directory>/AGENTS.md`.
- **Counter-example (does NOT belong here):** emergent behavior or a recurring process
  belongs in a skill (rule 5) or a memory (rule 6). `AGENTS.md` must not contain emergent
  behavior.
- **Workflow:** [workflows/directory-agents-md.md](../workflows/directory-agents-md.md).
- **Verify/restart:** read it as a fresh agent; confirm every path and command resolves.
  Ask for an opencode restart.

## 5. Behavior crossing several concerns, or situational but repeatable — a skill

- **Positive trigger:** a process or workflow that is not one file type (rule 3) and not
  one agent (rule 2) — it spans concerns or recurs across situations, so no single
  instruction, agent file, or directory can scope it.
- **Home:** `.agents/skills/<name>/`.
- **Counter-example (does NOT belong here):** a one-off is a note in the flow's lesson
  record, not a skill; a rule scoped to one file type is rule 3; one agent's behavior is
  rule 2.
- **Workflow:** [workflows/manage-skill.md](../workflows/manage-skill.md).
- **Verify/restart:** run the shaping gate and link/fence audits, then ask for an opencode
  restart.

## 6. A learning that cannot yet become a solid, reusable skill — a Serena memory

- **Positive trigger:** raw, evolving, or unproven knowledge from an incident, not yet
  generalizable or stable enough to package as a skill.
- **Home:** a Serena memory — call `serena-memory`.
- **Counter-example (does NOT belong here):** a stable, generalizable process is rule 5,
  not a memory. Single incident → memory; repeatable across tasks → skill.
- **Workflow:** `serena-memory`, store-memory recipe.
- **Verify/restart:** re-read next session; promote the memory to a skill once it
  stabilizes and generalizes.

## Worked examples

| Trigger | Rule | Home | Workflow |
|---|---|---|---|
| "Never read `.serena/memories/*` directly" binds every agent | 1 | root `AGENTS.md` | directory-agents-md |
| The `rug` agent is a pure orchestrator that never edits | 2 | `.opencode/agents/rug.md` | agent-definition |
| "Verify binary first, write second" whenever a harness file is edited | 3 | `.opencode/instructions/<name>.instructions.md` | scoped-instructions |
| `cli/` key files, structure, and in/out of scope | 4 | `cli/AGENTS.md` | directory-agents-md |
| A caching-and-synthesis research process used by several tasks | 5 | `.agents/skills/<name>/` | manage-skill |
| An incident lesson not yet generalizable | 6 | Serena memory | serena-memory |
