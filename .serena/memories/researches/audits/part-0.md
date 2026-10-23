---
id: researches/audits/part-0
type: researches
L0: "# Instruction purpose audit — part 0"
---
# Instruction purpose audit — part 0

Read-only audit of `.opencode/instructions/*.md` against the harness-management
definition. Files sorted by name; zero-based index mod 3 == 0 selects 7 of 20 files.

## Definition (quoted)

- An instruction exists for guidance scoped to a path or glob, "loaded automatically when an agent touches those files — editing Python, justfiles, markdown, or another matched surface" (`.agents/skills/harness-management/references/placement-rules.md:36-38`).
- Counter-rule for repo-wide policy: "a rule that must bind all actions or all agents is not a file-edit instruction. Do not ship repo-wide or session-wide behavior as a file-edit-triggered instruction; make it rule 1 or rule 2 instead" (`references/placement-rules.md:40-42`).
- Counter-rule for process: "a process or workflow that is not one file type (rule 3) and not one agent (rule 2) — it spans concerns or recurs across situations, so no single instruction, agent file, or directory can scope it" belongs to a skill (`references/placement-rules.md:62-64`).
- Placement intent: "Keep the file scoped to one file type; move process guidance to a skill" (`workflows/scoped-instructions.md:29`); "Guidance about a whole process or workflow belongs in a skill" (`workflows/scoped-instructions.md:14`).
- Pointers are preferred over restatement: the definition routes by naming other homes — "Map a session-audit finding to a change type" (`SKILL.md` Task Routing Table), and rule 4 counter-example forbids "emergent behavior" in a knowledge base, routing it to a skill or memory (`references/placement-rules.md:52-54`).
- Verify gate: "confirm the `applyTo` glob matches the intended files and no wider" (`references/placement-rules.md:44`).

## Files reviewed

| # | File | applyTo | Lines | Band |
|---|---|---|---|---|
| 1 | cli-structure.instructions.md | `{cli/**/*.py,tests/test_cli_*.py,tests/test_*_cli.py}` | 214 | OVERLAPS |
| 2 | github-actions-tech-guidance.instructions.md | `.github/workflows/**/*.yml` | 174 | OVERLAPS |
| 3 | live-verification.instructions.md | `.opencode/plugins/**/*, .opencode/instructions/**/*.md, .agents/skills/**/*.md, .dsh/**, scripts/conductor/**, AGENTS.md, docs/plan/**/*.md, tests/*.py` | 29 | MISPLACED |
| 4 | plugin-tests-imports.instructions.md | `.opencode/plugins/tests/**/*` | 128 | OVERLAPS |
| 5 | steering-message.md | none (no frontmatter) | 62 | MISPLACED |
| 6 | test-run-commands.instructions.md | `{**/*.{py,ts,js},.opencode/**/*.json}` | 52 | MISPLACED |
| 7 | writing-style.instructions.md | `**/*.md` | 61 | OVERLAPS |

Counts: FITS 0, OVERLAPS 4, DUPLICATES 0, MISPLACED 3.

## Findings

### 1. cli-structure — OVERLAPS

Genuine edit-time guidance for Click modules (layer placement, anti-patterns, command and service checklists). Duplicated restatement:

- `.opencode/instructions/cli-structure.instructions.md:12` "Layer 1: Command Routing (`cli/main.py`)" vs `AGENTS.md` CONVENTIONS: "Strict separation between command routing (`cli/main.py`), logic (`commands/*.py`), and services (`services/*.py`)".
- Directory knowledge, which the definition sends to `cli/AGENTS.md` (rule 4): the layer map, "Examples from the Codebase", and both "Checklist: Adding a New Command" / "Checklist: Adding a New Service" sections restate directory structure, not a file-edit mistake.
- No skill owns the three-layer rule; `click-cli` covers options, progress output, and scaffolding only (grep of `click-cli/**` for `services/` returns nothing).

### 2. github-actions-tech-guidance — OVERLAPS

Legitimate workflow-YAML guidance (devcontainers/ci invocation, env forwarding, cache keys, uid normalisation). Duplicated and misplaced material:

- `github-actions-tech-guidance.instructions.md:168` "**A green prebuild does not imply a green gate job.**" restates `AGENTS.md`: "CI Workflow: `.github/workflows/ci.yml` runs `prebuild-devcontainer` then `ci` inside the DevContainer."
- The "Lessons / pitfalls" section (line 166 onward) records incidents ("PR caches are ref-scoped", "Pin toolchains") — rule 6 memory material per `references/placement-rules.md:75-79`, not file-edit guidance.
- The file is named as the CI-internals owner by `AGENTS.md` CONVENTIONS, so deletion would orphan that pointer.

### 3. live-verification — MISPLACED

Defines what a unit test is and what a live check is, then how to run one and how to report it. This is a repo-wide testing policy, and its `applyTo` spans plugins, instructions, skills, `.dsh`, conductor, root `AGENTS.md`, and `tests/*.py` — closer to "all actions" than to one file type (`references/placement-rules.md:40-42`).

- No skill owns the live-check definition: grep of `test-design` and `test-driven-development` for "live check" returns nothing.
- Cross-reference that would dangle: `AGENTS.md` CONVENTIONS "Test Verification: `.opencode/instructions/live-verification.instructions.md` defines unit versus live tests", and `comments.instructions.md`, `harness-verify.instructions.md`, and `.opencode/instructions/shaping.instructions.md` cite the same vocabulary.

### 4. plugin-tests-imports — OVERLAPS

Repo-specific alias table and helper paths are true edit-time facts for `.opencode/plugins/tests/**`. Duplicated rules:

- `.opencode/instructions/plugin-tests-imports.instructions.md:30-31` "3. `vi.mock()` calls at file top (vitest hoists these automatically) / 4. Stub imports for mocked modules (import after the corresponding `vi.mock()`)" vs `.agents/skills/test-design/references/typescript-conventions.md:143-144` "1. `vi.mock("dep")` at file top — auto-generates stubs (vitest hoists these)" and "2. Import from the mocked module **after** `vi.mock()` calls".
- Hoisting rule also stated in `.agents/skills/vitest/references/features-mocking.md:255` "`vi.mock` is hoisted - called before imports".
- `opencode-plugin-interfaces.instructions.md:10` (sibling file) already owns source-file import conventions; this file re-points at it.

### 5. steering-message — MISPLACED

No frontmatter and no `applyTo`, so it never scopes to a file type; it is plugin-developer documentation for the steering envelope plus a "Adding a New Steer Message" procedure. Per `workflows/scoped-instructions.md:14` a procedure belongs in a skill; per `references/placement-rules.md:36-38` a file with no glob cannot be a rule-3 instruction. It is also the only `*.md` here not named `*.instructions.md`, against `workflows/scoped-instructions.md:26`.

### 6. test-run-commands — MISPLACED

The canonical-runner policy, virtualenv rule, per-file verification mandate, budget accounting, gate-failure triage, and long-gate rule are process and repo-wide policy, not file-type editing advice, on a near-universal glob (`**/*.{py,ts,js}`, `.opencode/**/*.json`).

- Duplicated: `.opencode/instructions/test-run-commands.instructions.md:27` "NEVER call underlying implementation commands directly (eg. `pytest`, `npm test`, `vitest`, `bun`, `tsc`)" vs `.agents/skills/test-design/references/typescript-conventions.md:9` "Run them through the project's canonical task-runner targets (for example `just test`) instead of direct runner commands".
- Duplicated: `test-run-commands.instructions.md:12` "Use `just` targets instead of raw runners" vs `.opencode/instructions/justfiles.instructions.md:10` "Use `justfile` as the canonical source for project commands".

### 7. writing-style — OVERLAPS

Markdown prose style is a defensible `**/*.md` edit-time concern, but the rule set is a second copy of the `unslop` skill.

- `.opencode/instructions/writing-style.instructions.md:24` "**Eliminate Stop‑Words**: Remove introductory filler ("Obviously, …"), subjective amplifiers ("very, incredibly"), clichés …" vs `.agents/skills/unslop/SKILL.md:66` "**Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" gets deleted."
- `.opencode/instructions/writing-style.instructions.md:22` "**Concrete Language**: Use sensory or measurable details instead of abstract nouns" vs `.agents/skills/unslop/SKILL.md:76` "**Say what it does, not how it feels.** … The fix names the mechanism or a number".
- Cross-owner: `comments.instructions.md` delegates "Document-level voice, meta-commentary, and provenance in markdown" to `writing-style`, so deletion without repointing leaves that table entry dangling.

## LOAD-BEARING-NOWHERE

Rules with no surviving home. Deleting the file loses them silently.

1. `test-run-commands.instructions.md:31` — "Avoid manual venv activation (`source .venv/bin/activate`). Run Python via `uv run <command>` or a `just` recipe; the `uv run` path resolves the project environment without activation." `AGENTS.md:123` only points here ("See `.opencode/instructions/test-run-commands.instructions.md`"); the rule text lives nowhere else.
2. `test-run-commands.instructions.md:35` — "**Verify each file as you finish it** — after editing a file, run the relevant per-file check … BEFORE moving on to the next file. Do NOT defer verification to the end of the task."
3. `test-run-commands.instructions.md:37` — "**Budget for it** — per-file verification consumes tool calls. Account for it against the advertised `<task-budget tool-calls="N" />` and reserve calls for verification."
4. `test-run-commands.instructions.md:50` — "Run a long gate (`just ci`, `just mutation`, the full test suite) to completion in the foreground and return its result. Backgrounding it and returning early hands the caller no verdict". No repo file carries this.
5. `live-verification.instructions.md:14` — "A live check is a delegated CLI/agent run with a real agent and model. It is not a test file of any kind: it is never collected, and it must not be added to `.opencode/plugins/tests/`." No skill defines a live check.
6. `live-verification.instructions.md:20-24` — the four live-check methods (delegated standalone CLI prompt, self-context probe, subagent trigger, random-token echo) exist in no skill or memory.
7. `plugin-tests-imports.instructions.md:14-24` — the alias-to-path table ("`@tests/helpers/mock-utilities` → `.opencode/plugins/tests/helpers/mock-utilities.ts`", "`@plugins/helpers/<module>`") is the only mapping in the repo.
8. `plugin-tests-imports.instructions.md:88` — "Functions that call mocked imports (`sendMessage`, `runGate`, `log`, etc.) MUST be defined inside the plugin function body as inner closures." The sibling `opencode-plugin-interfaces.instructions.md` and `vitest` cover hoisting, not this mock-instance divergence rule.
9. `steering-message.md:7-13` — the steering attribute table (`priority`, `reason`, `type`, `result`, `gate-id`) is not reproduced in any skill; the plugins that emit it reference the format but do not define it.
10. `cli-structure.instructions.md:179-196` — "Checklist: Adding a New Command" and "Checklist: Adding a New Service" are absent from `cli/AGENTS.md` and from `click-cli`.
11. `github-actions-tech-guidance.instructions.md:60-63` — "**`hashFiles` cannot see an untracked or gitignored lockfile.** … Keep `.opencode/bun.lock` committed and tracked" and the surrounding cache-key rules exist nowhere else.
