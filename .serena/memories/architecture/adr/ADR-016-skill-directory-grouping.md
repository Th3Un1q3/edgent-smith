---
id: ADR-016
title: Skill directory grouping stays flat with a generated index
status: proposed
date: 2026-10-23
scope: Skill directory layout, discovery, permissions, and visibility across the OpenCode plugin loader, DSH, and the skill catalog
---

# ADR-016: Skill directory grouping stays flat with a generated index

## Decision

Flat skill directories remain canonical at `.agents/skills/<name>`, with grouping carried by a generated `INDEX.md` that records `group` and `tag` metadata.

## Considerations

### Context

The repository holds 42 skill directories (`ls .agents/skills | wc -l`). The question is whether to reorder them into two levels labelled writing, software-development, design, and critical-thinking. Name resolution, loader depth, move cost, taxonomy, and the permissions model all bear on the answer.

Name resolution uses the leaf basename. `loadSkill` in `.opencode/plugins/helpers/workflow-subtask.ts` accepts only `/^[a-z0-9][a-z0-9_-]*$/i` (:284), returns undefined when the name fails (:290), and joins `<name>/SKILL.md` (:294). The `skills` parameter checks only that its value is an array of strings (:151). `docs/workflow-tool.md:64` documents the same one-segment `<name>` contract. A `group/name` value cannot pass either path.

External evidence. The Agent Skills specification requires a `SKILL.md` file in a directory, permits optional `scripts/`, `references/`, and `assets/`, and requires the skill `name` to match its immediate parent directory name; file references should stay one level deep from `SKILL.md` (https://agentskills.io/specification). Popular repos split: Vercel and Anthropic use flat `skills/<name>/SKILL.md` layouts, e.g. `skills/react-best-practices/SKILL.md`, `skills/web-design-guidelines/SKILL.md`, `skills/pdf/SKILL.md`, `skills/mcp-builder/SKILL.md`, (https://github.com/vercel-labs/agent-skills, https://github.com/anthropics/skills); mattpocock/skills uses two-level grouping, `skills/<category>/<skill-name>/SKILL.md`, with 38 skills at depth 3 (groups deprecated, engineering, in-progress, misc, productivity), `.claude-plugin/marketplace.json` plus `plugin.json` as the discoverability mechanism, and per-skill `agents/` (`openai.yaml`) and `scripts/` (https://github.com/mattpocock/skills/tree/main/skills). A `group/<skill-name>/SKILL.md` layout therefore satisfies the spec, because the immediate parent remains `<skill-name>`. Discovery is implementation-dependent: OpenCode upstream docs support grouping to six levels, `npx skills` resolves names across recursive scans, and Claude Code currently scans `skills/<name>/SKILL.md` one level (issue #18192). mattpocock/skills shows grouped layouts working with recursive discovery and a catalog or manifest.

OpenCode's upstream documentation states that grouped skill directories such as `skills/teams/release/SKILL.md` are supported to six levels below the source root; this is sourced-from-upstream-docs and locally-unverified, because no repo file or dumped config in this repository states that depth. A live catalog dump or the loader source would settle it. DSH is explicit. `isPotentialSkillPath` rejects `segments.length > 2` at `.dsh/child-runtime/node_modules/@deepseek-ai/dsh-skill-filesystem/lib/index.js:554`, with the function starting at :552; `discoverRoot` starts at :581 and lists only root entries. A `group/` directory is read as a skill directory, its missing `SKILL.md` fails, and the entries beneath it are not discovered. `customSkillDirs` could point at each group directory, but `.dsh/.agent-presets/orchestrator/agent.cordis.yml:86-90` sets no such option.

A physical move must inspect tracked files that reference `.agents/skills`: plugin code and tests, justfile recipes, agent and command definitions, instruction files, docs, and the root `skills-lock.json`. The count is not stable across exclusion rules, so this record does not state one; the set includes prose and test references as well as import paths. Named examples include `.opencode/plugins/config/harness.config.ts:78`, `agent_utils/justfile`, the root `skills-lock.json`, and `AGENTS.md`.

Duplicate basenames are unsafe. The lockfile and task injection key on the basename, so two `review` skills collide; the catalog's precedence order is UNKNOWN. A live catalog dump containing two same-named skills would settle that order. A move that creates a second `SKILL.md` named `review` therefore has no defined winner until that dump exists.

The taxonomy has no recorded membership. The placement rule in use is "a skill lives where its deliverable lives", but no file applies it. The four proposed labels are not a partition: design has no clear member, and skills such as testing or refactoring fit more than one label. No coverage count is stated because it would depend on an unrecorded mapping. A seven-label alternative was proposed (engineering, stack, platform, knowledge, authoring, meta, orchestration); it also has no membership file. The review trigger adopted here is roughly 60 skills, a chosen checkpoint rather than a measured cliff.

Permissions and visibility do not follow the directory tree. The catalog is a flat list of 42 basenames from `.agents/skills/<name>/SKILL.md`, and every agent holding the skill tool sees all 42. Visibility is controlled by tool presence, not by a per-agent allowlist: `opencode.jsonc:54-85` has no `skill` key, agent `permission:` blocks are tool-level, `rug.md:5-12` removes the tool by denying `*`, and `.dsh/.agent-presets/worker/agent.cordis.yml:14` omits the skill entry. No mechanism keys on a group. Task injection rejects a slash (:284), the lockfile keys on basenames, the quality gate globs `.ts`, `.py`, and justfile rather than skill markdown (`.opencode/plugins/config/harness.config.ts:18-46`), and the `skills` parameter enforces shape only (:151).

Grouping removes no maintained permission entry. The inline `skills:[...]` arrays in `rug.md` and `rug-workflow.md`, the 42 catalog rows, and the 17 entries in the root `skills-lock.json` (`json.load(...)['skills']`) all remain; grouping adds path edits. A group directory could become a real policy boundary only if a loader or permission hook reads the group segment. That would require a group-aware `loadSkill` and catalog, a permission evaluator keyed on the group, and DSH `skill-filesystem` configuration. None exists today.

Task packs address skills by name (`<task_skills><skill name="...">`), so grouping is a navigation problem. This record follows `mem:architecture/adr-rules` and `mem:architecture/adr-template`.

Source: repository files cited by path and line, plus the external sources above. OpenCode nesting is sourced-from-upstream-docs and locally-unverified; a live catalog dump would settle it. The DSH behavior is read from the vendored package, not a live `dump-config` run.

### Options considered

#### Option A: Flat directories, no grouping layer
Pros:
- No migration, loader change, or new artifact.
Cons:
- The 42-entry catalog stays unscannable; no visibility or enforcement gain.

#### Option B: Flat directories plus generated index
Pros:
- No file moves; one generated view carries group and tag.
- Name resolution is untouched; a reader can see group labels without choosing a parent.
Cons:
- The index drifts if not generated; the loader ignores grouping.
- It creates no permission boundary.

#### Option C: Two-level group directories
Pros:
- The filesystem is scannable and group membership is explicit.
Cons:
- The tracked files that reference `.agents/skills` must be inspected; `group/name` cannot load.
- DSH needs `customSkillDirs` per group; duplicate basenames collide in the lockfile and task injection.

#### Option D: Loader-level virtual groups
Pros:
- No file moves; group prefixes resolve through an alias map.
- A group-aware loader is the prerequisite for any future boundary.
Cons:
- Both loaders need the alias map; the plugin regex still rejects `group/name`.
- DSH stays blind unless separately patched, and the alias map alone grants no enforcement.

#### Option E: Flat directories with frontmatter tag metadata
Pros:
- Richer filtering and grouping without moving files.
Cons:
- Requires client support for `metadata.group` and a maintained index to use it.

#### Option F: Group-scoped manifests or allowlists
Pros:
- Installs or exposes only relevant groups.
Cons:
- Adds manifest maintenance and tooling complexity.

### Scoring

Criteria (each -2 to +2): maintainability, flexibility, implementation ease, initial implementation cost (higher = cheaper), enforcement and visibility gain.

| Criterion | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Maintainability | 0 | +1 | -1 | -1 | +1 | -1 |
| Flexibility | -2 | +1 | +2 | +1 | +1 | +2 |
| Implementation ease | +2 | +1 | -2 | -1 | +1 | -1 |
| Initial implementation cost | +2 | +1 | -2 | -1 | +1 | -1 |
| Enforcement and visibility gain | 0 | +1 | 0 | 0 | 0 | 0 |
| Total | +2 | +5 | -3 | -2 | +4 | -1 |

Option B wins with +5. Its enforcement gain is zero; the +1 is visibility through one index. No option gains enforcement because no loader or permission hook reads a group segment. Option D would be the prerequisite for enforcement, but the alias map alone does not grant it. Option E scores +4 and Option F -1, so neither beats B.

### Consequences

The 42 directories stay where they are. A generated `INDEX.md` becomes the grouping view, and regeneration belongs in the skill-change path or the view goes stale. No loader, lockfile, or task pack changes.

Permissions stay tool-level until a group-scoped loader exists. A future move needs a duplicate-basename check across the loader, lockfile, and catalog; loader indirection so names resolve independently of directory depth; `customSkillDirs` set for each DSH group; and a permission hook keyed on the group if a boundary is wanted. Revisit when the catalog passes roughly 60 skills, when a group encodes policy such as review ownership, load budget, or release boundary, or when the target loader discovers skills recursively and a generated catalog or marketplace manifest accompanies the move, as in mattpocock/skills.