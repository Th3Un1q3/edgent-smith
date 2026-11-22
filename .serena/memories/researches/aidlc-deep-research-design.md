---
id: researches/aidlc-deep-research-design
L0: "PROPOSAL, not built: a 17-stage deep-research scope on AI-DLC — 4 scopes, 7 sensors with one blocking gate at 3.4/4.1, 3 capped loops, claims-ledger memory map."
freshness: 2026-11-21
provenance: mem:researches/aidlc-workflows-concepts, 2026-11-21
version: 2
---
# Deep-research workflow on AI-DLC (PROPOSAL)

> **Digest.** PROPOSAL, nothing built: 17 stages over AI-DLC's 5 phases (docs/guide/glossary.md:57), one intent plus record dir per question (glossary.md:37, :62).
> Four scopes select stages and depth — research:scan 6, research:brief 11, research:deep 17, research:refresh 7 (glossary.md:70); skipped stages are [S] with no gate (04-phases-and-stages.md:67).
> Verification is a deterministic sensor, not a second model's prose (glossary.md:71); state is committed Markdown with a filesystem audit trail (10-state-and-audit.md:3, :9).
> Seven sensors, one blocking at 3.4/4.1; three capped loops; the claim ledger is what synthesis reads and what gates check.
> Further down: the 17-stage table, the 7 gates, the 3 loops, the five-tier memory map, and budgets/exits/risk.

Status: PROPOSAL. Nothing here is built or verified. AI-DLC facts carry citations; the design choices are the design author's. Source: mem:researches/aidlc-workflows-concepts, 2026-11-21.

**Shape.** One AI-DLC intent per question at aidlc/research/SPACE/intents/INTENT/, holding the record dir; the chain is unchanged — workspace, space (shared reliability history), intent (one question, one report), record dir (docs/guide/glossary.md:85, :76, :37, :62). A scope selects stages and depth (docs/guide/glossary.md:70) and is proposed from the request. Four new scopes: research:scan (6 stages), research:brief (11), research:deep (17), research:refresh (7, re-verifying). Skipped stages are [S] and get no gate (docs/guide/04-phases-and-stages.md:67, :86).

Why not a chat-with-search loop: a chat keeps nothing between turns, so a second question re-derives sources and claims and no reader audits them. Here state is committed Markdown with a filesystem audit trail (docs/guide/10-state-and-audit.md:3, :9); the claim ledger is what synthesis reads and gates check; verification is deterministic — a sensor is "a deterministic verification check defined by a manifest" (docs/guide/glossary.md:71) — not a second model's prose; and a stage can be refused.

## 17-stage map
Seventeen stages in AI-DLC's five phases (docs/guide/glossary.md:57); each has a lead, declared inputs/outputs and a protocol (docs/guide/glossary.md:77).

| Stage | Output; exit condition |
|---|---|
| 0.1 Brief intake | brief.md; one question, <=5 sub-questions, decision named |
| 0.2 Scope bind | scope entry + record dir; scope recorded, each [S] justified in a line |
| 1.1 Question decomposition | questions.md; each has an evidence type and a falsifier |
| 1.2 Source strategy | source-strategy.md; each channel has access, cost, max_age_days |
| 1.3 Register seed | sources/register.md; schema validates, ids stable |
| 1.4 Evidence plan | evidence-plan.md; each claim slot names a source type and saturation target |
| 2.1 Source discovery | register rows + sources/ID/capture.md; saturation met, or discovery budget spent |
| 2.2 Triage and independence | origin_group, independence, quality columns; no source unclassified, derivatives linked |
| 2.3 Extraction | extracts/SOURCE_ID.md; every span has an offset and a resolvable locator |
| 2.4 Ledger consolidation | evidence/claims.md; ids assigned, duplicates merged, orphans flagged |
| 3.1 Per-question synthesis | sections/Qn.md; every sentence maps to a claim id, inferences are INFERENCE rows |
| 3.2 Contradiction resolution | evidence/contradictions.md; no unresolved row inside a delivered section |
| 3.3 Adversarial review | reviews/red-team.md; red team is not a 3.1 author; each critical finding fixed or accepted with reason |
| 3.4 Report assembly | report.md + citation map; required sections present, map complete |
| 4.1 Citation resolution | reviews/citation-check.md; blocking gate passes, or an override is logged |
| 4.2 Freshness stamping | as_of, decay_by frontmatter; retrieval and decay date per source |
| 4.3 Feedforward harvest | memory-digest.md, sensor-proposals/; <=1 correction per tier with stage slug and date |

Departure: 17 of AI-DLC's 33 stages, dropped by phase — Initialization 3>2 (0.3), Ideation 7>4 (1.5-1.7), Inception 9>4 (design/decomposition half), Construction 7>4 (per-unit build and CI), Operation 7>3. AI-DLC repeats Construction 3.1-3.7 per implementation unit (docs/guide/04-phases-and-stages.md:72, :74); research repeats per source and per question, absorbed by a loop inside 2.3 and 3.1. The design author never read the stage names, so the drops are named by range. Five phases stay because boundary checks attach to boundaries (docs/guide/04-phases-and-stages.md:63).

## 7 gates
Sensors attach by pull: a stage frontmatter lists sensors: ids, baked by the resolver into sensors_applicable[] (core/aidlc-common/stages/construction/ci-pipeline.md:24-28, docs/reference/07-sensor-system.md:170-205). Write-fired run on Write|Edit; gate-fired at the approval gate, skipped by the write hook (core/hooks/aidlc-run-sensors.ts:1, :228, stage-protocol-sensors.md:21-23). Advisory audits but does not stop; blocking refuses entry until fixed or overridden (stage-protocol-sensors.md:29-34). All ids are new; AI-DLC's six ship advisory (docs/reference/07-sensor-system.md:213, core/sensors/aidlc-claim-sources.md:5), and research-sections re-parameterises shipped required-sections (core/sensors/aidlc-required-sections.md:5-9).

| id | fires | severity | threshold |
|---|---|---|---|
| research-source-coverage | gate @3.4 | advisory | >=2 independent origins per sub-question, or a declared single-source flag |
| research-claim-trace | gate @3.4 and 4.1 | BLOCKING | all sentences map to claims; INFERENCE rows source-less and <=5%; 0 orphans |
| research-contradiction | gate @3.2 | advisory | 0 unresolved rows in a delivered section |
| research-freshness | gate @4.2 | advisory | <=10% of cited sources beyond max_age_days without stale-accepted |
| research-independence | write @2.2 | advisory | no two rows above 0.8 span overlap counted as independent |
| research-citation-resolve | gate @4.1 | advisory | 100% resolve to a live URL or snapshot id |
| research-sections | gate @3.4 | advisory | all required H2 headings present |

research-claim-trace is the only blocking gate, at 3.4 and 4.1, because it is the only failure that cannot be disclosed instead of fixed: gaps, contradictions, staleness and duplicates are findings a report may state, while an unsourced claim presented as sourced is undetectable and devalues every other check. Departure: AI-DLC ships advisory-by-default and lets an operator escalate; this design fixes one sensor at blocking and keeps the override flow. Blocking semantics belong to aidlc-state.ts, not the hook, which always exits 0 (core/hooks/aidlc-run-sensors.ts:15-18, :309).

## 3 loops
Inner, per stage, 3 rounds: triggered by a gate finding or the lead's self-review; feedback goes into the stage memory.md, whose template carries Interpretations, Deviations, Tradeoffs and Open questions (core/knowledge/aidlc-shared/memory-template.md:4-15). At the cap it exits degraded, open questions moving into the next stage's inputs.

Middle, per phase boundary, 2 rounds: triggered by the traceability check AI-DLC inserts at every boundary except Initialization to Ideation (docs/guide/04-phases-and-stages.md:63). Feedback lands in reviews/phase-N.md as numbered directives naming the stage that re-enters. Re-entry voids the replaced output, the sections built on it, the citation map and their 3.3 review; revision has its own budget. At the cap the run narrows scope or stops for a human-backed override (stage-protocol-sensors.md:9-10).

Outer, across workflows, 1 write per tier: triggered at 4.3 by recurring gate findings, overrides and lead corrections — AI-DLC's self-learning loop, which appends corrections to team and project memory (core/memory/team.md:49-51, core/memory/project.md:47-50) and records RULE_LEARNED and SENSOR_PROPOSED (docs/guide/10-state-and-audit.md:191). It appends DECIDED: RULE (Stage SLUG, DATE) in project.md format (core/memory/project.md:47-50), read by later intents after org and team (core/memory/org.md:3-6); 1.2 reads them as channel priors and max_age_days defaults, 2.2 as reliability judgements. It also writes a threshold delta to sensor-proposals/ID.md, which no run reads — a human merges it. One write per tier and human merge for thresholds stop one bad workflow from rewriting every future one.

## Memory mapping (five tiers)
org core/memory/org.md: citation format, never-cite and embargo rules; maintainers by PR; read first every run (core/memory/org.md:3-6), never appended at runtime. team core/memory/team.md: channel priors, source-reliability judgements; written by the affirmation gate and the outer loop under ## Corrections (core/memory/team.md:3-7); read after org, before project; gate-only edit, a later correction supersedes. project core/memory/project.md: space decisions — ledger snapshots, scope choices; outer loop and human decisions (core/memory/project.md:47-50); read last (core/memory/project.md:3-6); a newer DECIDED line with the same key wins, the old kept. phase guardrails core/memory/phases/PHASE.md: per-phase rules (e.g. a Construction rule forbidding synthesis before claims.md closes); static body plus learning-loop corrections (core/memory/phases/ideation.md:3-4); read when a stage declares that phase: (core/memory/phases/ideation.md:30). stage memory: per-source notes, extraction scratch, interpretations, open questions; written continuously by the lead (core/knowledge/aidlc-shared/memory-template.md:2); read by later stages and 4.3; frozen at stage exit, content promoted not carried forward.

Volatile notes live in stage memory and sources/ID/capture.md; durable claims in evidence/claims.md — one row per claim with text, source ids, span, status. A claim survives four moves: extracted span > claim row > report citation > a DECIDED line only if a human changed a decision because of it. The lesson, not the claim, reaches team memory, so a superseded finding cannot outlive its sources. Departure: evidence/claims.md is new in the record dir AI-DLC defines as artifacts, per-stage memory.md, aidlc-state.md and audit/ (docs/guide/glossary.md:62); research needs the ledger because traceability is the blocking gate.

## Budgets, exits, risk
Four budgets, set in 0.2 and recorded in state so a resume inherits them: calls per stage from scope; a revision budget per boundary; sources and discovery rounds per sub-question; phase wall clock. Saturation stops discovery when three consecutive rounds add no new independent origin. Exits: met (every sub-question at coverage, no unresolved contradiction); saturated (coverage below target, three rounds adding nothing — coverage-gap block); capped (degraded, unfinished stages named, Phase Progress and Session Resume Point updated, docs/guide/10-state-and-audit.md:23-36). Failure modes: discovery runaway (bounded by saturation); extraction drift (byte offsets, then 3.3); synthesis before the ledger closes (Construction guardrail); citation rot (span hash stored at 2.3, checked at 4.1); contradiction laundering; memory poisoning.

Riskiest choices, the design's own: (1) one blocking sensor — correctness depends on the other six findings being disclosed, and nothing enforces disclosure; (2) outer-loop writes to shared team and project memory — a wrong correction propagates into every later intent, and the only defence is human editing at the gate; (3) saturation as a termination rule — new independent origins is a per-round judgement the scout can call early.
