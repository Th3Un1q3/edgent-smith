---
id: lessons/orchestration/skill-edit-contradiction-sweep
name: skill-edit-contradiction-sweep
type: experiences
scope: experiences
status: active
confidence: high
freshness: 2026-10-25
timestamp: 2026-10-25
ttl: 180d
L0: "Skill-edit sweep: 16 pairs; fixed direct conflicts on script-gate optionality, denied gateway tools, empty-return vs denial; one unstated precedence; left compatible exceptions."
tags: [skills, contradictions, serena-memory, gateway, editing, audit]
provenance: session sweep of .agents/skills/serena-memory (SKILL.md + references/ + workflows/), 2026-10-25
supersedes: none
---
# Skill-edit contradiction sweep — serena-memory

Record of the contradiction sweep run over the serena-memory skill during an edit. It records findings and the sweep procedure; the enforceable edit-time rule lives in `.opencode/instructions/skill-editing.instructions.md` (see mem:lessons/skill-rule-contradiction-audit-2026-10-25). This memory is a session record, not the injection mechanism.

## Procedure

1. Enumerate every normative statement: sentences that say must / never / always / only / stop / required, plus every predicate that defines failure. Collect from SKILL.md, references/, workflows/, recipes/ — not just the edited file.
2. Pair by subject: two statements belong to one pair when they govern the same behaviour (same action, same artifact, same failure predicate), even when they are worded differently or sit in different files.
3. Classify each pair: CONFLICT (both cannot hold), PRECEDENCE (compatible but which wins is unstated), or EXCEPTION (a general rule plus a narrower, deliberately compatible carve-out).
4. Fix only CONFLICT and PRECEDENCE pairs. A CONFLICT is restated so one rule holds; a PRECEDENCE gets an explicit ordering sentence. Leave EXCEPTION pairs untouched — rewriting a deliberate carve-out destroys the rule.
5. Re-sweep after fixes: the new sentence may now pair with a third statement. Also run the dead-name check: every tool, command, path and config key still resolves.
6. Record the pair count, the fixed subjects, the precedence stated, and the exceptions kept; a sweep with no count is unfalsifiable.

## 16 pairs found

### Conflicts fixed

1. Optional verification scripts vs blocking gate. gating.md said the three python scripts are optional and their absence never blocks completion; a nearby line said every local script present must exit 0. Restated: the 9 semantic checks decide completion, scripts are optional evidence, and a script that exists and fails to run is still reported (not a completion blocker).
2. "Missing script is not a failure" vs "if any script fails, stop". store-memory.md carried both. Restated: missing script = not a failure; script that runs and fails = reported failure of that script, gate still decided by the 9 checks. Aligned with principle wording.
3. Dead tool name. disclosure.md named `gateway_mcp-exec` as the way to batch reads, but that wrapper is denied in this harness. Replaced with the flat single call plus a batched `execute` call, matching gateway-protocol.md.
4. "Wrappers still exist and still work" vs denied. gateway-protocol.md implied the code-mode/mcp-exec wrappers were usable; the permission set denies them. Restated: single call = flat tool, multi-read inventory = `execute`, the wrappers are never needed.
5. Empty-return predicate vs permission denials. `gatewayEmpty` matched `Access denied` and treated it as an infra flake, while the fallback rule says a permission denial is not an infra flake. Restated: empty or stderr = flake, one `bash cat` fallback; a denial = report and stop, no fallback.
6. Direct `.serena` fallback vs denied direct reads. The sanctioned one-shot `bash cat .serena/memories/<id>.md` fallback could read as permission to read memories directly whenever convenient. Restated: it exists only after an empty gateway return, 0 retries, and never when the harness denies direct reads.
7. Untyped procedure scope. The procedure was described as a "lessons" memory while the frontmatter family requires one of the typed scopes. Resolved: type `experiences`, directory `lessons/`.

### Precedence stated (one)

8. Banner sweep procedure vs the pattern-pair sweep. Two sweep descriptions existed with different granularity; both compatible, but neither said which governs the other. Stated: the procedure above governs; pattern-pair lists are its input, not a second method.

### Exceptions kept compatible (8)

9. L0 scan vs L0 quote: names may be answered from `list_memories`; content must be quoted only from a `read_memory` return. Not a conflict — scan vs quote are different operations.
10. Two vs three script bodies: the principle names three scripts, one workflow names three, another names two. Set inclusion, not disagreement.
11. Retire vs consolidate: retiring needs no human gate, merging a contested claim does. Different actions, different gates.
12. Rename checks: rename validates the new name against the typed prefix; delete validates authorization. Different targets.
13. Recall targets: topic filter vs prefix filter return different sets by design.
14. In-session vs pasted grading: a live session gets verified vs a pasted excerpt cannot be verified. Different evidence classes.
15. Parent-about update: mandatory when the about exists, flagged when it does not. Conditional, not contradictory.
16. Dedup create vs merge: thresholds disjoint (>0.9 skip, >0.6 merge, else create).

## Lessons

- A sweep that edits a carve-out breaks the skill; classify before fixing.
- Dead tool names are conflicts even when the surrounding sentence is otherwise true.
- Count the pairs. "I looked for contradictions" is not verifiable; "16 pairs, 7 subjects fixed, 1 precedence, 8 exceptions kept" is.
