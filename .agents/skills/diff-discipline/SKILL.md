---
name: diff-discipline
description: >
  Edit-scope discipline for changing an existing artifact without collateral
  damage: the smallest correct diff, an anchor verified before every
  replacement, a re-read that proves the change landed, and scope treated as a
  promise. Use when a worker patches, fixes, updates, or extends an existing
  file of any kind — code, tests, config, docs, data, prompts, skill text — and
  stack it on the pack that supplies the method. Trigger on "smallest diff",
  "minimal change", "only what's needed", "don't touch anything else",
  "surgical edit", scope creep, collateral damage, unrelated refactor,
  formatting churn, a diff bigger than the change, or a gate that only passes
  after editing a neighbouring file. Not a method pack: it never supplies the
  domain method, only the rules for landing an edit inside one.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: "1.0.0 — extracted the edit-discipline half of rug-swe.md into a stackable pack: scope as a contract, minimal diffs, no unrelated refactors or formatting churn, anchor verification, per-file re-read proof, and the path/gate/scope failure modes. The software method itself stays in the method packs."
  author: Th3Un1qu3
---

# Diff Discipline

An edit is a claim about exactly which bytes change. This pack makes that claim small, verified, and inside the scope the caller agreed to. It applies to any artifact a worker edits; where a rule only makes sense for executable code, the section says so.

## Task Routing Table

One file, no companions; every section is reachable here.

| I want to... | Section |
|---|---|
| Run the edit loop end to end | [The Edit Loop](#the-edit-loop) |
| Decide whether a file may change at all | [Scope Is a Promise](#scope-is-a-promise) |
| Keep the diff free of churn | [Smallest Correct Diff](#smallest-correct-diff) |
| Replace text that may not be where I think it is | [Confirm the Anchor](#confirm-the-anchor-before-you-replace) |
| Prove an edit landed | [Re-read to Prove It](#re-read-to-prove-it) |
| Diagnose a bad edit habit | [Failure Modes](#failure-modes) |
| Know which rules are code-only | [Code-Specific Boundary](#code-specific-boundary) |

## The Edit Loop

Run this per artifact, one at a time. Finish a file before starting the next.

1. Cite the contract's `scope:` line and name the file you are about to change.
2. Read the region you will replace, with one or two lines of context on each side.
3. Make one edit, replacing only the intended text.
4. Re-read the edited region and confirm the change is present exactly once.
5. Run the cheapest structural check for that artifact type, then move on.

An artifact is not done until step 4 passed. Verification of the file is part of producing it, not a later phase.

## Scope Is a Promise

The `scope:` field in the task contract is a promise to the caller: these artifacts change, these do not. Every edit answers to it.

- A file outside scope does not change, however wrong it looks.
- Discovery outside scope is expected. Report it: one line per item — path, defect, suggested follow-up. It lands under `residual risk`, not in the diff.
- Drive-by allowance: fix in the same edit only when it is the same file, the same line region, the same class of defect (a typo, a dangling reference, a missing guard on the line you already touch), and it adds no behaviour. Cost test: if the fix needs its own verification, it is out of scope.
- When the task cannot be done inside the promised scope, change the promise first: state the new scope, get it into the contract, then edit. Silent widening is the failure this pack exists to stop.
- A scope you did not write is not yours to interpret loosely. Narrow it only with the caller's agreement; widen it never.

## Smallest Correct Diff

Change what the acceptance criteria require and nothing else.

- Leave untouched lines byte-identical: no reordering, no reindenting, no reformatting, no comment rewording, no rename, no dead-code deletion, no dependency bump in the same change.
- Follow the file's existing convention over the project's ideal convention. Introducing a second idiom inside one change is churn, not improvement.
- Preserve structure you did not come to change: key order, heading levels, list markers, table alignment, and the file's trailing-newline shape.
- Never mix a behavioural change with a style sweep; a reviewer must be able to separate intent from noise.
- Two independent edits in one artifact are still two edits: land and verify them separately.
- If the diff touches more lines than the change explains, revert to the pre-edit artifact and redo it smaller.

```diff
 # RIGHT — the guard fix touches the failing line only
     if total < 0:
-        return None
+        raise ValueError("amount must be non-negative")
     return total

 # WRONG — same fix, but the hunk also reflows the signature
-def charge(amount, currency="USD"):
+def charge(
+    amount,
+    currency="USD",
+):
```

## Confirm the Anchor Before You Replace

The text you replace must be text you just read.

- Build the anchor from the read output, never from memory, the task description, or a previous turn's view of the file.
- Include enough context for uniqueness across the whole artifact. If the anchor repeats, extend it; if it still repeats, name the enclosing section or function and edit inside that boundary, or edit each occurrence deliberately one at a time.
- Match exactly as rendered: indentation, tabs versus spaces, quote style, line endings, typographic quotes and dashes.
- Anchor not found means one of three things: the artifact changed, your whitespace or quoting assumption is wrong, or you are in the wrong file. Re-read that region and rebuild the anchor from what is there.
- Never force a match by replacing the whole artifact, by deleting and retyping a larger region, or by recreating the block you expected to find.
- Two failed anchors on one artifact: stop. List the directory, re-read the artifact's top-level structure, confirm the path, then try once more.

## Re-read to Prove It

Prove the edit against the artifact, not against your memory of making it. A successful edit call is not evidence; the re-read is.

- The intended text is present exactly once, in the intended place.
- Nothing else moved: neighbouring lines unchanged, block intact, no duplicated fragment, no truncated tail, no lost closing delimiter.
- The artifact still satisfies its own structure: code parses or compiles, config and data parse against their schema, headings and links resolve, the section a later step cites still exists.
- Name the check you ran in the report (`pytest tests/test_x.py::test_y`, `python -c "import ast..."`, `yaml.safe_load`, link check). An unrun check proves nothing.
- If the re-read shows collateral change, revert that collateral before continuing; do not carry it forward as accepted damage.

## Failure Modes

Each is a habit to refuse, not a preference to weigh.

| Failure | Looks like | Rule |
|---|---|---|
| Guessing a path | Opening a path inferred from the request instead of listed. | List the directory, then read. Two failed reads mean the layout assumption is wrong; inspect the structure before a third attempt. |
| Editing a neighbour to satisfy a gate | A failing lint, test, or validation silenced by touching a file outside scope: weakening a rule, skipping a case, editing the expected fixture, loosening a threshold, widening an ignore list. | Fix the artifact under change or report the gate as unmet. A gate is evidence, never an obstacle. Editing the check to make the change pass is falsifying the proof. |
| Widening scope to make a test pass | A criterion that can only pass by changing out-of-scope code. | Name the dependency, do not cross the line. Report `outcome: partial` with the failing criterion and the scope it needs; the caller decides. |
| Whole-artifact rewrite | Regenerating a file to avoid anchor work. | Replace surgically; untouched regions stay byte-identical. |
| Formatting sweep | A diff that touches most lines of a file you edited once. | Revert and redo minimally; style is a separate change with its own justification. |

## Code-Specific Boundary

Scope, minimal diff, anchor matching, and re-read apply unchanged to prose, config, data, prompts, and skill text. These are code-only:

- Running a test suite, compile step, linter, or type checker as the structural check.
- Test-first ordering, and reasoning about callers and invariants to judge blast radius.
- Path discipline over a source tree whose layout is implied by imports.

Non-code artifacts use the equivalent check instead: markdown resolves every heading and link; config and data parse against their schema; a prompt or skill still routes every file it names and its sections still resolve. The rule is constant — read the artifact back with the cheapest structural check — only the check varies by artifact type.

## Dependencies

Load these instead of restating them; this pack adds only what they do not carry.

| Situation | Load | Boundary |
|---|---|---|
| Code, test, config or behaviour change | `software-engineering` | Owns the method, test-first, standards, proof of done, path discipline, and its code anti-patterns. |
| Writing or changing a test | `test-driven-development` | Owns the cycle, the watched-failure rule, and the cleanup of commented-out code and debug output. |
| Structure-only change (extract, rename, move) | `refactor` | Owns the transformations; they stay out of a behavioural diff. |
| The change may not need to exist | `ponytail` | Owns reuse-before-add and YAGNI. |

This pack never supplies method alone. It stacks on the pack that does, and outranks that pack on scope and diff shape only. When a method pack lists an anti-pattern this file already carries, this file's rule governs the edit and the method pack governs the reasoning.
