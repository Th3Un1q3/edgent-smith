---
id: conventions/plugin-module-placement
L0: "A plugin module lives in the scope dir that reaches it, moves to helpers/ when two or more scopes reach it, and to legacy/ when no entry does; entry points stay at plugins/<name>.ts and normative contracts live in memory."
freshness: 2026-11-23
provenance: /workspace/.opencode/plugins/AGENTS.md; /workspace/.opencode/plugins tree
---
# Plugin module placement

Source: `.opencode/plugins/AGENTS.md` § Placement rule and the plugin tree, read 2026-11-23.

## Placement by reachability

- Entry point: `.opencode/plugins/<name>.ts` — the loader scans that depth only.
- One scope reaches it: `.opencode/plugins/{scope}/` (`gates/`, `instructions/`, `state-machine/`, `tool-limit-reminder/`, `workflow/`).
- Two or more scopes reach it, directly or through a barrel: `helpers/`.
- No entry reaches it, kept only for tests: `legacy/` with a first-line unreachable header.
- `config/` and `types/` hold what entry points and several scopes read.

## Measure reach, not directory names

Shared means reachable from the five entry points, transitively through re-exports; a module is not shared for sitting in `helpers/`. The reach test that moved single-scope code out of `helpers/` also exposed dead barrels and test-only modules that no entry reached.

## Dead barrels

A barrel nothing imports is deleted with its re-exports; the modules it re-exported are judged on their own importers. Listing a barrel in AGENTS.md as load-bearing is how dead structure survives a reorganisation.

## Contracts live in memory

A normative contract belongs in memory, not a markdown file: an agent that opens a long contract file stays in it. Split it into one index plus section parts, since the store caps a memory at 4000 characters including frontmatter; the index carries the vocabulary map, each part one bullet per rule.

## Moves break outside paths

Moving source files invalidates hardcoded paths outside the plugin tree — integrity tests, scripts, threshold pins. The author of a move sweeps them in the same change.
