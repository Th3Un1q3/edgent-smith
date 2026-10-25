---
id: researches/skills-grouping-feasibility
type: researches
status: active
date: 2026-10-24
scope: Skill directory grouping feasibility evidence behind ADR-016
L0: "Verified evidence behind ADR-016: loader depth limits, taxonomy lossiness, flat visibility, web spec and repo layouts; decision lives in ADR-016."
---

# Skill Directory Grouping — Feasibility Evidence (ADR-016)

Supporting facts only. Decision record: mem:architecture/adr/ADR-016-skill-directory-grouping.

## Technical compatibility
- Plugin injector: .opencode/plugins/helpers/workflow-subtask.ts:284 regex /^[a-z0-9][a-z0-9_-]*$/i, :290 guard, :294 path.join(dir,.agents,skills,name,SKILL.md); identity is the directory basename, so a group/name id is rejected before lookup. [verified: local repo]
- OpenCode binary: vendored binary shows a depth-6 constant and recursive push; upstream docs say grouping to six levels. [sourced-from-upstream-docs, locally unverified by validator]
- DSH dsh-skill-filesystem (vendored 0.1.1-rc.2): isPotentialSkillPath lib/index.js:552, rejects segments.length > 2 at :554, discoverRoot :581 reads root entries only; customSkillDirs unset in .dsh/.agent-presets/orchestrator/agent.cordis.yml:86-90. [verified: vendored package]
- 42 skill directories, all at depth 2 (none deeper); 0 duplicate basenames. [verified: local repo]
- skills-lock.json lives at repo root with 17 entries. [verified: local repo]
- justfile:89 counts skills with ls .agents/skills | wc -l; agent_utils/justfile:239-241 uses /workspace/.agents/skills/<name>/SKILL.md. [verified: local repo]

## Taxonomy / logical constraints
- 42 skills; a single-parent tree is lossy: 30 of 42 have a legitimate second home (refactor x4, test x4, software-engineering vs software-development, design as UI/UX vs architecture, writing vs prose).
- Four proposed groups cover 22 of 42 (writing 4, software-development 17, design 0, critical-thinking 1); 20 orphans (platform 5, knowledge 4, meta 6, orchestration 5).
- Seven-group alternative: engineering, stack, platform, knowledge, authoring, meta, orchestration.
- Placement rule: a skill lives where its deliverable lives (the group completing "this skill makes the agent produce ___").
- Scale threshold: grouping pays off past ~60 skills, or when a group encodes policy (review ownership, load budget, release boundary).

## Permissions and visibility
- Visibility: one flat 42-name catalog in the system prompt for every agent holding the skill tool; no per-agent allowlist. opencode.jsonc:54-85 has no skill key. skills: param is per-task opt-in, shape-checked only (workflow-subtask.ts:151).
- Only enforced boundary is tool presence: .opencode/agents/rug.md:5-12 denies "*" (removes the tool); DSH orchestrator preset loads skill-filesystem + tool-skill; worker preset omits skill entirely.
- Advisory only: just agent_utils::validate-skill (agent_utils/justfile:236-249), not in scripts/ci.sh; skills-lock.json (17 of 42, no generator).
- 14 inline skills:[...] arrays across rug.md (7) and rug-workflow.md (7); 0 frontmatter skill lists.
- Grouping removes zero maintained permission/visibility entries and adds path edits; a real boundary needs a group-aware loader and catalog, a group-keyed permission evaluator, and DSH customSkillDirs.

## Web spec and popular repos
- agentskills.io specification: skill is a directory with SKILL.md; optional scripts/, references/, assets/; name must match the immediate parent directory name; file references one level deep from SKILL.md; no explicit nesting-depth prohibition. Source: https://agentskills.io/specification.
- vercel-labs/agent-skills: flat skills/<name>/SKILL.md (e.g. skills/react-best-practices/SKILL.md, skills/web-design-guidelines/SKILL.md).
- anthropics/skills: flat skills/<name>/SKILL.md (e.g. skills/pdf/SKILL.md, skills/mcp-builder/SKILL.md).
- mattpocock/skills: two-level skills/<category>/<skill-name>/SKILL.md, 38 skills at depth 3 (groups deprecated, engineering, in-progress, misc, productivity); discoverability via .claude-plugin/marketplace.json + plugin.json; per-skill agents/ (openai.yaml) and scripts/. Source: https://github.com/mattpocock/skills/tree/main/skills.
- Discovery is implementation-dependent: OpenCode upstream docs support grouping to six levels; npx skills resolves across recursive scans; Claude Code currently scans skills/<name>/SKILL.md one level (issue #18192).

## Simplification options (benefit / cost)
- Flat dirs + generated catalog/index: deterministic, CI-validatable / index drift.
- Tag metadata in SKILL.md frontmatter (metadata.group): richer filtering without moving files / requires client support.
- Group-scoped manifests/allowlists: installs or exposes only relevant groups / adds manifest maintenance and tooling complexity.

Cross-links: mem:skills/general/mattpocock-skills-research; mem:researches/skills-subsystem-stack-2026-08.
