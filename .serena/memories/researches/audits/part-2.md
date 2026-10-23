---
id: researches/audits/part-2
type: researches
L0: "# Instruction-purpose audit — part 2 (selected by name-sort index mod 3 == 2)"
---
# Instruction-purpose audit — part 2 (selected by name-sort index mod 3 == 2)

Scope: `.opencode/instructions/*.md` sorted by name, zero-based index mod 3 equals 2. 7 of 20 files reviewed read-only; no file edited. Sibling audit of the whole directory: `audits/fresh-reader/opencode-instructions`.

## Definition extracted from harness-management

- Purpose of the home: "Guidance applied only while editing certain files or file types (`applyTo` / `excludePaths`)" — `.agents/skills/harness-management/SKILL.md:40`.
- What belongs: "Improve quality or accuracy of EDITING a specific file type (markdown, code, config)" — `SKILL.md:83`; "The guidance stays scoped to a file type rather than a whole process" — `workflows/scoped-instructions.md:10`.
- What must not live there: "Do not ship repo-wide or session-wide behavior as a file-edit-triggered instruction; make it rule 1 or rule 2 instead." — `references/placement-rules.md:41-42`; "a rule scoped to one file type is rule 3" — `placement-rules.md:66-67`.
- Process goes to a skill: "Guidance about a whole process or workflow belongs in a skill" — `scoped-instructions.md:14`; "Keep the file scoped to one file type; move process guidance to a skill." — `scoped-instructions.md:29`.
- Scope discipline: "confirm the `applyTo` glob matches the intended files and no wider." — `placement-rules.md:44`.
- Pointers: "When a skill needs a rule at execution time, place the rule in the skill (skills self-contain and never depend on reading an instruction)." — `SKILL.md:94`. A pointer-only instruction therefore carries no rule of its own at edit time.

## Per-file results

| File | applyTo | Lines | Band |
|---|---|---|---|
| `comments.instructions.md` | `{**/*.{ts,js,py,yml,yaml,md,json,jsonc,sh,html,htm,toml,cfg,ini},**/{justfile,Justfile,Dockerfile,Dockerfile.*},**/.env*}` | 298 | FITS |
| `justfiles.instructions.md` | `{.*,**}/justfile` | 573 | OVERLAPS |
| `opencode-plugin-interfaces.instructions.md` | `.opencode/plugins/*.ts` | 170 | OVERLAPS |
| `shaping.instructions.md` | `.agents/skills/**/{SKILL.md,workflows/**/*.md,references/**/*.md,recipes/**/*.md}` | 49 | DUPLICATES |
| `tdd-enforcement.instructions.md` | `**/*.{ts,js,py}` (excludes `**/*.test.ts,tests/*.py`) | 65 | MISPLACED |
| `typescript-test-best-practices.instructions.md` | `.opencode/plugins/tests/**/*.test.ts` | 8 | DUPLICATES |
| `zombie-test-design.instructions.md` | `{tests/*.py,**/*.test.ts}` | 10 | DUPLICATES |

Counts: FITS 1, OVERLAPS 2, DUPLICATES 3, MISPLACED 1.

## Duplicated rules and owning skill files

1. `shaping.instructions.md` vs `.agents/skills/building-modular-skills/references/guidance-structure.md:77`.
   Instruction: "Keep root `SKILL.md` <=160 lines (hard gate); aim for ~90 lines per building-modular-skills Rule 1."
   Skill: "Budgets: root ≤160 lines (hard gate; keep it near the ~90-line target of Rule 1); each reference ≤120 lines".
   The 24-check gate, the 3-script audit commands, and the frontmatter output format are also in `building-modular-skills` (shaping checklist and manage-skill). The instruction is a second copy of skill-authoring process, not edit-time guidance for matched files.
2. `tdd-enforcement.instructions.md` vs `.agents/skills/test-driven-development/SKILL.md:35`.
   Instruction: "If you modify implementation code before writing a failing test: 1. **STOP** immediately."
   Skill: "`!NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST!`".
   The file itself says the rules are elsewhere: "The workflow, Iron Law, verification checklist, and rationalizations are in the `test-driven-development` skill" (line 11). It is process guidance keyed to a file glob, which placement rule 3 forbids.
3. `typescript-test-best-practices.instructions.md` vs `.agents/skills/test-design/SKILL.md:59`.
   Instruction: "Before editing any test load `test-design` skill and follow its methodology to understand quality criteria."
   Skill: "Learn what TypeScript specific conventions to follow | references/typescript-conventions.md".
   Pure pointer; adds no rule at edit time. Nothing is lost on deletion because the skill self-contains.
4. `zombie-test-design.instructions.md` vs `.agents/skills/test-driven-development/references/zombie-test-design.md:5`.
   Instruction: "When starting a new feature or fixing a bug, design test cases incrementally from the simplest case upward."
   Skill: "When starting a new feature or fixing a bug, use the ZOMBIES mnemonic to discover and prioritize your test cases."
   The instruction carries only the mnemonic sentence and defers to the reference it duplicates.
5. `justfiles.instructions.md` vs `AGENTS.md` (PROJECT STRUCTURE block).
   Instruction line 23: "`scripts` | `scripts/justfile` | experiment & DSH workflows".
   AGENTS.md: "scripts/justfile    # experiment & DSH workflows". The 7-row module table restates the AGENTS.md tree.
6. `opencode-plugin-interfaces.instructions.md` § Naming and lint rules vs `.agents/skills/refactoring-patterns/references/smell-catalog.md:229`.
   Instruction: "`refactoring-patterns` names the second rule as the Decide-and-Act smell and carries the split fix."
   Skill: "### Decide-and-Act Method ... split the decision from the action".
   The rule is a pointer to a skill-owned smell; it does not need a plugin-file home.

## Rules lost if the file is deleted

- `designed to survive nowhere` items are marked LOAD-BEARING-NOWHERE.

1. LOAD-BEARING-NOWHERE — `tdd-enforcement.instructions.md:36`: "After completing a RED → GREEN → REFACTOR cycle, you MUST remove all debug artifacts before considering the work done." No skill carries it: `grep -rn "console\.log\|debug artifact\|commented-out"` over `.agents/skills/test-driven-development/` and `.agents/skills/test-design/` returns nothing.
2. LOAD-BEARING-NOWHERE — `tdd-enforcement.instructions.md:44`: the cleanup table row "`Commented-out code` | `grep -rn "//.*(DEBUG|TEMP|HACK|FIXME)"` in changed files | Clutters codebase, hides intent". `comments.instructions.md` § Ownership hands this same cleanup rule back to `tdd-enforcement` ("Cleanup of commented-out code and debug artifacts | `tdd-enforcement`"), so the only home is the file a deletion would remove — a circular dependency.
3. LOAD-BEARING-NOWHERE — `justfiles.instructions.md:39`: "Enforce root boundary: exactly 11 globals (`test lint typecheck ci ci-fast format format-check clean verify-agents oc oc-log`) + 7 `mod` imports". AGENTS.md states only "recipes appear under `just --list`"; the exact counts and names exist only here.
4. LOAD-BEARING-NOWHERE — `justfiles.instructions.md:40`: "Scoped justfiles must declare scope: add at top `set working-directory := ".."` (gate 9 requires 7 scoped files)". Gate numbering appears in no other file.
5. LOAD-BEARING-NOWHERE — `justfiles.instructions.md:48`: "Keep `scripts/conductor/.gitkeep` tracked (`git ls-files scripts/conductor/.gitkeep`) so clean clones pass." Unique.
6. LOAD-BEARING-NOWHERE — `justfiles.instructions.md:571`: "a recipe runs from the justfile's own directory, not the workspace root. Add `cd /workspace`". Unique, and it contradicts line 47 of the same file ("Never use `cd <dir> &&` in a `justfile` recipe") and the `cd bar && pwd` example at line 553.
7. LOAD-BEARING-NOWHERE — `opencode-plugin-interfaces.instructions.md:41`: "`@opencode/plugin/effect` is the documented subpath; `/effect/plugin` resolves through the `./*` wildcard." Pinned versions (`@opencode/plugin@2.0.24`, `effect@4.0.0-rc.112`), the `.d.ts` map, and the v1-survivor table exist in no skill.
8. LOAD-BEARING-NOWHERE — `opencode-plugin-interfaces.instructions.md:110`: "`applyTo` matches only direct children of `.opencode/plugins/`. `helpers/*.ts` and `tests/*.ts` do not load this file." This is a self-reported scoping gap: the interface guidance never reaches the helper and test files that consume the same API.
9. LOAD-BEARING-NOWHERE — `comments.instructions.md` (whole discipline, 298 lines). No skill owns comment quality; `writing-style` owns document voice and `tdd-enforcement` owns cleanup, both instructions. Deleting the file loses e.g. "A comment on a cast should explain the runtime or type-checker trap that requires the cast, not repeat the cast syntax." It is the intended home, so the only debt is that its ownership table points at instruction files rather than skills.

## Surviving homes (nothing lost)

- `shaping.instructions.md` → `building-modular-skills` (guidance-structure.md, shaping checklist).
- `typescript-test-best-practices.instructions.md` → `test-design/references/typescript-conventions.md`.
- `zombie-test-design.instructions.md` → `test-driven-development/references/zombie-test-design.md`.
- `tdd-enforcement.instructions.md` Iron Law and `just`-target rule → `test-driven-development/SKILL.md:35` and `references/running-tests-commands.md:5`.

## Placement conclusions

- `shaping`, `tdd-enforcement`, `typescript-test-best-practices`, `zombie-test-design` are skill duplication or process misplaced into a file-edit instruction; their unique residue is the tdd debug-cleanup section (LOAD-BEARING-NOWHERE).
- `justfiles` carries genuine edit-time rules plus a restated AGENTS.md module table and an upstream `just` syntax manual (roughly lines 88-565), which no skill owns.
- `comments` fits the definition; its only structural fault is the circular cleanup ownership with `tdd-enforcement`.
- `opencode-plugin-interfaces` is knowledge plus edit-time rules, and its `applyTo` is narrower than the API surface it documents.
