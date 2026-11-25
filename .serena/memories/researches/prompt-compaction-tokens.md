---
id: researches/prompt-compaction-tokens
L0: "PROPOSAL: Prompt scaffolding repeats each dispatch; #-tokens replace the repeats and stored briefs replace repeated content, taking prompts 28-33% lower after an 11.1% prose-only ceiling."
---

## Idea
Each dispatch repeats one scaffolding: wrapper, sentinel, do-not frame, report paragraph, role opener, gate line, allowlist, length ceiling. Tokens replace the repeats; references replace repeated content. Prose tokens alone cap at 11-13%: they compress only scaffolding a session already reuses, measured at 11.7% of unique-token characters; the ~82% of unique content needs both structural moves below.

## Shape
| token | expansion | chars | may vary |
|---|---|---|---|
| #S | end with exactly <w> on the last line | 700 | the word |
| #X | do not <list>; do not skip the check | 570 | ≤3 items |
| #R | <n> lines: outcome, evidence, risk | 550 | n |
| #G | run <cmd>; stop on failure | 198 | cmd |
| #A | write only <paths>; read anything else | 165 | paths |
| #L | reply under <n> chars | 112 | n |
| #B | read brief <ref>, authoritative | 1,584 | the ref |
| #C | continue as bound role; only the delta is new | 420 | the delta |

Rules: line-initial, one token per line; unknown token aborts the dispatch; OUT=/IN=/HANDOFF= stay literal as they carry data; paths appear only in parentheses, verbatim; a literal line beats a token.

## Where it lives
All PROPOSED. Canonical table: `.agents/skills/prompt-compaction/SKILL.md`, the child skill owning expansions and the brief version. Emitter: `.agents/skills/task-delegation/`, whose dispatch script writes tokens. Brief storage: `.agents/skills/prompt-compaction/briefs/`, versioned; #B stays re-readable across sessions.

## Grounding
One session: 13 dispatches, 36,041 characters, median 2,249. Harness-injected 4.4% (four <request> copies); orchestrator boilerplate ~14% (8.7% measured, ~5.5% ESTIMATED); unique ~82%. Repeats ranked, characters savable: request wrapper 1,524; sentinel ~700; do-not frame ~570; report paragraph ~550; role opener ~380; gate line 198; allowlist header 165; length ceiling 112. Sum 4,199 = 11.7%; net of token cost 4,014 = 11.1%. Structural moves: #B removes wrapper and briefs (reuse ESTIMATED 20.0%), #C collapses the role opener into label plus delta (1.1%), giving 28-33% and a 67-72% floor, ESTIMATED. subtask_run takes a session-scoped label, grounding #C in shipped surface.

## Related memories
- mem:researches/parent-child-subagent-protocol — OUT=/IN=/HANDOFF= family it extends.
- mem:researches/write-once-read-many-context — the brief #B references.
- mem:researches/labelled-subagent-sessions — the shipped label behind #C.

## Open questions
- Is a 2-character token worth the readability cost, or should tokens read as `#SENT`?
- Who owns the canonical expansion table when parent and child skills disagree?
- How does a child report a token it could not expand without derailing?
- Does #B beat inline text once the child's read call is priced in?

## Risks
- Mis-expansion: the child guesses a near-token. Mitigation: unknown token aborts, the brief is versioned, the sentinel is never tokenised.
- Salience loss. Mitigation: literal beats token, plus the never-tokenize list — sentinel unit/last semantics (fires early or twice), paths (a compressed path edits the wrong file), allowlists (a short list permits a foreign write), file:line anchors (a drifted anchor proves the wrong claim), test names (a drifted name selects zero tests and passes), exact error strings (a paraphrased string greps nothing), the never-read-the-memory-directory line (a summary invites a direct read).
- Brief archaeology: the ref carries the version and is re-read only on change.

## First step
Instrument one dispatch: log ratio = len(expand(emitted)) / len(emitted) against the pinned brief; revise the token set when the ratio stays below 3.0x twice running or one dispatch exceeds 45%.