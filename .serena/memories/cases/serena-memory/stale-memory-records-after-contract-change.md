---
id: cases/serena-memory/stale-memory-records-after-contract-change
type: cases
L0: "A mechanism replacement swept the plugin sources and the agent templates, and left memory records teaching the removed `<task_skills>` injection; recall, not the file sweep, found them."
hotness: 1.0
ttl: 365d
version: 1
freshness: 2026-11-26
directory: cases/serena-memory
status: active
claim_ids: []
provenance: subtask_run skill-injection rework, 2026-11-26
related: mem:cases/opencode/stale-guidance-surface-after-plugin-contract-change, mem:cases/opencode/sdk_skills_injection
---
# Memory records outlive the mechanism they teach

## Symptom
`subtask_run`'s skill injection moved from a `<task_skills>` text block to native prompt attachments. The change swept the plugin sources and both session templates. The closing validator's recall found three memory records still teaching the text block and the name-to-file skip, one of them `mem:cases/opencode/sdk_skills_injection`, which described `loadSkill`/`injectSkills` in `.opencode/plugins/helpers/workflow-subtask.ts:116-157`, a module the change deleted.

## False hypothesis
A sweep of the tree under edit covers every surface that describes the tool's contract, and a memory written months earlier reads as history rather than as current guidance.

## Root cause
The doc-sweep file list came from the tree the implementer was editing, a `grep` over `.opencode`, so memory bodies had no row in it. Memory records are found by recall over their subject, not by a path grep, and each was written while the old mechanism was current, so it read as guidance to the next agent. The change edited the templates it could grep and left the records it would have had to recall.

## How confirmed
The closing validator recalled the removed mechanism's name and read each hit; three bodies still described the text block after both templates were corrected. Each was then superseded with a banner naming its replacement: `mem:cases/opencode/sdk_skills_injection` now opens with `Superseded 2026-11-26 by mem:decisions/opencode-native-skill-injection-subtask-run`.

## Prevention
A change that replaces a named mechanism carries its own recall row: the implementer lists memories whose subject is that mechanism, reads each body, and corrects or supersedes it in the same change; the validator repeats the recall and requires zero active records describing the removed mechanism.
