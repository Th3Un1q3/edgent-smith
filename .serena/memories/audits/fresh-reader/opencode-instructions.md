# Fresh-reader audit — /workspace/.opencode/instructions/*.md

Scope: all 20 files in .opencode/instructions (~2315 lines). Read-only audit; nothing edited.
31 findings recorded here; 25 worst below, then the remainder.
Legend: [P] provenance/history, [S] self-reference about the document, [U] no actor / unfalsifiable, [X] contradiction or dangling ref, [F] filler/tautology.

## Worst 25

1. justfiles.instructions.md:14 — "Root `justfile` owns exactly 11 global quality gates plus `mod` imports." [X] Two lines later the doc says verify-agents has "7 topology gates" (:31), then "checks 9 gates" (:38); a reader cannot tell how many gates exist or which list is authoritative.
2. justfiles.instructions.md:47 — "Never use `cd <dir> &&` in a `justfile` recipe — use `working-directory` + `--cwd` or `workdir` param." [X] The same file shows `cd bar && pwd` as an example (:557) and tells you to "Add `cd /workspace`" (:575).
3. cli-structure.instructions.md:35 — "`@click.argument("brief", required=False)`" vs the test at :162 invoking `["autoresearch", "design", "--brief", ...]`. [X] Argument and option are not interchangeable; the copy-paste example pair cannot both run.
4. serena-gateway.instructions.md:29 — "Complete recall only after `read_memory` returns the verified payload (e.g., 1765c for `cache/github/edgent-smith/actions/runs-failed`)." [P] A byte count from one past read is evidence of a session, not a rule the reader can apply.
5. opencode-plugin-interfaces.instructions.md:125 — "A Serena memory, `mem:cases/opencode/sdk_detached_method_this`, records the failure". [X] Dangling reference: the reader has no way to resolve it from this document, and by the repo rule memories are gateway-only.
6. opencode-plugin-interfaces.instructions.md:138 — "(`mem:cases/opencode/plugin_hot_reload_safe_development`, confidence 0.9)". [P] A confidence score is provenance about someone's belief; the reader needs the hazard, not the number.
7. opencode-plugin-interfaces.instructions.md:30 — "`.opencode/plugins/workflow.ts`: `id` 199, `effect` 200, `session.hook('context')` 215". [X] Bare line numbers rot on the next edit and give the reader no anchor text.
8. github-actions-tech-guidance.instructions.md:28 — "must return exactly 5 hits (2 in `ci.yml`, 3 in `experiment.yml`). Current pin is `devcontainers/ci@v0.3.1900000450`." [X] Hardcoded count that harness-verify explicitly tells authors to avoid (:16 "avoid hardcoding line or server counts").
9. github-actions-tech-guidance.instructions.md:34 — "`30` (ci, raised from 20 for mutation headroom)". [P] Change history with no rule attached; the reader only needs the timeout value.
10. github-actions-tech-guidance.instructions.md:172 — "Keep `.opencode/bun.lock` committed and tracked (it is no longer in `.opencode/.gitignore`)". [P] Self-referential repo history; a reader who clones today sees only the current state.
11. threshold-policy.instructions.md:36 — "Gate 12 (`opencode-mutation`) dominates CI wall time: ~193s with `ignoreStatic: true`, down from 451s without it." [P] Undated measurement of one machine; nothing in the document lets the reader reproduce or use it.
12. comments.instructions.md:103 — "In `config.py`, a comment says the function returns `None` when the token is missing, but the function has no `None` branch". [P] An audit finding stated as a rule; a reader cannot tell whether the defect still exists or what to do.
13. comments.instructions.md:62 — "The quote is the opening of a longer comment in `.devcontainer/docker-compose.yml`, cut where its config list starts; the rest of the comment lists the tracked config and the gitignored machine state." [S] The document narrates its own excerpt instead of stating the rule.
14. comments.instructions.md:203 — "`tests/test_transcript_pagination_hardening.py` contains a `Covers:` block inside its docstring; the docstring opens with a TDD hardening line". [P] Session-specific defect inventory with no expiry; reader asks "is this still true, and is it my job?"
15. comments.instructions.md:299 — "This file names the linter rule code when a suppression is the problem. Formatting rules, comment-density targets, ... belong to the files named in the ownership table." [S] Placement/ownership commentary that writing-style:15 explicitly forbids ("never comment on the document's own origin, placement").
16. live-verification.instructions.md:19 — "When the change affects the current agent, inspecting whether the injected instructions actually appear in your own context — present means working, absent means likely not." [U] No actor, no object, no pass condition; "likely not" cannot gate anything.
17. live-verification.instructions.md:25 — "Live evidence is PLAUSIBLE until a real round-trip is quoted." [S] Commentary about evidence standards rather than an instruction; the reader cannot act on "PLAUSIBLE".
18. test-run-commands.instructions.md:37 — "Account for it against the advertised `<task-budget tool-calls="N" />`". [S] Depends on a harness-injected tag the document never defines; a reader without that tag has nothing to budget against.
19. test-run-commands.instructions.md:10 — "Quality gates trigger automatically on relevant file changes and report results in the chat; run them manually to check status." [U] No harness named, no way to verify, and "in the chat" is not a property of this repository.
20. no-permission-workarounds.instructions.md:16 — "Follow the denial hint. When the AFK denial message carries a hint, follow it. The AFK denial message shows a short denial-time hint and points here for the full rules." [F] Three sentences that say only "do what the message says"; "AFK" is never expanded.
21. justfiles.instructions.md:143 — "`echo "Only lines beginning with @ are echoed"`" under the heading "Make an entire recipe quiet by prefixing the recipe name with @". [X] The example contradicts the rule it illustrates.
22. justfiles.instructions.md:187-189 — "This is a simpler interface because only prompt is required. This avoids `--set` and keeps the common case very simple." [F] Justification of an example's design, not a rule; the reader already sees the interface.
23. opencode-plugin-interfaces.instructions.md:10 — "This file is a map of that API ... It is not an API reference." [S] A document describing itself; writing-style forbids this and the reader loses a sentence of signal.
24. plugin-tests-imports.instructions.md:24 vs opencode-plugin-interfaces.instructions.md:146 — alias table lists "`@opencode-ai/plugin` | external SDK type package", while the other file forbids importing it because "The package is not installed". [X] Contradiction with no scope qualifier the reader can apply.
25. cli-structure.instructions.md:213 — "**Last updated:** May 13, 2026" (and command-design.instructions.md:194 "**Last updated:** July 2026"). [P] Provenance footer duplicating frontmatter; the date tells the reader nothing about the rule.

## Remaining 6 (lower severity)

26. github-actions-tech-guidance.instructions.md:168 — "its hardlink handling has exited 1 while `prebuild-devcontainer` reported success" [P] undated incident narrative.
27. github-actions-tech-guidance.instructions.md:129 — "Tip: If this repository uses a local environment file, create `.env`..." [U] conditional boilerplate; "this repository" is the repo the file already lives in.
28. plugin-tests-imports.instructions.md:128 — "There is always a way to address linter error." [F] absolute claim, no method.
29. plugin-tests-imports.instructions.md:68 — "be aware of vitest's mock isolation behavior" [U] no action; the real rule only appears at :88.
30. shaping.instructions.md:41 — "`metadata.version` + delta - bump on every content change; the delta states in one line what changed and why." [P] embeds a changelog in skill metadata; "what changed" is relative to an unstated prior version.
31. harness-verify.instructions.md:89 — "OpenCode v2 hot-reloads instructions and plugins automatically — no manual restart is required for edits to this file." [S] commentary about editing this file, duplicating opencode-plugin-interfaces.instructions.md:138.

## Notes
- Duplication worth flagging: the "each recipe line runs in a separate shell" fact appears twice in justfiles (:210, :551); "devcontainers/ci does not forward env" appears twice in github-actions (:35, :82).
- The comments.instructions.md file is largely a catalogue of repo-specific defects (lines 78, 93, 103, 119, 132, 148, 162, 203); every entry rots the moment the defect is fixed, and none states an expiry.
